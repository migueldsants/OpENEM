# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpENEM is a free, open-source platform to help students prepare for the ENEM (Brazilian national exam): commented questions, realistic mock exams, and performance-tracking tools.

**Phases 0–3 are implemented (API + UI):**

- **Phase 0 (foundation):** NestJS API with Prisma+SQLite, JWT auth (`auth` + `users` modules), `/health`, Swagger, the full MVP Prisma schema, a React+Vite+Tailwind PWA (`openem_frontend/`), Docker Compose, and a GitHub Actions CI pipeline.
- **Phase 1 (MVP):** domain modules `subjects`, `questions`, `answers`, `simulations`, `performance`, and `review` (SM-2 spaced repetition in `common/spaced-repetition.ts`). The frontend ships the full MVP UI (Home, Questões with question player + XP feedback, Simulados with timer/result, Desempenho with SVG chart, Revisão).
- **Phase 2 (post-MVP):** `favorites`, `study-plan` (auto schedule, `common/study-plan.ts`), `essays` (per-competency rubric grading, `common/essay-score.ts`), IRT/TRI scoring of simulations (`common/irt.ts`, populated only when questions carry calibration params `discrimination`/`irtDifficulty`/`guessing`), and a `focusMode` profile flag. Frontend screens: Cronograma, Favoritos (the essay screen was removed; see **Ferramentas** below).
- **Phase 3 (implemented):** `gamification` — **XP & levels** (quadratic curve), **leagues** (Bronze→Diamond), daily **streak** with a **combo multiplier**, a **daily login bonus**, and achievements (all pure logic + achievement/league catalog in `common/gamification.ts`, models `GamificationStat`/`UserAchievement`). XP is `GamificationStat.points` (level/league/progress are **derived** — no extra columns). Awarded when answering questions (`POST /answers` returns a rich `gamification` delta: `xpGained`/`breakdown`/`level`/`leveledUp`/`league`/`newAchievements`) and gated by the `gamificationEnabled` profile flag. Exposed via `GET /gamification/me` and `GET /gamification/achievements`. The frontend ships a **Progresso** screen (XP bar, league, streak, achievements), a Home widget, XP feedback on answering (`src/pages/Questoes.tsx`), and a profile toggle.

The Phase 1 UI is fully implemented (Home, Questões, Simulados, Desempenho, Revisão) — including an **onboarding** screen (`src/pages/Onboarding.tsx`) that collects goal + minutes/day on first login (the `Profile.onboarded` flag gates the main app until completed).

Phase 3 also adds: a **daily challenge** (deterministic per-day goal, `common/daily-challenge.ts`, claimed reward in `DailyChallengeLog`, exposed via `GET /gamification/daily-challenge` + `POST .../claim`), a **recommendation engine** (`recommendation` module + `common/recommendation.ts`, `GET /recommendation/next` — weak-topic questions from recent errors), **community/forum** (`community` module, `ForumThread`/`ForumPost`, threads + replies), and **AI essay correction** with pluggable providers (`common/essay-ai/`, on top of the generic `common/ai/` layer — Claude/Anthropic, OpenAI, OpenAI-compatible endpoints, and Google Gemini; selected by `ESSAY_AI_PROVIDER` or auto-detected from whichever provider key/URL is set; `POST /essays/submissions/:id/ai-evaluation`, `GET /essays/ai-available` reports availability + the active `provider`; falls back to the manual rubric when no provider is configured). Frontend: **Comunidade** screen, daily-challenge card + "Recomendado para você" on Home.

