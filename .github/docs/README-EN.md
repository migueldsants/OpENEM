<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/openem-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="../assets/openem-logo-light.svg">
    <img alt="OpENEM" src="../assets/openem-logo-light.svg" width="320">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/migueldsants/OpENEM/blob/main/LICENSE"><img alt="License AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=flat-square"></a>
  <a href="https://github.com/migueldsants/OpENEM/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/migueldsants/OpENEM/ci.yml?branch=main&amp;style=flat-square&amp;label=CI"></a>
  <a href="https://github.com/migueldsants/OpENEM/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/migueldsants/OpENEM/main?style=flat-square&amp;label=last%20commit&amp;color=0891b2"></a>
  <a href="https://github.com/migueldsants/OpENEM/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/migueldsants/OpENEM?style=flat-square&amp;label=stars&amp;color=f59e0b"></a>
  <a href="https://openem.tech"><img alt="Website: openem.tech" src="https://img.shields.io/badge/site-openem.tech-d91748?style=flat-square"></a>
  <a href="https://openem.tech/docs/en/"><img alt="Documentation" src="https://img.shields.io/badge/docs-openem.tech%2Fdocs%2Fen-7C3AED?style=flat-square"></a>
</p>

<p align="center"><a href="../../README.md">Leia em Português</a></p>

OpENEM is a free and open-source platform developed to revolutionize student preparation for the ENEM. We offer a complete study environment with commented questions, realistic simulations, and intelligent performance tracking tools.

## Technologies

This project is developed with the following main technologies:

*   **[Node.js](https://nodejs.org/)**: JavaScript runtime environment.
*   **[TypeScript](https://www.typescriptlang.org/)**: Language that adds static typing to JavaScript.
*   **[NestJS](https://nestjs.com/)**: Progressive framework for building efficient and scalable server-side applications.
*   **[Prisma](https://www.prisma.io/)**: ORM and migrations tool, on **PostgreSQL**.
*   **[React](https://react.dev/) + [Vite](https://vitejs.dev/)**: Responsive web frontend (mobile-first PWA).
*   **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework for rapid styling.
*   **[Swagger](https://swagger.io/)**: Tool for API design and documentation.
*   **[Docker](https://www.docker.com/) + Docker Compose**: Local orchestration and service packaging.
*   **[GitHub Actions](https://github.com/features/actions)**: CI/CD with lint, automated tests and image builds.

## Planning

The full application plan — frontend, backend, data model, Dockerized CI/CD infrastructure and testing strategy — is documented in the **[PRD (Product Requirements Document)](../../docs/PRD.md)**, built from primary research with the target audience. (PRD is maintained in Portuguese.)

## Repository structure

*   `openem_backend/` — NestJS API + Prisma (run all `npm`/`nest` commands from here).
*   `openem_frontend/` — React + Vite + Tailwind web app (mobile-first PWA), served at `/app/`.
*   `openem_site/` — public site: the project page at `/` and the documentation at `/docs/`, as static HTML.
*   `docs/` — product and architecture documentation (see the [PRD](../../docs/PRD.md)).
*   `.github/` — templates, English doc mirrors and CI/CD workflows.

## Documentation

The full guide lives on the project site, at `/docs/` of any installation (locally at <http://localhost:8080/docs/en/>), with the source in [`openem_site/src/docs/conteudo/`](../../openem_site/src/docs/conteudo/): how to host (variables, AI, proxy, backups), how to contribute and the API reference, generated from the code. The hosting and contributing pages are in English at `/docs/en/`; the student guides are in Portuguese.

## Running it

### Option A — Docker Compose (everything at once)

Requires Docker. From the repository root, copy `.env.example` to `.env` and
fill in `POSTGRES_PASSWORD`, `REDIS_PASSWORD` and `JWT_SECRET` (all three are
required). Then:

```bash
docker compose up --build
```

*   API: <http://localhost:3000> · Healthcheck: <http://localhost:3000/health> (Swagger is off under Compose, which runs with `NODE_ENV=production`)
*   Site (landing and docs): <http://localhost:8080> · App: <http://localhost:8080/app/>

Compose starts a **PostgreSQL 17** (service `db`, named volume `pg-data`) and
a **Valkey 8** (service `redis`, the API cache, no persistence), waits for both
to be ready and applies the migrations when the backend starts.
On the first start, while the database has no questions yet, the backend
populates it by itself: seed, import of the official exams (downloads the
dataset, needs internet), keyword classification and flashcards
(`prisma/bootstrap.ts`, a few minutes). Later starts skip this; to update
afterwards, run the commands below inside the container. `AUTO_IMPORT=0` in
`.env` turns the automatic import off.

### Option B — Local development

The database is always PostgreSQL. The simplest way is to start only the
compose `db` service (with the root `.env` filled in, as in option A); it is
published on `127.0.0.1:5432` only.

```bash
docker compose up -d db
```

**Backend** (in `openem_backend/`):

```bash
cp .env.example .env        # DATABASE_URL with the POSTGRES_PASSWORD password; adjust JWT_SECRET
npm install
npx prisma migrate dev      # applies the migrations to Postgres
npm run db:seed             # (optional) demo data
npm run start:dev           # API at http://localhost:3000 · Swagger at http://localhost:3000/api
```

Without `REDIS_URL` the backend keeps its cache in the process memory, which is
enough for development. To test with Redis, run `docker compose up -d redis`
and set `REDIS_URL` in `openem_backend/.env` (see `.env.example`).

The e2e suite (`npm run test:e2e`) uses the same Postgres as `DATABASE_URL`, in
its own schema (`test_e2e`) that it drops and recreates on every run; dev data
in the `public` schema is left untouched. Unit tests do not use a database.

**Frontend** (in `openem_frontend/`):

```bash
npm install
npm run dev                 # http://localhost:5173/app/ (proxies /api to the backend)
```

### Official ENEM questions

The question bank comes from the official ENEM exams (INEP), via the open
dataset of the [enem-api](https://github.com/yunger7/enem-api) project —
specifically the updated fork
[migueldsants/updated-enem-api](https://github.com/migueldsants/updated-enem-api).
The dataset is **not versioned in this repository**: the importer downloads it
into a git-ignored folder.

```bash
# in openem_backend/, after db:seed (the taxonomy must exist)
npm run db:import:enem                        # all 26 exams (2009–2025 + re-applications)
npm run db:import:enem -- --exam=2023         # a single exam
npm run db:import:enem -- --limit=5 --dry-run # validate without writing
```

The import is idempotent: running it again updates without duplicating and does
not undo explanations or classifications made afterwards. Questions the dataset
ships incomplete (no alternatives, inconsistent answer key) are rejected and
listed in the final report. Images go to `ENEM_MEDIA_DIR` and are served by the
backend itself at `/media/enem/`.

With Docker, the first start already runs the import. To update later (new
dataset), run it inside the container — the image has no ts-node, so the
scripts run compiled, from `dist-scripts/`; questions go to Postgres and images
to the `enem-media` volume:

```bash
docker compose exec backend node dist-scripts/prisma/import-enem.js --refresh
```

The other scripts follow the same path: `seed.js`, `classify-heuristic.js`,
`classify-catalog.js`, `seed-flashcards.js`.

Official questions come in classified by **area** only. So that the by-theme
mock exam can reach them, there is a **keyword** classification pass —
deterministic, no AI, runs in seconds — that decides what the vocabulary makes
obvious and stays silent when in doubt, because the wrong topic is worse than
no topic:

```bash
npm run db:classify:keywords -- --dry-run --sample=20  # review the decisions
npm run db:classify:keywords
```

What the keywords do not decide comes from the **topic catalog**
(`prisma/classificacao-assuntos.json`): a one-off classification by Claude
Haiku 5.5 against each area's topic list, versioned in the repository —
OpENEM's own classification, not official. It fills questions that still
have no topic, replaces keyword decisions made with confidence below 0.70 (in
a manual review, 12% of those were wrong), skips anything below 0.6
confidence and needs no AI key. With
both passes, every official question gets a topic except one whose
statement is truncated in the dataset. A new database comes
out that way (the container runs both on first start); on an existing one,
run:

```bash
npm run db:classify:catalog -- --dry-run  # how many would be written
npm run db:classify:catalog
```

With an AI provider configured, two more features become available:

*   **On-demand explanation**: the "Ver comentário" button generates the
    explanation the first time someone asks for it and stores it for everyone
    else.
*   **Topic classification**, which connects spaced review, the heatmap and
    recommendations to the official questions. Use a cheap model
    (`AI_CLASSIFY_MODEL`):

    ```bash
    npm run db:classify -- --limit=50 --dry-run  # review the decisions first
    npm run db:classify
    ```

### Mock exams and the PDF booklet

Besides the official exams (each day, in booklet order and with the official
time limit), students can build a **by-theme mock exam**: areas, subjects and
topics **add up**, and the screen shows how many questions the selection has
before you start. You can narrow it down by year range and difficulty, train
only what is pending ("unseen only", "the ones I got wrong", "favourites") —
and save the selection to redo it later.

Any mock exam — an official paper, a by-theme selection, or the one you just
finished — can be downloaded as a **PDF booklet** in the ENEM format: two
columns, a cover with the project's brand and description, an answer sheet to
fill in by pen, the answer key at the end and, if you want, the explanations.
The booklet takes the colour theme you pick in the app (or a custom colour).

### Colour themes

The **Temas** screen gathers the app's palettes, all with a light and a dark
side (the sun/moon button at the top switches between them): the classic
ones, creative ones such as Cyberpunk, Synthwave and Terminal (with their own
corners, display font and glow, which can be turned off under "Efeitos
visuais") and ones designed for **OLED** screens, with true black in dark
mode. Students can also build their own theme from a single colour, with
both sides generated at readable contrast, save it to their account and, if
they want, publish it to the **community**, where others can use, copy and
like it. A test checks the contrast (text, brand and subject-area colours) of
every built-in palette.

### Tools

The **Ferramentas** screen lists open projects on GitHub that complement
OpENEM: the [ENEM essay grader](https://github.com/migueldsants/AI-Skill-Corretor-Redacao-ENEM),
a skill for AI agents that scores each competency while quoting INEP's
official reference matrix, and the [updated ENEM API](https://github.com/migueldsants/updated-enem-api),
where the question bank comes from. Each card shows how many stars the
project has, in an **Estrela** (star) button that opens GitHub: the
simplest way to support it. The count is fetched by the server, with a
one-hour cache. To add a project, edit `openem_backend/src/tools/tools-catalog.ts`.

### Periodic table

The **Tabela periódica** screen shows the 118 elements in the IUPAC layout,
with groups in both numberings (1 to 18 and 1A to 8A) and one card per
element: atomic weight with its uncertainty (CIAAW, 2024 revision), electron
configuration in energy and shell order, electrons per shell, exceptions to
the Aufbau (Pauling) diagram, periodic and physical properties, isotopes and
a short text on the element's chemistry, with the source of every value. The
grid can be coloured by category, block, state of matter at a chosen
temperature or a heat map of one property, with arrows for the periodic
trends, and below it sit a step-by-step electron configuration (ions
included), a molar mass calculator and a side-by-side comparison. It works
offline, on a phone (scrollable grid or list) and with the keyboard alone.

The catalog (`openem_frontend/src/data/elementos.json`) is generated by
`tools/tabela-periodica/` from the primary sources (CIAAW, NIST, PubChem,
IAEA) and checked field by field against a second source. To update it when
CIAAW or IUPAC revise something:

```bash
node tools/tabela-periodica/baixar.mjs
node tools/tabela-periodica/montar.mjs
node tools/tabela-periodica/verificar.mjs   # must end with 0 unexplained
```

### Simulations

The **Simulações** screen gathers 36 Physics, Chemistry, Biology, Mathematics
and Geography experiments, in 2D (canvas) and 3D (three.js with React Three Fiber):
projectile motion with air drag, a pendulum without the small-angle
approximation, mass-spring and resonance, inclined plane, buoyancy, circuits
solved by Kirchhoff's laws, a circuit lab the student builds piece by piece,
refraction with Fresnel, lenses and mirrors, the Doppler effect, interference
in a ripple tank, Kepler orbits, a charge in a magnetic field, an ideal gas by
molecular dynamics, titration by charge balance, the N₂O₄ ⇌ 2 NO₂ equilibrium,
molecular geometry with measured angles, crystal structures, galvanic cells
with Nernst and Faraday, radioactive decay, the hydrogen spectrum, DNA with
transcription and translation, predator and prey, genetic drift, the seasons
the phases of the Moon with eclipses, isomerism in 3D, vector addition,
Mendelian crosses with the Punnett square, time zones on a globe and, in
Mathematics, function graphs with draggable points or typed by the student, the unit circle, triangles
and their centers, probability with dice, orthographic projections (the
student builds the solid out of cubes) and nets of solids. Each simulation fits on a computer
screen, with the explanation in a modal. Everything runs on the device, with
no backend.

The models live in `openem_frontend/src/lib/simulacoes/` (pure and tested
against analytic solutions: RK4, leapfrog and the Boris pusher) and the screens
in `openem_frontend/src/components/simulacoes/`. three.js only downloads when a
student opens a 3D scene and stays out of the service worker precache.

### Tests

```bash
# backend (in openem_backend/)
npm test            # unit
npm run test:e2e    # end-to-end (on the DATABASE_URL Postgres, schema test_e2e)
```


## Contributors

<a href="https://github.com/migueldsants/openem/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=migueldsants/openem" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

Want to be listed here? See the [contributing guide](CONTRIBUTING-EN.md).
