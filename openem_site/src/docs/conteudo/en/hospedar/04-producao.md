---
titulo: Production
descricao: HTTPS in front of OpENEM, TRUST_PROXY, security headers, rate limiting, backups and how to update an instance.
---

## Path of a request

The student reaches Caddy on ports 80 and 443 (with the production overlay, below) or, without it, the nginx of the `frontend` container on port 8080. nginx serves the site at the root (the project page and the documentation at `/docs/`) and the app at `/app/`, and forwards `/api/`, `/health` and `/media/` to the API on port 3000, appending the student's IP to the `X-Forwarded-For` header. The API talks to PostgreSQL and Redis over the internal Compose network.

## HTTPS in front

The `docker-compose.prod.yml` file (the production overlay) adds a Caddy in front of the app's nginx. It obtains and renews the Let's Encrypt certificate for `openem.tech` on its own, redirects `www.openem.tech` to the main address, and is the only service published on the network. Besides protecting passwords and tokens, HTTPS is required by the PWA itself: the browser only registers the service worker (offline use and app installation) in a secure context, that is, HTTPS or `localhost`.

To set it up:

1. Point the domain's `A` record (and `AAAA`, if the server has IPv6) to the server's IP.
2. Open ports 80 and 443 in the firewall. Port 80 serves the certificate validation and the redirect to HTTPS.
3. In the `.env` file at the root, set the public address and the overlay:

```bash
SITE_URL=https://openem.tech
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
```

With `COMPOSE_FILE` in `.env`, the Compose commands use both files without `-f`. For another domain, change `openem.tech` in `deploy/Caddyfile` and `SITE_URL`. The overlay requires Docker Compose v2.24.4 or newer (`docker compose version`).

The overlay also takes port 8080 off the network: the app's nginx is no longer published, and only Caddy reaches it. Without the overlay, Compose serves HTTP on port 8080 on all interfaces, which suits a development machine and should not go on the internet.

Caddy sends `Strict-Transport-Security` by default. The app's `nginx.conf` does not send HSTS; whoever changes proxy configures HSTS in the new one.

### Another HTTPS proxy

If HTTPS comes from somewhere else (your own nginx on the host, Traefik, a load balancer), do not use the overlay. Point the proxy to `http://127.0.0.1:8080`, send the `X-Forwarded-For` (see TRUST_PROXY), and bind port 8080 to localhost, in a `docker-compose.override.yml`:

```yaml
services:
  frontend:
    ports: !override
      - '127.0.0.1:8080:80'
  backend:
    environment:
      - TRUST_PROXY=2
```

This override also requires Compose v2.24.4 or newer. `!override` replaces the port list instead of adding to it.

## TRUST_PROXY

Without login (sign-up, login), rate limiting counts by IP. Behind a proxy, the API only sees the student's IP if it knows how many proxies sit in front of it, and that is what `TRUST_PROXY` tells it:

- **No value:** the API trusts no proxy. Behind one, every student shows up with the proxy's IP and rate limiting becomes a single counter for the whole site: one person's wrong passwords lock everyone out of login.
- **A number N:** the API trusts the last N hops. With `1`, it uses the last address in `X-Forwarded-For`, the one nginx appended, and ignores whatever the client wrote before it.
- **A list of addresses or subnets** in Express format, such as `loopback, 10.0.0.0/8`.
- **`true` is rejected** and keeps the API from starting, because it would let the client pick its own IP.

Compose fixes `TRUST_PROXY=1`, which is right when the frontend nginx is the only proxy. With the production overlay there are two (Caddy and nginx), and the overlay raises the value to 2. With an HTTPS proxy of your own in front of the nginx, the value must also be 2:

1. The HTTPS proxy must send the client IP in `X-Forwarded-For`. In nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. The overlay's Caddy already does it.
2. Raise `TRUST_PROXY` to 2 in your override, as in the "Another HTTPS proxy" block above.

If the HTTPS proxy sits in front with `TRUST_PROXY=1`, every student shows up with its IP, the same problem as trusting no proxy at all.

### Why port 3000 stays on 127.0.0.1

With `TRUST_PROXY` on, anyone reaching the API without going through nginx could write any `X-Forwarded-For` and get a fresh counter on every request, escaping rate limiting. That is why Compose publishes port 3000 only on `127.0.0.1`, and the database too. Do not open them to the network.

## Security headers