**Ferramentas (`/ferramentas`):** substituiu a tela de Redação. É uma lista de repositórios abertos no GitHub que complementam o OpENEM (o corretor de redação vive no `AI-Skill-Corretor-Redacao-ENEM`, como skill para agentes de IA); a lista fica no backend, em `src/tools/tools-catalog.ts`, e `GET /tools` a devolve com a contagem de estrelas. As estrelas são buscadas **pelo servidor** (`src/tools/github-stars.ts`), não pelo navegador: o CSP só libera a própria origem e o GitHub não precisa do IP do aluno. O cache dura 1 hora, renova em segundo plano e, se o GitHub falhar, mantém o último valor e tenta de novo em 5 minutos; sem valor, a tela omite a contagem. O catálogo também é a lista do que o servidor aceita consultar, então a rota não vira proxy para qualquer repositório. Cada cartão tem a contagem (leva a `/stargazers`) e o botão "Dar estrela", que abre o repositório numa aba nova. O módulo `essays` do backend continua, mas o app não tem mais tela para ele.

**Simulados (fase atual):** o simulado personalizado é montado **por tema** — área, matéria e assunto se **somam** (união), nunca se cruzam (`src/common/simulation-filters.ts`, puro e testado); cruzar devolvia vazio porque a maior parte do banco oficial não tem assunto. `POST /simulations` aceita template e/ou filtros (`subjectAreaIds`/`subjectIds`/`topicIds`, `examSlugs`, `yearFrom`/`yearTo`, `difficulty`, `unseenOnly`/`wrongOnly`/`onlyFavorites`, `questionCount`, `timeLimitMin`, `pareto`) e `POST /simulations/preview` devolve a contagem do recorte antes de iniciar. O aluno salva recortes como `SimulationTemplate` com `scope: 'CUSTOM'` + `ownerId` + `filters` (JSON); apagar um que já foi feito **arquiva** em vez de excluir, para não derrubar o histórico. O idioma da língua estrangeira vem do perfil quando não é informado. O `start` grava as questões sorteadas em `SimulationQuestion` e o `finish` corrige **só essas** (`src/common/simulation-answers.ts`): questão de fora é descartada e questão não entregue conta em branco — o gabarito é público, então aceitar questão de fora inflava nota, XP e ranking. Simulados anteriores à tabela não têm linhas nela e seguem corrigidos pelo que foi entregue.

**Caderno em PDF:** `POST /simulations/pdf` (por filtros/template) e `POST /simulations/:id/pdf` (de um simulado já feito) devolvem um PDF no padrão ENEM — duas colunas com fluxo real entre colunas/páginas, capa com a marca e a descrição do OpENEM, cartão-resposta, gabarito e comentários opcionais, em qualquer um dos temas de cor do app (`GET /simulations/pdf-themes`) ou numa cor livre (`brandColor`). O desenho vive em `src/common/pdf/` (PDFKit): `simulado-pdf.ts` (layout), `markdown-blocks.ts` (Markdown → blocos, puro e testado) e `themes.ts` (paletas). Imagens saem de `ENEM_MEDIA_DIR`, e só de lá — `resolveImagePath` recusa caminho fora da pasta e formato que o PDFKit não embute.

**Caderno de fórmulas em PDF:** `POST /formulas/pdf` (filtros `formulaIds`/`subjectIds`/`topicIds`/`onlyFavorites`, que se combinam) gera capa, sumário e um cartão por fórmula em grade de linhas — os dois cartões de cada linha têm as faixas internas alinhadas. A fórmula é desenhada como vetor a partir do LaTeX: `src/common/pdf/math-svg.ts` (MathJax → SVG, puro e testado) + `svg-to-pdfkit`, com a fonte Inter embutida do pacote `inter-ui` (WOFF, não WOFF2: o fontkit quebra ao recortar a Inter do WOFF2). A fonte do MathJax não tem letras acentuadas: `normalizeLatex` troca por acentos do TeX (textmacros) e monta a cedilha com glifos do próprio MathJax. No catálogo (`prisma/seed-formulas-lib.ts`), palavra em subscrito vai em `\text{}` e nunca use `\c{}`/`\acute{}` em modo matemático (viram erro vermelho no KaTeX do site); cada entrada é uma fórmula só, e `formerTitle` renomeia o registro antigo no seed em vez de criar outro (preserva favoritos). A fórmula personalizada tem dono (`Formula.ownerId`) e só aparece para ele — o catálogo (`isBuiltIn`) aparece para todos; o título é único por dono (`@@unique([ownerId, title])`), então o seed procura o catálogo por `title` + `ownerId: null` + `isBuiltIn`, nunca só por `title`.

