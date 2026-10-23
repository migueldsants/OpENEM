---
titulo: Desenvolvimento
descricao: Como rodar o OpENEM na sua máquina, rodar os testes e seguir as convenções do projeto antes de abrir um pull request.
---

## Requisitos

- Node.js 22, a mesma versão do CI e das imagens Docker.
- Docker, para subir o PostgreSQL do compose (qualquer PostgreSQL 17 local também serve).
- Git.

## Banco

Na raiz do repositório, crie o `.env` como na [Instalação](/docs/hospedar/instalacao/) (o compose exige `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `JWT_SECRET`) e suba só o banco:

```bash
cp .env.example .env
docker compose up -d db
```

Ele fica em `127.0.0.1:5432`. O Redis é opcional em desenvolvimento: sem `REDIS_URL`, o backend guarda o cache na própria memória. Para testar com ele, rode `docker compose up -d redis` e defina `REDIS_URL` no `openem_backend/.env`.

## Backend

Em `openem_backend/`:

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

No `openem_backend/.env`, a senha da `DATABASE_URL` é a mesma do `POSTGRES_PASSWORD`. A API sobe em `http://localhost:3000`, com o Swagger em `http://localhost:3000/api` e o healthcheck em `/health`.

O import baixa o dataset inteiro na primeira vez. Para um ciclo mais rápido, importe uma prova só:

```bash
npm run db:import:enem -- --exam=2023
```

Depois de mexer em `prisma/schema.prisma`, crie a migration (o comando também regenera o client):

```bash
npx prisma migrate dev --name <nome-da-mudanca>
```

> **Atenção:** o import das provas nunca pode rodar dentro do `seed.ts`. A suíte e2e roda o seed a cada execução.

Mudou uma rota, um DTO ou um `@ApiOperation`? Regere a [Referência da API](/docs/contribuir/api/) e faça commit do arquivo junto:

```bash
npm run openapi
```

O comando monta o documento OpenAPI sem subir o servidor nem abrir o banco e grava `openem_site/src/docs/api/openapi.json`. O CI roda `npm run openapi -- --check` e quebra se o arquivo ficar desatualizado.

## Frontend

Em `openem_frontend/`:

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173/app/` e repassa `/api`, `/health` e `/media` para `http://localhost:3000`. Para apontar para outra API, defina `VITE_PROXY_TARGET`.

## Site e documentação

Em `openem_site/`:

```bash
npm install
npm run dev
```

O site abre em `http://localhost:5174`, com a documentação em `/docs/`. Os links para o app usam `VITE_APP_URL`, que o `.env.development` do site aponta para o app em `http://localhost:5173/app/`.

## Testes

### Backend

```bash
npm test
npm run test:e2e
npm run test:cov
npx jest -t "trecho do nome do teste"
```

- `npm test` roda os testes de unidade do Jest (`*.spec.ts` em `src/`). Eles não abrem conexão com banco.
- `npm run test:e2e` precisa do Postgres. Ele usa o banco da `DATABASE_URL` (ou de `E2E_DATABASE_URL`), mas sempre no schema `test_e2e`: apaga esse schema, aplica as migrations e roda o seed com o conteúdo de demonstração. Os dados de desenvolvimento, no schema `public`, não são tocados. Os scripts de import e de classificação se recusam a rodar contra o `test_e2e`.
- Nos testes e2e, escolha questões por `test/seed-questions.ts`, nunca "a primeira do banco": as suítes de import e classificação criam e apagam questões em paralelo.

### Frontend e site

```bash
npm test
npm run test:cov
```

Os dois usam Vitest. No frontend, `test:cov` cobra o piso de cobertura.

### Cobertura mínima

| Projeto | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Backend | 40% | 35% | 40% | 40% |
| Frontend | 25% | 20% | 18% | 25% |

`npm run test:cov` falha abaixo desses números, e o CI roda esse comando nos dois projetos. Um PR não pode baixar a cobertura; os pisos sobem aos poucos, rumo a 80%.

### Mutation testing

```bash
npm run test:mutation
```

Roda o Stryker no backend ou no frontend. É incremental: só os mutantes de código novo ou alterado rodam de novo, e o estado fica em `reports/`. O limite de quebra é 30% no backend e 50% no frontend. Ele não roda no CI, porque uma execução completa leva muito tempo: rode na sua máquina antes de um PR que mexa em lógica de domínio.

### Lint

```bash
npm run lint
```

No backend, o lint aplica as correções automáticas (`--fix`), e `npm run format` roda o Prettier. No frontend e no site, `npm run lint` só aponta os problemas.

## CI

O [workflow](https://github.com/migueldsants/OpENEM/blob/main/.github/workflows/ci.yml) roda em push para `main`, `feature/**` e `fix/**` e em todo pull request:

- **backend:** lint, build, OpenAPI em dia, testes de unidade, cobertura e e2e contra um PostgreSQL 17 e um Valkey (Redis);
- **frontend:** lint, testes, cobertura e build;
- **site:** lint, testes, build pré-renderizado e a conferência dos links internos do build (`npm run check:links`);
- **docker:** build das imagens do backend e do frontend.

## Convenções

- Crie a branch a partir da `main`, com o nome `feature/<nome>` ou `fix/<nome>`. Nunca faça commit direto na `main`: a mudança entra por pull request.
- Mensagens no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- Mudança de lógica vem com teste.
- A documentação é escrita em português. Os espelhos em inglês ficam em `.github/docs/` (`README-EN.md`, `CONTRIBUTING-EN.md`, `SECURITY-EN.md`) e, no site, em `openem_site/src/docs/conteudo/en/`: ao editar um documento ou uma página de hospedagem e contribuição, atualize os dois.
- O projeto é licenciado sob a [AGPL-3.0](https://github.com/migueldsants/OpENEM/blob/main/LICENSE). Ao contribuir, você licencia sua contribuição nos mesmos termos.

O fluxo completo, de fork a pull request, está no [CONTRIBUTING.md](https://github.com/migueldsants/OpENEM/blob/main/CONTRIBUTING.md).

## Segurança

Não abra issue pública para relatar vulnerabilidade. Envie por e-mail, para o endereço que está no [SECURITY.md](https://github.com/migueldsants/OpENEM/blob/main/SECURITY.md), com a descrição, os passos para reproduzir e o impacto.
