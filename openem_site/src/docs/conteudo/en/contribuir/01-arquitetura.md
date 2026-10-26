---
titulo: Architecture
descricao: How the OpENEM repository is organized: the NestJS API, the React app, the documentation site and where each kind of code lives.
---

## The repository

| Folder | What it holds |
| --- | --- |
| `openem_backend/` | NestJS API with Prisma and PostgreSQL. |
| `openem_frontend/` | The app: React, Vite and Tailwind v4, as a PWA. |
| `openem_site/` | The landing page and this documentation. |
| `tools/enem-fix/` | Scripts that fix the exam dataset and generate the essay prompt catalog. |
| `docs/` | The PRD, with the product and architecture decisions. |
| `.github/` | CI, issue and PR templates and the English mirrors of the documentation. |

Each project has its own `package.json`: `npm` commands run from inside its folder. The root `docker-compose.yml` brings together the database, Redis, backend and frontend. In an installation, the site sits at the root (`/` and `/docs/`) and the app at `/app/`, served by the same nginx.

## Backend

### Entry point

- [`src/main.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/main.ts) puts the domain routes under the `api/v1` prefix (the root `/` and `/health` stay outside), turns on the global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform` (every input goes through `class-validator` DTOs), applies helmet, serves the question images at `/media/enem/` and mounts Swagger at `/api` when `NODE_ENV` is not `production`.
- [`src/app.module.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/app.module.ts) imports the modules and registers the global rate limiting. A new module goes into the `imports` array; prefer generating it with `npx nest g module <name>`.
- `PrismaModule` is global: inject `PrismaService` in any service without importing it again.

### Modules

- **Account:** `auth` (sign-up with acceptance of the terms, and login with JWT) and `users` (study profile, public profile and the data subject rights of the LGPD: `GET /users/me/export` and `DELETE /users/me`).
- **Question bank:** `subjects` (areas, subjects and topics), `questions` (includes the on-demand AI explanation), `question-notes` and `favorites`.
- **Study:** `answers`, `simulations` (mock exams, by exam or by theme, and the PDF booklet), `review` (SM-2 spaced review), `recommendation`, `performance`, `study-plan`, `weekly-goals` and `pomodoro`.
- **Materials:** `flashcards`, `formulas` (with the formula booklet in PDF), `videos` and `tools` (the list on the Tools screen, with GitHub stars).
- **Progress and community:** `gamification` (XP, level, league, streak, achievements, daily challenge), `community` (forum) and `themes` (students' color themes).
- **Infrastructure:** `prisma`, `health`, `ai-usage` (quotas for paid AI calls), `cache` (the `CacheService`, on Redis or in memory) and `rate-limit` (rate limiting counters in Redis and the per-account wrong-password limit).
- **`essays`:** essay submission and rubric grading. It is still in the API, but the app has no screen for it.

### Pure logic in src/common

Business rules that depend on neither the database nor the network live in `src/common/`, with a `.spec.ts` next to them. Some examples: `spaced-repetition.ts` (SM-2), `gamification.ts`, `irt.ts` (IRT score), `simulation-filters.ts`, `simulation-answers.ts`, `sampling.ts`, `ai-quota.ts`, `trust-proxy.ts`, `enem-import/mapping.ts` and `classification/heuristic.ts`. The module services call these functions and handle Prisma.

Jest's `rootDir` is `src/`. That is why testable logic does not live in `prisma/`: the scripts there (seed, import, classification) import from `src/common/`. Two subfolders deserve a note:

- `src/common/ai/` is the AI provider layer (provider selection and a call that returns JSON). Question explanations and topic classification go through it.
- `src/common/pdf/` draws the PDFs with PDFKit. Every PDF goes through the `PdfRenderService` queue, which draws each one in a worker thread, because drawing is synchronous CPU work and would freeze the API. Do not call the drawing functions directly from a service.

### Database

- Prisma 6, pinned. Prisma 7 changes the configuration model; do not upgrade without migrating to it.
- PostgreSQL everywhere: development, CI, e2e and production. Schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`.
- Avoid raw SQL. Text search uses `mode: 'insensitive'`, because Postgres `contains` is case sensitive.
- Always select alternatives through `src/questions/question.select.ts`, which guarantees the order by `position`.
- An official question may have null `topicId` and `explanation`: every piece of code that reads questions has to accept both.
- Every relation to `User` uses `onDelete: Cascade`, which is what makes account deletion remove everything. A new table linked to the student also goes into the export, in `src/users/data-export.ts`: its test compares the list with the schema and fails until the table is added.

## Frontend

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | The routes (React Router). |
| `src/pages/` | One screen per file: Home, Questoes, Simulados, Revisao, Redacoes, Temas and the others. |
| `src/components/` | Reusable pieces. |
| `src/lib/` | Pure logic, with `*.test.ts` next to it. |
| `src/api.ts` | The API client, based at `/api/v1`. |
| `src/offline/` | Queue of actions taken without a connection. |
| `src/data/redacoes.json` | Static catalog of the essay prompts. |
| `src/themes.css`, `src/theme.tsx` | Color themes; see [Color themes](/docs/en/contribuir/temas/). |
| `nginx.conf` | The production server, with the CSP. |

The PWA uses `vite-plugin-pwa`. The service worker keeps the API reads (network first, cache as a fallback) and the question images (cache first, because the file name never changes), so the app works on a limited connection.

## The site (openem_site)

`openem_site/` is a React + Vite project separate from the app, with the landing page at `/` and the documentation at `/docs/`.

- **Prerendered.** `npm run build` produces the browser bundle, a server bundle (`src/entry-server.tsx`) and runs `scripts/prerender.mjs`, which writes a static HTML file per page. The text shows up before the JavaScript loads, and search engines read the whole page.
- **Same look as the app.** The site CSS imports the app's `index.css` (tokens, themes and components), and the build reuses `theme-boot.js` and `icon.svg` from `openem_frontend/public/`. A new theme in the app reaches the site without copying files.
- **App data.** At build time, the landing page reads the app's essay catalog to list the prompts by year.
- **Documentation pages.** They are Markdown files in `src/docs/conteudo/<group>/NN-slug.md`, with a `titulo` and `descricao` header; the number only sets the order, and the URL is `/docs/<group>/<slug>/`. The test `src/docs/conteudo.test.ts` requires a title and description, forbids level 1 headings and dashes in the body and checks that internal links point to pages that exist.
- **English.** A page's translation lives in `src/docs/conteudo/en/<group>/`, with the same file name, and is published at `/docs/en/<group>/<slug>/`. A page without a translation shows up in Portuguese at the English address, with a notice. The hosting and contributing groups are translated; the student guides stay in Portuguese, the language of the ENEM.
- **Legal pages.** The Privacy Policy and the Terms of Use are Markdown files in `src/legal/conteudo/` (translation in `en/`) and are published at `/privacidade/` and `/termos/` (and `/en/privacidade/`, `/en/termos/`). The `atualizado` header must equal the backend's `TERMS_VERSION`, the version that sign-up stores; `src/legal/documentos.test.ts` checks that and the sections of the policy.
- **API reference.** The [API reference](/docs/en/contribuir/api/) page is built from `src/docs/api/openapi.json`, which the backend generates from its own controllers with `npm run openapi` (without starting the server or the database). CI fails if the file gets out of date.

To run the site and the rest of the project on your machine, see [Development](/docs/en/contribuir/desenvolvimento/).