**Temas de cor (tela Temas, `/temas`):** toda família tem `-light` e `-dark`, e os valores vivem em `openem_frontend/src/themes.css` (importado pelo `index.css`). Família nova mexe em **3 lugares**: o bloco no `themes.css`, `FAMILIES` (com `group`: clássicos, criativos, OLED ou acessibilidade) em `src/theme.tsx` e a lista `families` do script de boot no `index.html`. `theme-boot.test.ts` e `theme-palettes.test.ts` seguram os três, e o segundo cobra contraste: `fg` ≥ 7:1, `muted` ≥ 4,5:1, `brand-ink` ≥ 4,5:1 e as cores de área ≥ 4,5:1 sobre as superfícies. O `default` (vermelho) não se mexe. Os seletores `[data-theme=…]` valem em qualquer elemento: a galeria mostra prévias com `<div data-theme>`. Os efeitos dos criativos são tokens (`--radius-*`, `--font-display`) mais o brilho/scanlines em `themes.css`, que somem com `html[data-fx='off']` e com `prefers-contrast: more`. O personalizado é v2 no `localStorage` (`{ v: 2, id?, name, light, dark }`, tema `custom-light`/`custom-dark`); o formato antigo, de um lado só, é migrado ao ler. A geração de paleta fica em `src/lib/theme-derive.ts`, sobre `src/lib/color.ts` (OKLCH + contraste WCAG). No backend, o módulo `themes` (`UserTheme` + `UserThemeLike`) guarda os temas do aluno: publicação opcional, uma curtida por aluno (toggle), sem curtir o próprio tema, e tema de outro aluno responde 404. As cores são **só `#rrggbb`** (`src/common/theme-tokens.ts`), porque vão para `style.setProperty` no navegador de outros alunos, e o frontend revalida antes de aplicar. As paletas de PDF (`src/common/pdf/themes.ts`) não acompanham as famílias novas; um tema desconhecido cai no `default`.

**Catálogo de flashcards:** os decks públicos vivem em `prisma/seed-flashcards-data.json` (área → matéria → subtema, como na tela) e entram com `npm run db:seed:flashcards`, que **sincroniza** em vez de só criar: o deck do catálogo é achado por `userId: null` + `subject` + `title` (ou `formerTitle`, que renomeia sem duplicar), e os cards são casados pela **posição** (`src/common/flashcard-seed.ts`, puro e testado) — corrigir o texto de um card mantém o id e o progresso SM-2 do aluno; card novo vai para o fim do deck. `src/flashcards/seed-flashcards-data.spec.ts` trava estrutura (área, ícone, peso, ≥5 cards, sem frente repetida) e `openem_frontend/src/components/Markdown.seed.test.tsx` renderiza todos os cards com o `<Markdown>` do app. Moeda: fora de fórmula escreva `R\$`; dentro, `\text{R\textdollar{} }` — `R$` solto e `\$` dentro de `$…$` fazem o remark-math abrir/fechar fórmula no lugar errado. Em Humanas e nos temas sociais de Linguagens, conceito controverso é **atribuído ao autor** e debate público aparece com as posições em disputa, sem o card tomar lado.

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
npm run db:seed:flashcards  # sincroniza o catálogo de flashcards (cria decks novos e atualiza os existentes)
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
- Nunca coloque o link da sessão (`Claude-Session: …` ou `https://claude.ai/code/session_…`) em mensagens de commit nem em descrições de PR.
- Branch off `main`; never commit directly to `main`. Use `feature/<name>` or `fix/<name>`.
- Licensed under **AGPL-3.0** — contributions are licensed under the same.
- Security issues are reported by email (see `SECURITY.md`), never via public GitHub issues.
