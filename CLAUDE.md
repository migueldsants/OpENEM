# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpENEM is a free, open-source platform to help students prepare for the ENEM (Brazilian national exam): commented questions, realistic mock exams, and performance-tracking tools.

**Phases 0–3 are implemented (API + UI):**

- **Phase 0 (foundation):** NestJS API with Prisma+SQLite, JWT auth (`auth` + `users` modules), `/health`, Swagger, the full MVP Prisma schema, a React+Vite+Tailwind PWA (`openem_frontend/`), Docker Compose, and a GitHub Actions CI pipeline.
- **Phase 1 (MVP):** domain modules `subjects`, `questions`, `answers`, `simulations`, `performance`, and `review` (SM-2 spaced repetition in `common/spaced-repetition.ts`). The frontend ships the full MVP UI (Home, Questões with question player + XP feedback, Simulados with timer/result, Desempenho with SVG chart, Revisão).
- **Phase 2 (post-MVP):** `favorites`, `study-plan` (auto schedule, `common/study-plan.ts`), `essays` (per-competency rubric grading, `common/essay-score.ts`), IRT/TRI scoring of simulations (`common/irt.ts`, populated only when questions carry calibration params `discrimination`/`irtDifficulty`/`guessing`), and a `focusMode` profile flag. Frontend screens: Cronograma, Redação, Favoritos.
- **Phase 3 (implemented):** `gamification` — **XP & levels** (quadratic curve), **leagues** (Bronze→Diamond), daily **streak** with a **combo multiplier**, a **daily login bonus**, and achievements (all pure logic + achievement/league catalog in `common/gamification.ts`, models `GamificationStat`/`UserAchievement`). XP is `GamificationStat.points` (level/league/progress are **derived** — no extra columns). Awarded when answering questions (`POST /answers` returns a rich `gamification` delta: `xpGained`/`breakdown`/`level`/`leveledUp`/`league`/`newAchievements`) and gated by the `gamificationEnabled` profile flag. Exposed via `GET /gamification/me` and `GET /gamification/achievements`. The frontend ships a **Progresso** screen (XP bar, league, streak, achievements), a Home widget, XP feedback on answering (`src/pages/Questoes.tsx`), and a profile toggle.

The Phase 1 UI is fully implemented (Home, Questões, Simulados, Desempenho, Revisão) — including an **onboarding** screen (`src/pages/Onboarding.tsx`) that collects goal + minutes/day on first login (the `Profile.onboarded` flag gates the main app until completed).

Phase 3 also adds: a **daily challenge** (deterministic per-day goal, `common/daily-challenge.ts`, claimed reward in `DailyChallengeLog`, exposed via `GET /gamification/daily-challenge` + `POST .../claim`), a **recommendation engine** (`recommendation` module + `common/recommendation.ts`, `GET /recommendation/next` — weak-topic questions from recent errors), **community/forum** (`community` module, `ForumThread`/`ForumPost`, threads + replies), and **AI essay correction** with pluggable providers (`common/essay-ai/`, on top of the generic `common/ai/` layer — Claude/Anthropic, OpenAI, OpenAI-compatible endpoints, and Google Gemini; selected by `ESSAY_AI_PROVIDER` or auto-detected from whichever provider key/URL is set; `POST /essays/submissions/:id/ai-evaluation`, `GET /essays/ai-available` reports availability + the active `provider`; falls back to the manual rubric when no provider is configured). Frontend: **Comunidade** screen, daily-challenge card + "Recomendado para você" on Home, and an AI-correct button on Redação.

**Simulados (fase atual):** o simulado personalizado é montado **por tema** — área, matéria e assunto se **somam** (união), nunca se cruzam (`src/common/simulation-filters.ts`, puro e testado); cruzar devolvia vazio porque a maior parte do banco oficial não tem assunto. `POST /simulations` aceita template e/ou filtros (`subjectAreaIds`/`subjectIds`/`topicIds`, `examSlugs`, `yearFrom`/`yearTo`, `difficulty`, `unseenOnly`/`wrongOnly`/`onlyFavorites`, `questionCount`, `timeLimitMin`, `pareto`) e `POST /simulations/preview` devolve a contagem do recorte antes de iniciar. O aluno salva recortes como `SimulationTemplate` com `scope: 'CUSTOM'` + `ownerId` + `filters` (JSON); apagar um que já foi feito **arquiva** em vez de excluir, para não derrubar o histórico. O idioma da língua estrangeira vem do perfil quando não é informado.

