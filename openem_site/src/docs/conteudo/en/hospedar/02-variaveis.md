---
titulo: Environment variables
descricao: Every environment variable OpENEM reads, with its default value and what it does, grouped by topic.
---

## Where each variable is set

- **Root `.env`** (template: [.env.example](https://github.com/migueldsants/OpENEM/blob/main/.env.example)): read by Docker Compose.
- **`openem_backend/.env`** (template: [openem_backend/.env.example](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/.env.example)): read by the backend when it runs outside Docker, in development.

Compose does not pass the whole `.env` to the backend, only the variables listed under `environment` in [docker-compose.yml](https://github.com/migueldsants/OpENEM/blob/main/docker-compose.yml), and some of them with a fixed value. In the tables, "fixed in Compose" means that changing the variable in `.env` has no effect, and "outside Compose" that it does not reach the container. To set one of those in Docker, create a `docker-compose.override.yml` at the root. Compose reads that file on its own, git ignores it, and its variables take precedence over the ones in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - THROTTLE_LIMIT=200
      - PDF_CONCURRENCY=2
```

For numeric variables (rate limiting, PDF and AI quotas), a missing or invalid value falls back to the default.

## Database

| Variable | Default | What it does |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | none | Required by Compose. PostgreSQL password, letters and digits only. Only applies when the `pg-data` volume is created. |
| `POSTGRES_USER` | `openem` | PostgreSQL user in Compose. |
| `POSTGRES_DB` | `openem` | Database name in Compose. |
| `POSTGRES_PORT` | `5432` | Database port published on `127.0.0.1`, for the development backend, `psql` or `pg_dump` on the machine itself. The Compose backend uses the internal network. |
| `DATABASE_URL` | none | Prisma connection URL. In Compose it is built from the three variables above; in development it comes from `openem_backend/.env`. |

## Cache (Redis)

| Variable | Default | What it does |
| --- | --- | --- |
| `REDIS_PASSWORD` | none | Required by Compose. Redis (Valkey) password, letters and digits only. |
| `REDIS_PORT` | `6379` | Redis port published on `127.0.0.1`, for the development backend. The Compose backend uses the internal network. |
| `REDIS_MAXMEMORY` | `128mb` | Maximum cache memory. When full, it drops the least used keys. |
| `REDIS_URL` | none | Redis URL, such as `redis://:password@redis:6379`. In Compose it is built from `REDIS_PASSWORD`. Without it, the cache lives in the API process memory, which is fine for a single instance. |

The cache holds what is the same for every student: subjects, exams, search facets, the detail of each question and the star counts on the Tools screen. The seed, import and classification scripts invalidate it when they finish. If Redis goes down, the API reads from the database and `/health` shows `redis: down` without changing `status`.

## Authentication

| Variable | Default | What it does |
| --- | --- | --- |
| `JWT_SECRET` | none | Required by Compose. Signs the login tokens and encrypts the cookie of the Google sign-in round trip. With `NODE_ENV` set to `production` or `test`, the API does not start if it is missing or shorter than 16 characters; otherwise the API uses a fixed development secret. Changing it signs every student out. |
| `JWT_EXPIRES_IN` | `7d` | Login token lifetime, such as `7d` or `12h`. |

The token carries the account's session version, checked on every request. Changing the password, resetting it by e-mail or tapping **Sair de todos os dispositivos** (sign out of all devices) on the Profile screen invalidates every token already issued for that account right away, without waiting for `JWT_EXPIRES_IN`.

## E-mail and Google sign-in

| Variable | Default | What it does |
| --- | --- | --- |
| `SMTP_URL` | none | Mail server for password recovery, such as `smtps://user:password@smtp.example.com:465` (implicit TLS) or `smtp://user:password@smtp.example.com:587` (STARTTLS). Without it, `POST /auth/forgot-password` answers 503 and the sign-in screen hides **Esqueci minha senha** (forgot my password). |
| `MAIL_FROM` | none | Sender of the e-mail, such as `OpENEM <no-reply@openem.example>`. Only applies together with `SMTP_URL`. |
| `GOOGLE_CLIENT_ID` | none | Google OAuth client ID. With `GOOGLE_CLIENT_SECRET`, it turns on the **Entrar com Google** button. |
| `GOOGLE_CLIENT_SECRET` | none | Google OAuth client secret. |

Both features are optional and need `SITE_URL`: the e-mail link and the Google return address are built from it. A variable set without its pair turns the feature off and leaves a warning in the API log at startup. The step by step guide, including the Google consent screen, is in [E-mail and Google sign-in](/docs/en/hospedar/email-e-google/).

## Server and proxy

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | API port. Fixed in Compose. |
| `NODE_ENV` | none (`production` in the Docker image) | `production` turns off the Swagger at `/api` and requires a valid `JWT_SECRET`. Fixed in Compose. |
| `TRUST_PROXY` | none (trusts no proxy) | Number of proxies in front of the API (`1`) or a list of addresses and subnets (`loopback, 10.0.0.0/8`). `true` is rejected and keeps the API from starting. Fixed to `1` in Compose (`2` with `docker-compose.prod.yml`); see [Production](/docs/en/hospedar/producao/). |
| `CORS_ORIGINS` | none | Origins allowed by CORS, comma separated. Without a value, the API leaves CORS off in production (the app reaches it from the same origin through nginx) and accepts any origin outside production. `*` is rejected and stops the API from starting. Outside Compose. |
| `SITE_URL` | none | Public domain of the installation, such as `https://openem.example`. It goes into the frontend image build, where it generates `sitemap.xml` and makes the Open Graph URLs absolute, and the backend builds the password reset e-mail link and the Google sign-in return address from it. Without it, the site ships without a sitemap and with relative URLs, and those two features stay off (outside production, the backend uses `http://localhost:5173`). Changing it requires `docker compose up --build`. |
| `SOURCE_URL` | the official repository | Source code address the app shows on Login and Profile. The AGPL-3.0 requires that people using the app over the network can get the code running on it: if you modified OpENEM, point it at your fork. It goes into the frontend image build; changing it requires `docker compose up --build`. |
| `SPONSOR_URL` | the maintainer's GitHub Sponsors | Sponsorship address shown by the app (the invitation that opens on sign-in and the Profile) and the landing page. In a fork, point it at your own sponsorship. It goes into the frontend image build; changing it requires `docker compose up --build`. |

## Rate limiting

| Variable | Default | What it does |
| --- | --- | --- |
| `THROTTLE_TTL_MS` | `60000` | Window of the default limit, in milliseconds. Outside Compose. |
| `THROTTLE_LIMIT` | `100` | Requests allowed per window, counted per route and per student (per IP without login). Outside Compose. |
| `THROTTLE_BURST_TTL_MS` | `1000` | Window of the short burst limit, in milliseconds. Outside Compose. |
| `THROTTLE_BURST_LIMIT` | `20` | Requests allowed in a burst, per route and per student. Outside Compose. |
| `THROTTLE_KEY_PREFIX` | none | Keeps apart, in Redis, the counters of two installations that share the same server. Instances of the same installation must use the same value. Outside Compose. |

These are the default limits. The expensive routes (sign-up, login, PDF, AI, forum and theme writes) have their own limits in the code, which these variables do not change; the table is in [Production](/docs/en/hospedar/producao/). The counters live in the Redis at `REDIS_URL`.

## AI

| Variable | Default | What it does |
| --- | --- | --- |
| `AI_PROVIDER` | automatic detection | `anthropic`, `openai`, `openai-compatible` or `gemini`. Applies to question explanations and topic classification. |
| `AI_EXPLANATION_MODEL` | the provider's model | Model for question explanations. Outside Compose. |
| `AI_CLASSIFY_MODEL` | the provider's model | Model for the topic classification script. Outside Compose. |
| `ANTHROPIC_API_KEY` | none | Anthropic (Claude) key. |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Default Anthropic model. |
| `OPENAI_API_KEY` | none | OpenAI key. Optional in compatible mode. |
| `OPENAI_MODEL` | `gpt-4o` on OpenAI, `llama3.1` in compatible mode | Default model for OpenAI and for the compatible endpoint. |
| `OPENAI_BASE_URL` | none | Base URL of an endpoint compatible with the OpenAI API (Ollama, Groq, OpenRouter, LM Studio, vLLM). Enables the `openai-compatible` provider. |
| `GEMINI_API_KEY` | none | Google Gemini key. |
| `GOOGLE_API_KEY` | none | Alternative to `GEMINI_API_KEY`, used when that one is not set. Outside Compose; in Docker, use `GEMINI_API_KEY`. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Default Gemini model. |

> **Warning:** when `ANTHROPIC_MODEL`, `OPENAI_MODEL` or `GEMINI_MODEL` are missing from `.env`, Compose passes them empty, and the backend uses the empty value instead of the default in the table. In Docker, always set the model of the provider you configure.

Details in [Artificial intelligence](/docs/en/hospedar/ia/).

## AI quotas

| Variable | Default | What it does |
| --- | --- | --- |
| `AI_EXPLANATION_DAILY_LIMIT` | `30` | Question explanations generated per student in a 24-hour window. Opening an explanation that is already stored does not count. `0` turns this limit off. |
| `AI_DAILY_LIMIT` | `0` (no cap) | Global cap: the sum of paid calls from all students in 24 hours. |

## PDF

| Variable | Default | What it does |
| --- | --- | --- |
| `PDF_CONCURRENCY` | `1` | How many PDFs are drawn at the same time, each in a worker thread. Minimum 1. Outside Compose. |
| `PDF_MAX_QUEUE` | `8` | How many requests can wait in the queue. Beyond that, the API answers 503 right away. Minimum 0. Outside Compose. |
| `PDF_TIMEOUT_MS` | `60000` | Time limit for each drawing, in milliseconds; when it runs out, the API answers 503. Minimum 1000. Outside Compose. |

The queue covers both the simulation booklet and the formula booklet. Raise `PDF_CONCURRENCY` only if the server has spare cores.

## Where to study

| Variable | Default | What it does |
| --- | --- | --- |
| `STUDY_RESOURCES_BLOCKED` | none | Ids of materials on the **Onde estudar** (Where to study) screen that leave the list right away, without waiting for a new version, separated by commas (for example `khan-em-algebra-1,rae-diccionario`). Use it to honor a removal request or take down a broken link; the ids are in `openem_backend/src/study-resources/study-resources-catalog.ts`. It applies when the backend restarts, and the API logs a warning if it names an id that does not exist. |

## Import and data

| Variable | Default | What it does |
| --- | --- | --- |
| `AUTO_IMPORT` | on (`1` in Compose) | Turns on the bootstrap of the container's first start (seed, import, keyword classification and flashcards) and the background reimport when a new version changes the import mapping. `0`, `false`, `off` or `no` turn it off. |
| `ENEM_DATASET_DIR` | `prisma/.enem-dataset` | Where the import keeps the downloaded dataset. Fixed to `/data/enem-dataset` in Compose. |
| `ENEM_MEDIA_DIR` | `public/enem` | Where the question images live, served by the API at `/media/enem/`. Fixed to `/data/enem-media` in Compose. |
| `SEED_DEMO` | none | With `1`, the seed creates the demo content of the e2e suite (6 questions and 2 simulations). Outside Compose. |

Default paths are relative to `openem_backend/`.
