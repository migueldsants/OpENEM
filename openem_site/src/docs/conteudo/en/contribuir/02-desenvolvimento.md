---
titulo: Development
descricao: How to run OpENEM on your machine, run the tests and follow the project conventions before opening a pull request.
---

## Requirements

- Node.js 22, the same version as CI and the Docker images.
- Docker, to start the PostgreSQL from Compose (any local PostgreSQL 17 works too).
- Git.

## Database

At the root of the repository, create the `.env` as in [Installation](/docs/en/hospedar/instalacao/) (Compose requires `POSTGRES_PASSWORD`, `REDIS_PASSWORD` and `JWT_SECRET`) and start only the database:

```bash
cp .env.example .env
docker compose up -d db
```

It listens on `127.0.0.1:5432`. Redis is optional in development: without `REDIS_URL`, the backend keeps its cache in its own memory. To test with it, run `docker compose up -d redis` and set `REDIS_URL` in `openem_backend/.env`.

## Backend

In `openem_backend/`:

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run db:import:enem
npm run db:classify:keywords
npm run db:seed:flashcards
npm run start:dev
```

In `openem_backend/.env`, the password in `DATABASE_URL` is the same as `POSTGRES_PASSWORD`. The API starts at `http://localhost:3000`, with Swagger at `http://localhost:3000/api` and the healthcheck at `/health`.

The import downloads the whole dataset the first time. For a faster cycle, import a single exam:

```bash
npm run db:import:enem -- --exam=2023
```

After changing `prisma/schema.prisma`, create the migration (the command also regenerates the client):

```bash
npx prisma migrate dev --name <name-of-the-change>
```

> **Warning:** the exam import must never run inside `seed.ts`. The e2e suite runs the seed on every run.

Changed a route, a DTO or an `@ApiOperation`? Regenerate the [API reference](/docs/en/contribuir/api/) and commit the file along with it:

```bash
npm run openapi
```

The command builds the OpenAPI document without starting the server or opening the database and writes `openem_site/src/docs/api/openapi.json`. CI runs `npm run openapi -- --check` and fails if the file is out of date.

## Frontend

In `openem_frontend/`:

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173/app/` and forwards `/api`, `/health` and `/media` to `http://localhost:3000`. To point to another API, set `VITE_PROXY_TARGET`.

## Site and documentation

In `openem_site/`:

```bash
npm install
npm run dev
```

The site opens at `http://localhost:5174`, with the documentation at `/docs/`. Links to the app use `VITE_APP_URL`, which the site's `.env.development` points to the app at `http://localhost:5173/app/`.

## Tests

### Backend

```bash
npm test
npm run test:e2e
npm run test:cov
npx jest -t "part of the test name"
```

- `npm test` runs the Jest unit tests (`*.spec.ts` in `src/`). They do not open a database connection.
- `npm run test:e2e` needs Postgres. It uses the database at `DATABASE_URL` (or `E2E_DATABASE_URL`), but always in the `test_e2e` schema: it drops that schema, applies the migrations and runs the seed with the demo content. Development data, in the `public` schema, is not touched. The import and classification scripts refuse to run against `test_e2e`.
- In e2e tests, pick questions through `test/seed-questions.ts`, never "the first one in the database": the import and classification suites create and delete questions in parallel.

### Frontend and site

```bash
npm test
npm run test:cov
```

Both use Vitest. In the frontend, `test:cov` enforces the coverage floor.

### Minimum coverage

| Project | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend | 40% | 35% | 40% | 40% |
| Frontend | 25% | 20% | 18% | 25% |

`npm run test:cov` fails below these numbers, and CI runs that command in both projects. A PR may not lower coverage; the floors go up little by little, towards 80%.

### Mutation testing

```bash
npm run test:mutation
```

Runs Stryker in the backend or the frontend. It is incremental: only the mutants of new or changed code run again, and the state lives in `reports/`. The break threshold is 30% in the backend and 50% in the frontend. It does not run in CI, because a full run takes too long: run it on your machine before a PR that touches domain logic.

### Lint

```bash
npm run lint
```

In the backend, lint applies the automatic fixes (`--fix`), and `npm run format` runs Prettier. In the frontend and the site, `npm run lint` only reports the problems.

## CI

The [workflow](https://github.com/migueldsants/OpENEM/blob/main/.github/workflows/ci.yml) runs on pushes to `main`, `feature/**` and `fix/**` and on every pull request:

- **backend:** lint, build, OpenAPI up to date, unit tests, coverage and e2e against PostgreSQL 17 and Valkey (Redis);
- **frontend:** lint, tests, coverage and build;
- **site:** lint, tests, prerendered build and the check of the build's internal links (`npm run check:links`);
- **docker:** build of the backend and frontend images.

## Conventions

- Create the branch from `main`, named `feature/<name>` or `fix/<name>`. Never commit directly to `main`: changes go in through pull requests.
- Messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- A logic change comes with a test.
- The documentation is written in Portuguese. The English mirrors live in `.github/docs/` (`README-EN.md`, `CONTRIBUTING-EN.md`, `SECURITY-EN.md`) and, on the site, in `openem_site/src/docs/conteudo/en/`: when you edit a document or a hosting or contributing page, update both.
- The project is licensed under the [AGPL-3.0](https://github.com/migueldsants/OpENEM/blob/main/LICENSE). By contributing, you license your contribution under the same terms.

The complete flow, from fork to pull request, is in [CONTRIBUTING-EN.md](https://github.com/migueldsants/OpENEM/blob/main/.github/docs/CONTRIBUTING-EN.md).

## Security

Do not open a public issue to report a vulnerability. Send it by email, to the address in [SECURITY-EN.md](https://github.com/migueldsants/OpENEM/blob/main/.github/docs/SECURITY-EN.md), with the description, the steps to reproduce and the impact.