**Caderno em PDF:** `POST /simulations/pdf` (por filtros/template) e `POST /simulations/:id/pdf` (de um simulado já feito) devolvem um PDF no padrão ENEM — duas colunas com fluxo real entre colunas/páginas, capa com a marca e a descrição do OpENEM, cartão-resposta, gabarito e comentários opcionais, em qualquer um dos temas de cor do app (`GET /simulations/pdf-themes`) ou numa cor livre (`brandColor`). O desenho vive em `src/common/pdf/` (PDFKit): `simulado-pdf.ts` (layout), `markdown-blocks.ts` (Markdown → blocos, puro e testado) e `themes.ts` (paletas). Imagens saem de `ENEM_MEDIA_DIR`, e só de lá — `resolveImagePath` recusa caminho fora da pasta e formato que o PDFKit não embute.

**Caderno de fórmulas em PDF:** `POST /formulas/pdf` (filtros `formulaIds`/`subjectIds`/`topicIds`/`onlyFavorites`, que se combinam) gera capa, sumário e um cartão por fórmula em grade de linhas — os dois cartões de cada linha têm as faixas internas alinhadas. A fórmula é desenhada como vetor a partir do LaTeX: `src/common/pdf/math-svg.ts` (MathJax → SVG, puro e testado) + `svg-to-pdfkit`, com a fonte Inter embutida do pacote `inter-ui` (WOFF, não WOFF2: o fontkit quebra ao recortar a Inter do WOFF2). A fonte do MathJax não tem letras acentuadas: `normalizeLatex` troca por acentos do TeX (textmacros) e monta a cedilha com glifos do próprio MathJax. No catálogo (`prisma/seed-formulas-lib.ts`), palavra em subscrito vai em `\text{}` e nunca use `\c{}`/`\acute{}` em modo matemático (viram erro vermelho no KaTeX do site); cada entrada é uma fórmula só, e `formerTitle` renomeia o registro antigo no seed em vez de criar outro (preserva favoritos).

**Classificação de assunto:** duas etapas. `npm run db:classify:keywords` (`prisma/classify-heuristic.ts` + `src/common/classification/heuristic.ts`) é determinístico, roda sem chave de IA e classifica ~1/3 do banco; ele **se cala** quando dois assuntos empatam, porque assunto errado contamina revisão, recomendação e desempenho. O que sobra segue para `npm run db:classify` (IA). A origem fica em `Question.classificationSource` (`keywords` | `ai:<provedor>`).

