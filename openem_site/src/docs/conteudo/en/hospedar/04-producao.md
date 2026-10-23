---
titulo: Production
descricao: HTTPS in front of OpENEM, TRUST_PROXY, security headers, rate limiting, backups and how to update an instance.
---

## Path of a request

The student reaches the nginx of the `frontend` container (port 8080). It serves the site at the root (the project page and the documentation at `/docs/`) and the app at `/app/`, and forwards `/api/`, `/health` and `/media/` to the API on port 3000, appending the student's IP to the `X-Forwarded-For` header. The API talks to PostgreSQL and Redis over the internal Compose network.

## HTTPS in front

Compose only serves HTTP. In production, put a reverse proxy with TLS (nginx, Caddy, Traefik or whatever you already use) in front, pointing to `http://127.0.0.1:8080`. Besides protecting passwords and tokens, HTTPS is required by the PWA itself: the browser only registers the service worker (offline use and app installation) in a secure context, that is, HTTPS or `localhost`.

The app's `nginx.conf` does not send `Strict-Transport-Security`. If you want HSTS, configure it in your HTTPS proxy.

## TRUST_PROXY

Without login (sign-up, login), rate limiting counts by IP. Behind a proxy, the API only sees the student's IP if it knows how many proxies sit in front of it, and that is what `TRUST_PROXY` tells it:

- **No value:** the API trusts no proxy. Behind one, every student shows up with the proxy's IP and rate limiting becomes a single counter for the whole site: one person's wrong passwords lock everyone out of login.
- **A number N:** the API trusts the last N hops. With `1`, it uses the last address in `X-Forwarded-For`, the one nginx appended, and ignores whatever the client wrote before it.
- **A list of addresses or subnets** in Express format, such as `loopback, 10.0.0.0/8`.
- **`true` is rejected** and keeps the API from starting, because it would let the client pick its own IP.

Compose fixes `TRUST_PROXY=1`, which is right when the frontend nginx is the only proxy. With an HTTPS proxy in front of it, there are two:

1. The HTTPS proxy must send the client IP in `X-Forwarded-For`. In nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
2. Raise `TRUST_PROXY` to 2 in a `docker-compose.override.yml`:

```yaml
services:
  backend:
    environment:
      - TRUST_PROXY=2
```

3. Close port 8080 to the network. With `TRUST_PROXY=2`, anyone reaching it directly could forge `X-Forwarded-For`. In `docker-compose.yml`, change the frontend `ports` line from `'8080:80'` to `'127.0.0.1:8080:80'`. The change has to be in that file itself: in an override file, Compose adds ports instead of replacing them.

If the HTTPS proxy sits in front with `TRUST_PROXY=1`, every student shows up with its IP, the same problem as trusting no proxy at all.

### Why port 3000 stays on 127.0.0.1

With `TRUST_PROXY` on, anyone reaching the API without going through nginx could write any `X-Forwarded-For` and get a fresh counter on every request, escaping rate limiting. That is why Compose publishes port 3000 only on `127.0.0.1`, and the database too. Do not open them to the network.

## Security headers

The app gets the headers of the `location /app/` block in [nginx.conf](https://github.com/migueldsants/OpENEM/blob/main/openem_frontend/nginx.conf): a Content-Security-Policy that only accepts scripts from its own origin, without `'unsafe-inline'`, plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`. The CSP exceptions are what the app uses from outside: Google Fonts, the cookieless YouTube player and `https` images in flashcards. The site (`location /`) has a stricter CSP, with no outside origin at all. The API gets helmet's headers. HTML is sent with `Cache-Control: no-cache`, so the browser never reopens a page that points to files a deploy has already replaced.

If your HTTPS proxy rewrites headers, keep these. Whoever changes the app to use a new outside origin has to allow it in `nginx.conf`; the frontend test `src/nginx-csp.test.ts` breaks when the two get out of sync.

## Rate limiting

Each limit is counted per route. With login, it counts per student: a class behind the same IP (a school, a prep course, a mobile carrier's network) does not share the limit. Without login, it counts per IP.

| Route | Limit | Why |
| --- | --- | --- |
| Any route | 20 per second and 100 per minute | Short burst and the default limit (`THROTTLE_BURST_*`, `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`). Covers `POST /answers` and submitting a simulation. |
| Login | 30 per minute per IP, and 5 wrong passwords in 15 min per account | Per IP, loose enough for a classroom. Per account, wherever the attempts come from: the fifth wrong password locks the account for 15 min, and each new lock on the same day doubles the previous one, up to 24 h. A correct login clears the failures. An email with no account locks the same way, so the lock does not reveal which ones exist. |
| Sign-up | 20 per minute per IP | Each sign-up computes an argon2 hash. |
| PDF (simulation and formulas) | 10 per minute | Drawing is heavy CPU work and goes through a queue. |
| AI explanation | 10 per minute | Each new request is a paid call; the daily quota applies on top. |
| Forum (thread and reply) | 10 per minute | Spam. |
| Themes (create and edit) | 20 and 30 per minute | Spam. |

`/health` and `/media/` only count in the default limit. Going over a limit returns HTTP 429 with `Retry-After` and the message "Muitas tentativas. Tente de novo em N s." ("Too many attempts. Try again in N s."), and the app shows the waiting time.

The counters live in Redis: they hold for every API instance and survive a deploy. With Redis down, each instance counts in its own memory until it comes back; the limits never stop applying. `THROTTLE_KEY_PREFIX` keeps apart the counters of two installations that share the same Redis.

### At the edge

The frontend nginx limits `/api/` to 50 requests per second per IP, with a burst of 200, before anything reaches Node. It is flood protection, not a business rule: it sits well above what a whole classroom opening the app produces.

With another proxy or CDN in front of that nginx, it sees the proxy's IP and would start limiting everyone together. In that case, besides raising `TRUST_PROXY`, teach nginx to read the real IP, in a file mounted in `/etc/nginx/conf.d/`:

```nginx
set_real_ip_from 172.16.0.0/12;  # your proxy's network
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
