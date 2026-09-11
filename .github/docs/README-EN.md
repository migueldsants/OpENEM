# OpENEM

[Leia em Português](../../README.md)

OpENEM is a free and open-source platform developed to revolutionize student preparation for the ENEM. We offer a complete study environment with commented questions, realistic simulations, and intelligent performance tracking tools.

## Technologies

This project is developed with the following main technologies:

*   **[Node.js](https://nodejs.org/)**: JavaScript runtime environment.
*   **[TypeScript](https://www.typescriptlang.org/)**: Language that adds static typing to JavaScript.
*   **[NestJS](https://nestjs.com/)**: Progressive framework for building efficient and scalable server-side applications.
*   **[Prisma](https://www.prisma.io/)**: ORM and migrations tool (currently on **SQLite**; PostgreSQL planned for production).
*   **[React](https://react.dev/) + [Vite](https://vitejs.dev/)**: Responsive web frontend (mobile-first PWA).
*   **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework for rapid styling.
*   **[Swagger](https://swagger.io/)**: Tool for API design and documentation.
*   **[Docker](https://www.docker.com/) + Docker Compose**: Local orchestration and service packaging.
*   **[GitHub Actions](https://github.com/features/actions)**: CI/CD with lint, automated tests and image builds.

## Planning

The full application plan — frontend, backend, data model, Dockerized CI/CD infrastructure and testing strategy — is documented in the **[PRD (Product Requirements Document)](../../docs/PRD.md)**, built from primary research with the target audience. (PRD is maintained in Portuguese.)

## Repository structure

*   `openem_backend/` — NestJS API + Prisma (run all `npm`/`nest` commands from here).
*   `openem_frontend/` — React + Vite + Tailwind web app (mobile-first PWA).
*   `docs/` — product and architecture documentation (see the [PRD](../../docs/PRD.md)).
*   `.github/` — templates, English doc mirrors and CI/CD workflows.

## Running it

### Option A — Docker Compose (everything at once)

Requires Docker. From the repository root:

```bash
docker compose up --build
```

*   API: <http://localhost:3000> · Swagger: <http://localhost:3000/api> · Healthcheck: <http://localhost:3000/health>
*   Frontend: <http://localhost:8080>

Database migrations are applied automatically when the backend starts; SQLite is persisted in a named volume.

### Option B — Local development

**Backend** (in `openem_backend/`):

```bash
cp .env.example .env        # adjust JWT_SECRET, etc.
npm install
npx prisma migrate dev      # creates the SQLite database and applies migrations
npm run db:seed             # (optional) demo data
npm run start:dev           # API at http://localhost:3000
```

**Frontend** (in `openem_frontend/`):

```bash
npm install
npm run dev                 # http://localhost:5173 (proxies /api to the backend)
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

With Docker, run the import inside the container — database and images live in
the volume:

```bash
docker compose exec backend npx ts-node prisma/import-enem.ts
```

Official questions come in classified by **area** only. With an AI provider
configured (the same one used for essay grading), two features become
available:

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

### Tests

```bash
# backend (in openem_backend/)
npm test            # unit
npm run test:e2e    # end-to-end (creates an isolated test SQLite database)
```

