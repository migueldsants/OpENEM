# OpENEM

[Read in English](.github/docs/README-EN.md)

OpENEM é uma plataforma gratuita e de código aberto desenvolvida para revolucionar a preparação de estudantes para o ENEM. Oferecemos um ambiente completo de estudos com questões comentadas, simulados realistas e ferramentas inteligentes de acompanhamento de desempenho.

## Tecnologias

Este projeto é desenvolvido com as seguintes tecnologias principais:

*   **[Node.js](https://nodejs.org/)**: Ambiente de execução JavaScript.
*   **[TypeScript](https://www.typescriptlang.org/)**: Linguagem que adiciona tipagem estática ao JavaScript.
*   **[NestJS](https://nestjs.com/)**: Framework progressivo para construção de aplicações server-side eficientes e escaláveis.
*   **[Prisma](https://www.prisma.io/)**: ORM e ferramenta de migrations (atualmente sobre **SQLite**; PostgreSQL planejado para produção).
*   **[React](https://react.dev/) + [Vite](https://vitejs.dev/)**: Frontend web responsivo (PWA *mobile-first*).
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS utilitário para estilização rápida.
*   **[Swagger](https://swagger.io/)**: Ferramenta para design e documentação de APIs.
*   **[Docker](https://www.docker.com/) + Docker Compose**: Orquestração local e empacotamento dos serviços.
*   **[GitHub Actions](https://github.com/features/actions)**: CI/CD com lint, testes automatizados e build de imagens.

## Planejamento

O planejamento completo da aplicação — frontend, backend, modelo de dados, infraestrutura de CI/CD em Docker e estratégia de testes — está documentado no **[PRD (Documento de Requisitos de Produto)](docs/PRD.md)**, construído a partir de pesquisa primária com o público-alvo.

## Estrutura do repositório

*   `openem_backend/` — API NestJS + Prisma (todos os comandos `npm`/`nest` rodam aqui dentro).
*   `openem_frontend/` — aplicação web React + Vite + Tailwind (PWA *mobile-first*).
*   `docs/` — documentação de produto e arquitetura (ver [PRD](docs/PRD.md)).
*   `.github/` — templates, espelhos em inglês da documentação e workflows de CI/CD.

## Como executar

### Opção A — Docker Compose (tudo de uma vez)

Requer Docker. Na raiz do repositório:

```bash
docker compose up --build
```

*   API: <http://localhost:3000> · Swagger: <http://localhost:3000/api> · Healthcheck: <http://localhost:3000/health>
*   Frontend: <http://localhost:8080>

As migrations do banco são aplicadas automaticamente no start do backend; o SQLite é persistido em um volume nomeado.

### Opção B — Desenvolvimento local

**Backend** (em `openem_backend/`):

```bash
cp .env.example .env        # ajuste JWT_SECRET, etc.
npm install
npx prisma migrate dev      # cria o banco SQLite e aplica as migrations
npm run db:seed             # (opcional) dados de demonstração
npm run start:dev           # API em http://localhost:3000
```

**Frontend** (em `openem_frontend/`):

```bash
npm install
npm run dev                 # http://localhost:5173 (faz proxy de /api para o backend)
```

### Questões oficiais do ENEM

O banco de questões vem das provas oficiais do ENEM (INEP), a partir do dataset
aberto do projeto [enem-api](https://github.com/yunger7/enem-api) —
especificamente do fork atualizado
[migueldsants/updated-enem-api](https://github.com/migueldsants/updated-enem-api).
O dataset **não é versionado neste repositório**: o importador o baixa para uma
pasta ignorada pelo git.

```bash
# em openem_backend/, depois do db:seed (a taxonomia precisa existir)
npm run db:import:enem                        # as 26 provas (2009–2025 + reaplicações)
npm run db:import:enem -- --exam=2023         # só uma prova
npm run db:import:enem -- --limit=5 --dry-run # valida sem gravar
```

O import é idempotente: rodar de novo atualiza sem duplicar e não desfaz
comentários nem classificações feitos depois. Questões que o dataset traz
incompletas (sem alternativas, gabarito inconsistente) são recusadas e
listadas no relatório final. As imagens vão para `ENEM_MEDIA_DIR` e são
servidas pelo próprio backend em `/media/enem/`.

No Docker, rode o import dentro do container — banco e imagens ficam no volume:

```bash
docker compose exec backend npx ts-node prisma/import-enem.ts
```

As questões oficiais entram classificadas só por **área**. Com um provedor de
IA configurado (o mesmo da correção de redação), dois recursos ficam
disponíveis:

*   **Comentário sob demanda**: o botão "Ver comentário" gera a explicação na
    primeira vez que alguém pede e a grava para os próximos.
*   **Classificação por assunto**, que liga revisão espaçada, mapa de calor e
    recomendação às questões oficiais. Use um modelo barato
    (`AI_CLASSIFY_MODEL`):

    ```bash
    npm run db:classify -- --limit=50 --dry-run  # confira as decisões antes
    npm run db:classify
    ```

### Testes

```bash
# backend (em openem_backend/)
npm test            # unitários
npm run test:e2e    # end-to-end (cria um banco SQLite de teste isolado)
```