The app gets the headers of the `location /app/` block in [nginx.conf](https://github.com/migueldsants/OpENEM/blob/main/openem_frontend/nginx.conf): a Content-Security-Policy that only accepts scripts from its own origin, without `'unsafe-inline'`, plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`. The CSP exceptions are what the app uses from outside: the cookieless YouTube player and `https` images in flashcards. Fonts are served by the app itself, without Google Fonts. The site (`location /`) has a stricter CSP, with no outside origin at all. The API gets helmet's headers. HTML is sent with `Cache-Control: no-cache`, so the browser never reopens a page that points to files a deploy has already replaced.

If your HTTPS proxy rewrites headers, keep these. Whoever changes the app to use a new outside origin has to allow it in `nginx.conf`; the frontend test `src/nginx-csp.test.ts` breaks when the two get out of sync.

## Rate limiting

Each limit is counted per route. With login, it counts per student: a class behind the same IP (a school, a prep course, a mobile carrier's network) does not share the limit. Without login, it counts per IP.

| Route | Limit | Why |
| --- | --- | --- |
| Any route | 20 per second and 100 per minute | Short burst and the default limit (`THROTTLE_BURST_*`, `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`). Covers `POST /answers` and submitting a simulation. |
| Login | 30 per minute per IP, and 5 wrong passwords in 15 min per account | Per IP, loose enough for a classroom. Per account, wherever the attempts come from: the fifth wrong password locks the account for 15 min, and each new lock on the same day doubles the previous one, up to 24 h. A correct login clears the failures. An email with no account locks the same way, so the lock does not reveal which ones exist. |
| Sign-up | 20 per minute per IP | Each sign-up computes an argon2 hash. |
| Forgot password | 10 every 15 min per IP, and 3 per hour per e-mail | Each request may send an e-mail. The per e-mail limit applies with or without an account, so it does not reveal which ones exist. |
| Password reset and Google sign-in | 10 and 20 per minute per IP | The tokens have 256 bits: the limit is against abuse, not guessing. |
| Password change | 5 per minute per student | Someone holding only a stolen token cannot keep trying passwords. |
| PDF (simulation and formulas) | 10 per minute | Drawing is heavy CPU work and goes through a queue. |
| AI explanation | 10 per minute | Each new request is a paid call; the daily quota applies on top. |
| Forum (thread, reply and report) | 10 per minute | Spam. |
| Themes (create and edit) | 20 and 30 per minute | Spam. |
| Download my data (`GET /users/me/export`) | 5 every 10 minutes | Reads all of the student's tables at once. |
| Delete account (`DELETE /users/me`) | 5 per minute, and wrong passwords count toward the login's per-account limit | Someone holding only the token cannot test passwords through this route. |

`/health` and `/media/` only count in the default limit. Going over a limit returns HTTP 429 with `Retry-After` and the message "Muitas tentativas. Tente de novo em N s." ("Too many attempts. Try again in N s."), and the app shows the waiting time.

The counters live in Redis: they hold for every API instance and survive a deploy. With Redis down, each instance counts in its own memory until it comes back; the limits never stop applying. `THROTTLE_KEY_PREFIX` keeps apart the counters of two installations that share the same Redis.

### At the edge

The frontend nginx limits `/api/` to 50 requests per second per IP, with a burst of 200, before anything reaches Node. It is flood protection, not a business rule: it sits well above what a whole classroom opening the app produces.

Behind a proxy, nginx sees the proxy's IP and would start limiting everyone together. That is why the production overlay mounts `deploy/nginx-real-ip.conf` in `/etc/nginx/conf.d/`: nginx reads the student's IP from `X-Forwarded-For` when the request comes from the Docker network (`172.16.0.0/12`). Anyone connecting from outside has a source IP outside that range, so the header they send is ignored. If Docker uses another range (`default-address-pools` in the daemon), change the address in that file.

With another proxy outside Docker, the path is the same: a file in the same place, with that proxy's address:

```nginx
set_real_ip_from 203.0.113.10;  # your proxy's address
real_ip_header X-Forwarded-For;
```

## Backups

### Database

```bash
docker compose exec -T db pg_dump -U openem -d openem -Fc > openem.dump
```

`-T` turns off the pseudo-terminal, which would corrupt the binary output. If you changed `POSTGRES_USER` or `POSTGRES_DB`, replace `openem` with your values. To restore, stop the backend first:

```bash
docker compose stop backend
docker compose exec -T db pg_restore -U openem -d openem --clean --if-exists < openem.dump
docker compose start backend
```

### Question images

```bash
docker compose exec -T backend tar czf - -C /data enem-media > enem-media.tgz
```

To restore:

```bash
docker compose exec -T backend tar xzf - -C /data < enem-media.tgz
```

The questions in the database point to these images, so keep both backups from the same moment. The `/data/enem-dataset` folder needs no backup: the import downloads the dataset again.

## Privacy and the LGPD

Whoever runs an installation is the controller of the students' data, and many of them are teenagers. OpENEM ships a [Privacy Policy](/en/privacidade/) and [Terms of Use](/en/termos/), but only you know who the controller is, what the contact is and how long your logs are kept.

### Fill in the documents

The texts live in `openem_site/src/legal/conteudo/` (`privacidade.md` and `termos.md`, with the translation in `en/`). Replace each `[PLACEHOLDER: ...]` with the real information and rebuild the image:

- identity of the controller (name or company name, CPF or CNPJ, address) and of the data protection officer;
- contact email, which is the channel for requests from students and their parents or guardians;
- configured AI provider (or "none") and hosting company;
- retention period of the nginx access logs and of the backups;
- how you announce relevant changes, and the legal venue.

The documents are a starting point, not legal advice: review them with someone who knows the LGPD and the Digital Statute of Children and Adolescents (Law 15,211/2025) before opening the installation to students.

### Terms version

Sign-up requires acceptance and stores, on each account, the accepted date and version (`termsAcceptedAt` and `termsVersion`). The version is `TERMS_VERSION`, in `openem_backend/src/common/terms.ts`, and it must equal the `atualizado` header of the four pages; the site test fails otherwise. When you change the text, change both dates together.

### Logs and retention

The frontend image's nginx writes the access log (IP, date, address, browser) to the container output, and Docker is what keeps it. Limit its size and age in Docker's log driver (for example, `max-size` and `max-file` of `json-file`) and write that period in the policy. If the controller is a for-profit legal entity, the Brazilian Internet Civil Framework (art. 15) requires access records to be kept for 6 months.

The rate limit counters in Redis expire on their own (from 1 second to 10 minutes; the login lockout lasts up to 24 h, with the email hashed). The Compose Redis runs without persistence.

### Deletion and backups

`DELETE /users/me` deletes the account and, in cascade, everything that belongs to the student. Whatever already went into a backup stays there: restoring an old dump brings deleted accounts back. Set a retention period for backups, write it in the policy and, when you restore, remember that students who deleted their accounts after that dump must be deleted again.

### Forum reports

There is no moderation screen yet. Reports live in the `ForumReport` table, with the reason, the reporter and the thread or reply:

```bash
docker compose exec db psql -U openem -d openem -c 'SELECT r."createdAt", r.reason, t.title, p.body FROM "ForumReport" r JOIN "ForumThread" t ON t.id = r."threadId" LEFT JOIN "ForumPost" p ON p.id = r."postId" ORDER BY r."createdAt" DESC LIMIT 50;'
```

To remove reported content, delete the row in `ForumThread` or `ForumPost`; its replies and reports go with it in cascade. Content that violates the rights of children and adolescents, besides being removed, may have to be reported to the authorities.

## Search engines and AI assistants

The site build (the frontend image) writes, next to the pages:

- `robots.txt`: allows the site and the documentation and keeps the app (`/app/`) and the API (`/api/`) out of search engines, since they are screens for people who already have an account.
- `sitemap.xml`: every page except the English address of pages that are not translated yet (it repeats the Portuguese text and points its canonical to the original page). It is only written when `SITE_URL` is set, because a sitemap needs full addresses.
- `llms.txt` and `llms-full.txt`, in the [llmstxt.org](https://llmstxt.org) format: a Markdown index of the documentation, so AI assistants find what matters, and the full text of the pages in a single file. They come from the same pages as the site, so they never go stale.

Each page carries a title, a description, a canonical link, its versions in each language (`hreflang`), Open Graph with the sharing image and structured data (schema.org JSON-LD). With `SITE_URL`, all these addresses are absolute; without it, they stay relative and the navigation trail (`BreadcrumbList`) is left out.

## Update

Back up first. Then:

```bash
git pull
docker compose up --build -d
```

On start, the backend applies the new migrations (`prisma migrate deploy`) before bringing up the API. The bootstrap does not run again, because the database already has questions.

### Updating the data

The image has no ts-node, so the scripts run compiled, from `dist-scripts/`:

```bash
docker compose exec backend node dist-scripts/prisma/import-enem.js --refresh
docker compose exec backend node dist-scripts/prisma/classify-heuristic.js
docker compose exec backend node dist-scripts/prisma/seed-flashcards.js
docker compose exec backend node dist-scripts/prisma/seed.js
```

- `import-enem.js --refresh` deletes the downloaded dataset and downloads it again. The import updates without duplicating and does not undo explanations or classifications made afterwards. Other options: `--exam=2023` (a single exam), `--dry-run`, `--limit=5`, `--skip-download`, `--skip-images` and `--verbose`.
- `classify-heuristic.js` only touches questions without a topic. It accepts `--dry-run` and `--sample=20` to audit decisions.
- `seed-flashcards.js` syncs the catalog: it fixes card text without losing student progress.
- `seed.js` reapplies, by upsert, the taxonomy, the simulation templates, the essay prompts and the formula catalog. An area that left the taxonomy is only removed if it has no questions.

All of these scripts invalidate the API's catalog cache when they finish. AI classification is covered in [Artificial intelligence](/docs/en/hospedar/ia/).
