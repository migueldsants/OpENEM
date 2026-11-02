---
titulo: Installation
descricao: How to run a copy of OpENEM with Docker Compose, what happens on the first start and where the data lives.
---

OpENEM runs in four containers, orchestrated by the `docker-compose.yml` at the root of the repository: the PostgreSQL database, the Redis (Valkey) cache, the API and the nginx that serves the site and the web app. This page goes from the clone to the first account.

## Requirements

- Docker with the Compose plugin (the `docker compose` command, without a hyphen).
- Git, to clone the repository.
- Internet on the first start: the backend downloads the exam dataset from GitHub, about 180 MB.
- Disk space for the database, the dataset and the question images.

You do not need Node.js or PostgreSQL on the machine: everything runs inside the containers.

## Configure the .env

```bash
git clone https://github.com/migueldsants/OpENEM.git
cd OpENEM
cp .env.example .env
```

The root `.env` is read by Docker Compose. Three variables are required, and without them Compose stops with an error before creating any container:

```env
POSTGRES_PASSWORD=<generate with openssl rand -hex 24>
REDIS_PASSWORD=<generate with openssl rand -hex 24>
JWT_SECRET=<generate with openssl rand -hex 32>
```

- `POSTGRES_PASSWORD` is the database password. Use only letters and digits: it goes unescaped into the `DATABASE_URL` that Compose builds for the backend. The output of `openssl rand -hex` already has that format.
- `REDIS_PASSWORD` is the password of Redis (Valkey), the API cache. Also only letters and digits, for the same reason: it goes into the `REDIS_URL`. The cache keeps nothing on disk, so changing the password later causes no trouble.
- `JWT_SECRET` signs the login tokens. With `NODE_ENV=production`, which is the case in the Docker image, the API refuses to start if the secret is missing or shorter than 16 characters.

> **Warning:** the PostgreSQL image only reads `POSTGRES_PASSWORD` when it creates the `pg-data` volume. Changing the password in `.env` after that does not change the database password, and the backend starts failing to connect.

The other variables are optional and are listed in [Environment variables](/docs/en/hospedar/variaveis/).

## Start

```bash
docker compose up --build
```

To run in the background and follow only the backend log:

```bash
docker compose up --build -d
docker compose logs -f backend
```

## Services and ports

| Service | What it is | Port on the host |
| --- | --- | --- |
| `db` | PostgreSQL 17 | `127.0.0.1:5432` (change with `POSTGRES_PORT`) |
| `redis` | Valkey 8, the API cache (nothing persisted to disk) | `127.0.0.1:6379` (change with `REDIS_PORT`) |
| `backend` | NestJS API | `127.0.0.1:3000` |
| `frontend` | nginx with the site (`/`, `/docs/`) and the app (`/app/`), forwarding `/api/`, `/health` and `/media/` to the backend | `8080`, on all interfaces |

The database, Redis and the API are published only on `127.0.0.1`. From another machine, access always goes through port 8080; the reason is in [Production](/docs/en/hospedar/producao/).

## What happens on the first start

Every time it starts, the backend container runs, in this order:

1. `prisma migrate deploy`, which applies pending migrations;
2. the bootstrap (`prisma/bootstrap.ts`, compiled into the image);
3. the API.

The bootstrap counts the official questions in the database. If there are none, it runs four steps:

1. **seed**: areas, subjects and topics, simulation templates, essay prompts and the formula catalog;
2. **import of the official exams**: downloads the dataset from [updated-enem-api](https://github.com/migueldsants/updated-enem-api), writes the questions to Postgres and copies the images to the `enem-media` volume;
3. **keyword classification**: assigns a topic to the questions whose vocabulary leaves no doubt, without AI;
4. **flashcards**: syncs the public deck catalog.

This takes a few minutes. On later starts, with questions already in the database, the bootstrap does nothing, unless a new version changes the import mapping: then it reimports the exams in the background, with the API up. To update the data later, see [Production](/docs/en/hospedar/producao/#update).

If a step fails (no internet, for example), the error shows up in the log with the `[bootstrap]` prefix and the API starts anyway, without questions. Since the database still has no official questions, the next start tries again:

```bash
docker compose restart backend
```

### Turning off the automatic import

With `AUTO_IMPORT=0` in `.env` (`false`, `off` and `no` also work), the whole bootstrap is skipped, seed included. The database is left with empty tables, and the steps have to be run by hand inside the container:

```bash
docker compose exec backend node dist-scripts/prisma/seed.js
docker compose exec backend node dist-scripts/prisma/import-enem.js
docker compose exec backend node dist-scripts/prisma/classify-heuristic.js
docker compose exec backend node dist-scripts/prisma/seed-flashcards.js
```

The image has no ts-node, so the scripts run compiled, from `dist-scripts/`.

## Healthcheck

Compose checks the backend with `GET /health` every 30 seconds, with 15 minutes of grace at the start for the bootstrap. The frontend only starts after the backend is healthy, so port 8080 only answers once the API is up.

> **Warning:** if the first start takes longer than 15 minutes (slow internet, for example), the backend is marked `unhealthy` and Compose gives up on starting the frontend. Wait for the import to finish in the log and run `docker compose up -d` again.

To check by hand:

```bash
curl http://localhost:8080/health
```

The expected answer is `{"status":"ok","database":"up","redis":"up"}`. The route answers 200 even when the database or Redis is down; in that case the matching field is `down`. Without `REDIS_URL` (outside Docker), `redis` is `disabled`.

## Volumes

| Volume | Mounted at | Contents |
| --- | --- | --- |
| `pg-data` | `/var/lib/postgresql/data`, in `db` | The whole database: accounts, student progress and questions. |
| `enem-media` | `/data`, in `backend` | `enem-media/`, with the question images served at `/media/enem/`, and `enem-dataset/`, with the downloaded dataset. |

Both survive `docker compose down` and image rebuilds. `docker compose down -v`, on the other hand, deletes the volumes, and with them every account and all student progress. How to back up is in [Production](/docs/en/hospedar/producao/#backups).

## First access

Open `http://localhost:8080` (or the server address on port 8080): the root is the project page and the documentation lives at `/docs/`. The app lives at `/app/`; open `http://localhost:8080/app/` and create an account on the sign-in screen. The app's old addresses, from before it moved to `/app/` (such as `/questoes`), redirect to the new ones. There is no default user and no admin account: every account is a student account, created by the app itself.

The API Swagger is off in the Docker image, because it runs with `NODE_ENV=production`. It only shows up in the development environment, described in [Development](/docs/en/contribuir/desenvolvimento/).

> **Tip:** to turn on AI-generated question explanations, see [Artificial intelligence](/docs/en/hospedar/ia/). Before opening the instance to students outside your network, read [Production](/docs/en/hospedar/producao/).