**Official ENEM question bank:** `prisma/import-enem.ts` (+ `-lib.ts`) imports the static dataset of the `enem-api` fork (26 exams, ~4k questions) — the dataset is downloaded to a git-ignored folder, never committed (it is GPL-2.0; this repo is AGPL-3.0). Pure mapping lives in `src/common/enem-import/mapping.ts` (Jest's `rootDir` is `src/`, so testable logic must not live in `prisma/`). Imported questions carry `externalId`/`source`/`language`/`questionPrompt`/`subjectAreaId` and enter with **`topicId: null`** (area only) and **`explanation: null`**; every consumer must tolerate both. Images are served by the backend at `/media/enem/` from `ENEM_MEDIA_DIR` (Docker: `/data/enem-media`, same volume as the DB). `Alternative` has `letter`/`position`/`imageUrl` — always select alternatives via `src/questions/question.select.ts` so the `orderBy: position` is never forgotten. The import must **never** run inside `seed.ts` (the e2e setup runs the seed on every suite). Generic AI provider layer: `src/common/ai/` (`completeJson` + provider selection); essay grading, on-demand explanations (`POST /questions/:id/explanation`) and topic classification (`prisma/classify-questions.ts`) all go through it. Simulations sample by stratum (`src/common/sampling.ts`) instead of loading the whole pool; TRI score stays `null` whenever a simulado includes an uncalibrated (official) question.

**Conserto do dataset (`tools/enem-fix/`):** o dataset do `updated-enem-api` veio de uma extração de PDF e traz defeitos — questões sem o texto das alternativas (quase toda a reaplicação de 2017/2020/2021/2025), enunciado ilegível em 2017 e 2021 (fonte sem mapeamento para Unicode), fórmula virada texto solto, gabarito de espanhol repetindo o do inglês e questões que faltam. A ferramenta refaz essas questões a partir dos cadernos oficiais do INEP: `parse.mjs` lê o caderno por coordenadas, o que não vira texto limpo é recortado como imagem e `gabarito.mjs` lê a resposta pela posição na página (o texto linearizado erra — em 2015 as colunas estão desalinhadas e em 2009 há quatro cadernos lado a lado). Duas travas evitam casar questão errada: a numeração do caderno é conferida contra o dataset, e o gabarito oficial só substitui o do dataset quando concorda com ele em ≥90% da prova. O resultado **não é versionado aqui** (o dataset é GPL-2.0): ele vai para o `updated-enem-api`, senão `db:import:enem --refresh` apaga tudo. Ver `tools/enem-fix/README.md`.

Remaining work: native apps (React Native/Expo) are **out of scope for now** — see `docs/PRD.md` §18. The full application plan (data model, Docker Compose, CI/CD, testing strategy, and phased roadmap) lives in `docs/PRD.md` — consult it for product/architecture decisions before adding domain modules. Target-audience research is in `references/` (gitignored).

The primary language for documentation and API content is **Portuguese**. English mirrors of the docs live in `.github/docs/` (e.g. `README-EN.md`, `CONTRIBUTING-EN.md`, `SECURITY-EN.md`); keep both in sync when editing docs.

## Layout

- `openem_backend/` — NestJS API + Prisma. Run all npm/nest/prisma commands from here.
- `openem_frontend/` — React + Vite + Tailwind (v4) PWA. Run frontend commands from here.
- Root `docker-compose.yml` orchestrates both services (SQLite in a named volume).

## Commands

Backend (run from `openem_backend/`):

```bash
npm install            # install dependencies
npm run start:dev      # run with watch/hot-reload
npm run start:prod     # run compiled build (node dist/main) — requires npm run build first
npm run build          # compile to dist/
npm run lint           # ESLint with --fix over {src,apps,libs,test}
npm run format         # Prettier over src and test
npm test               # Jest unit tests (*.spec.ts under src/)
npm run test:e2e       # e2e tests (creates an isolated SQLite test db, runs migrations)
npm run test:cov       # unit tests with coverage — FAILS below thresholds (issue #47)
npx prisma migrate dev # create/apply a migration against the dev SQLite db
npx prisma generate    # regenerate the Prisma client after editing schema.prisma
npm run db:seed        # seed demo data (prisma/seed.ts)
npm run db:import:enem # import official ENEM exams (downloads the dataset; run after db:seed)
npm run db:classify:keywords  # classificação de assunto por palavra-chave (sem IA)
npm run db:classify    # AI topic classification of imported questions (needs an AI provider)
npx jest -t "substring"               # run tests matching a name
```

Frontend (run from `openem_frontend/`):

```bash
npm install            # install dependencies
npm run dev            # Vite dev server (proxies /api, /health and /media to :3000)
npm run build          # typecheck + production build (generates the PWA service worker)
npm run preview        # serve the production build locally
npm test               # Vitest unit/component tests
npm run test:cov       # same with coverage — FAILS below thresholds (issue #47)
```

Coverage thresholds (issue #47, enforced in CI): new PRs must not reduce coverage below the floor — backend and frontend each run `npm run test:cov` in CI. Current floors: backend 40/35/40/40, frontend 25/20/18/25 (stmts/branches/funcs/lines); raise them gradually toward 80% as suites grow.

Mutation testing (issue #47, part 2): `npm run test:mutation` (Stryker) runs in both jobs with **incremental** files cached in CI (only new/changed mutants run). Break threshold 50% — mutate lists exclude bootstrap, DTOs, modules, visual-style catalogs (lib/areas, lib/gamification, theme, PDF drawing/themes, the keyword catalog) and the board (canvas, low logic value). Raise `break` gradually as suites improve.

Whole stack: `docker compose up --build` from the repo root.

## Runtime

- The app listens on `process.env.PORT ?? 3000` (`src/main.ts`).
- Domain endpoints are under the global prefix `api/v1`; `/` and `/health` are excluded from the prefix. Swagger UI is served at `/api` (with bearer auth) and the OpenAPI doc is built in `src/main.ts`.
- A global `ValidationPipe` (whitelist + transform) is enabled; use `class-validator` DTOs.
- `PrismaModule` is `@Global()` — inject `PrismaService` anywhere without re-importing.
- Config comes from `.env` via `@nestjs/config` (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`); see `.env.example`. Never commit `.env`.
- Rate limiting counts by `req.ip`. Behind a reverse proxy set `TRUST_PROXY` to the number of proxies in front of the API (`src/common/trust-proxy.ts`; Docker Compose uses `1` for the frontend's nginx, which sends `X-Forwarded-For`). Without it every user shares the proxy's IP and one attacker can lock everyone out of login; never enable it without a proxy in front (clients would forge the header) — that is why Compose publishes port 3000 only on `127.0.0.1`.
- New feature modules are added to the `imports` array of `AppModule` (`src/app.module.ts`). Prefer the Nest CLI (`npx nest g module/controller/service <name>`).
- Prisma uses **v6** (pinned): the classic `url = env("DATABASE_URL")` datasource. Do not upgrade to Prisma 7 without migrating to its config-file/driver-adapter model.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, …).
- Branch off `main`; never commit directly to `main`. Use `feature/<name>` or `fix/<name>`.
- Licensed under **AGPL-3.0** — contributions are licensed under the same.
- Security issues are reported by email (see `SECURITY.md`), never via public GitHub issues.
