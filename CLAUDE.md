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

Phase 3 also adds: a **daily challenge** (deterministic per-day goal, `common/daily-challenge.ts`, claimed reward in `DailyChallengeLog`, exposed via `GET /gamification/daily-challenge` + `POST .../claim`), a **recommendation engine** (`recommendation` module + `common/recommendation.ts`, `GET /recommendation/next` — weak-topic questions from recent errors), **community/forum** (`community` module, `ForumThread`/`ForumPost`, threads + replies), and **AI essay correction** with pluggable providers (`common/essay-ai/` — Claude/Anthropic, OpenAI, OpenAI-compatible endpoints, and Google Gemini; selected by `ESSAY_AI_PROVIDER` or auto-detected from whichever provider key/URL is set; `POST /essays/submissions/:id/ai-evaluation`, `GET /essays/ai-available` reports availability + the active `provider`; falls back to the manual rubric when no provider is configured). Frontend: **Comunidade** screen, daily-challenge card + "Recomendado para você" on Home, and an AI-correct button on Redação.

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
npm run test:cov       # unit tests with coverage
npx prisma migrate dev # create/apply a migration against the dev SQLite db
npx prisma generate    # regenerate the Prisma client after editing schema.prisma
npm run db:seed        # seed demo data (prisma/seed.ts)
npx jest -t "substring"               # run tests matching a name
```

Frontend (run from `openem_frontend/`):

```bash
npm install            # install dependencies
npm run dev            # Vite dev server (proxies /api and /health to :3000)
npm run build          # typecheck + production build (generates the PWA service worker)
npm run preview        # serve the production build locally
```

Whole stack: `docker compose up --build` from the repo root.

## Runtime

- The app listens on `process.env.PORT ?? 3000` (`src/main.ts`).
- Domain endpoints are under the global prefix `api/v1`; `/` and `/health` are excluded from the prefix. Swagger UI is served at `/api` (with bearer auth) and the OpenAPI doc is built in `src/main.ts`.
- A global `ValidationPipe` (whitelist + transform) is enabled; use `class-validator` DTOs.
- `PrismaModule` is `@Global()` — inject `PrismaService` anywhere without re-importing.
- Config comes from `.env` via `@nestjs/config` (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`); see `.env.example`. Never commit `.env`.
- New feature modules are added to the `imports` array of `AppModule` (`src/app.module.ts`). Prefer the Nest CLI (`npx nest g module/controller/service <name>`).
- Prisma uses **v6** (pinned): the classic `url = env("DATABASE_URL")` datasource. Do not upgrade to Prisma 7 without migrating to its config-file/driver-adapter model.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, …).
- Branch off `main`; never commit directly to `main`. Use `feature/<name>` or `fix/<name>`.
- Licensed under **AGPL-3.0** — contributions are licensed under the same.
- Security issues are reported by email (see `SECURITY.md`), never via public GitHub issues.
