# OpENEM

[Read in English](.github/docs/README-EN.md)

OpENEM é uma plataforma gratuita e de código aberto desenvolvida para revolucionar a preparação de estudantes para o ENEM. Oferecemos um ambiente completo de estudos com questões comentadas, simulados realistas e ferramentas inteligentes de acompanhamento de desempenho.

## Tecnologias

Este projeto é desenvolvido com as seguintes tecnologias principais:

*   **[Node.js](https://nodejs.org/)**: Ambiente de execução JavaScript.
*   **[TypeScript](https://www.typescriptlang.org/)**: Linguagem que adiciona tipagem estática ao JavaScript.
*   **[NestJS](https://nestjs.com/)**: Framework progressivo para construção de aplicações server-side eficientes e escaláveis.
*   **[Prisma](https://www.prisma.io/)**: ORM e ferramenta de migrations, sobre **PostgreSQL**.
*   **[React](https://react.dev/) + [Vite](https://vitejs.dev/)**: Frontend web responsivo (PWA *mobile-first*).
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS utilitário para estilização rápida.
*   **[Swagger](https://swagger.io/)**: Ferramenta para design e documentação de APIs.
*   **[Docker](https://www.docker.com/) + Docker Compose**: Orquestração local e empacotamento dos serviços.
*   **[GitHub Actions](https://github.com/features/actions)**: CI/CD com lint, testes automatizados e build de imagens.

## Planejamento

O planejamento completo da aplicação — frontend, backend, modelo de dados, infraestrutura de CI/CD em Docker e estratégia de testes — está documentado no **[PRD (Documento de Requisitos de Produto)](docs/PRD.md)**, construído a partir de pesquisa primária com o público-alvo.

## Estrutura do repositório

*   `openem_backend/` — API NestJS + Prisma (todos os comandos `npm`/`nest` rodam aqui dentro).
*   `openem_frontend/` — aplicação web React + Vite + Tailwind (PWA *mobile-first*), servida em `/app/`.
*   `openem_site/` — site público: a página do projeto em `/` e a documentação em `/docs/`, em HTML estático.
*   `docs/` — documentação de produto e arquitetura (ver [PRD](docs/PRD.md)).
*   `.github/` — templates, espelhos em inglês da documentação e workflows de CI/CD.

## Documentação

O guia completo está no site do projeto, em `/docs/` de qualquer instalação (no ar localmente em <http://localhost:8080/docs/>), com o código em [`openem_site/src/docs/conteudo/`](openem_site/src/docs/conteudo/): como usar cada tela do app, como hospedar (variáveis, IA, proxy, backup), como contribuir e a referência da API, gerada do código. As páginas de hospedagem e contribuição também estão em inglês, em `/docs/en/`.

## Como executar

### Opção A — Docker Compose (tudo de uma vez)

Requer Docker. Na raiz do repositório, copie `.env.example` para `.env` e
preencha `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `JWT_SECRET` (as três são
obrigatórias). Depois:

```bash
docker compose up --build
```

*   API: <http://localhost:3000> · Healthcheck: <http://localhost:3000/health> (o Swagger fica desligado no compose, que roda com `NODE_ENV=production`)
*   Site (landing e documentação): <http://localhost:8080> · App: <http://localhost:8080/app/>

O compose sobe um **PostgreSQL 17** (serviço `db`, volume nomeado `pg-data`) e
um **Valkey 8** (serviço `redis`, o cache da API, sem persistência), espera os
dois ficarem prontos e aplica as migrations no start do backend. Na
primeira subida, com o banco ainda sem questões, o backend o popula sozinho:
seed, import das provas oficiais (baixa o dataset, precisa de internet),
classificação por palavra-chave e flashcards (`prisma/bootstrap.ts`, alguns
minutos). Nas subidas seguintes isso não roda de novo; para atualizar depois,
rode os comandos abaixo dentro do container. `AUTO_IMPORT=0` no `.env`
desliga o import automático.

### Opção B — Desenvolvimento local

O banco é sempre PostgreSQL. O jeito mais simples é subir só o serviço `db` do
compose (com o `.env` da raiz preenchido, como na opção A); ele fica publicado
apenas em `127.0.0.1:5432`.

```bash
docker compose up -d db
```

**Backend** (em `openem_backend/`):

```bash
cp .env.example .env        # DATABASE_URL com a senha do POSTGRES_PASSWORD; ajuste JWT_SECRET
npm install
npx prisma migrate dev      # aplica as migrations no Postgres
npm run db:seed             # (opcional) dados de demonstração
npm run start:dev           # API em http://localhost:3000 · Swagger em http://localhost:3000/api
```

Sem `REDIS_URL` o backend usa um cache na memória do próprio processo, o que
basta em dev. Para testar com o Redis, suba `docker compose up -d redis` e
defina `REDIS_URL` no `openem_backend/.env` (ver `.env.example`).

A suíte e2e (`npm run test:e2e`) usa o mesmo Postgres do `DATABASE_URL`, num
schema próprio (`test_e2e`) que ela apaga e recria a cada execução; os dados de
dev no schema `public` não são tocados. Os testes de unidade não usam banco.

**Frontend** (em `openem_frontend/`):

```bash
npm install
npm run dev                 # http://localhost:5173/app/ (faz proxy de /api para o backend)
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

No Docker, a primeira subida já faz o import. Para atualizar depois (dataset
novo), rode dentro do container — a imagem não tem ts-node, então os scripts
rodam compilados, de `dist-scripts/`; as questões vão para o Postgres e as
imagens para o volume `enem-media`:

```bash
docker compose exec backend node dist-scripts/prisma/import-enem.js --refresh
```

Os outros scripts seguem o mesmo caminho: `seed.js`, `classify-heuristic.js`,
`classify-catalog.js`, `seed-flashcards.js`.

As questões oficiais entram classificadas só por **área**. Para o simulado por
tema alcançá-las, há uma classificação **por palavra-chave**, determinística e
sem IA, que roda em segundos e decide o que é evidente pelo vocabulário —
calando-se quando fica em dúvida, porque assunto errado é pior que assunto
nenhum:

```bash
npm run db:classify:keywords -- --dry-run --sample=20  # veja as decisões antes
npm run db:classify:keywords
```

O que a palavra-chave não decide vem do **catálogo de assuntos**
(`prisma/classificacao-assuntos.json`): a classificação feita uma vez pelo
Claude Haiku 5.5 na lista de assuntos de cada área, versionada no repositório
— classificação do OpENEM, não oficial. Ela só preenche questão ainda sem
assunto, ignora o que tiver confiança abaixo de 0,6 e não precisa de chave de
IA. Com as duas etapas, todas as questões oficiais ficam com assunto, menos uma cujo enunciado está truncado no dataset. Banco
novo já sai assim (o container roda as duas na primeira subida); num banco que
já existia, rode:

```bash
npm run db:classify:catalog -- --dry-run  # quantas seriam gravadas
npm run db:classify:catalog
```

Com um provedor de IA configurado, outros dois recursos ficam disponíveis:

*   **Comentário sob demanda**: o botão "Ver comentário" gera a explicação na
    primeira vez que alguém pede e a grava para os próximos.
*   **Classificação por assunto**, que liga revisão espaçada, mapa de calor e
    recomendação às questões oficiais. Use um modelo barato
    (`AI_CLASSIFY_MODEL`):

    ```bash
    npm run db:classify -- --limit=50 --dry-run  # confira as decisões antes
    npm run db:classify
    ```

### Simulados e caderno em PDF

Além das provas oficiais (cada dia, na ordem do caderno e com o tempo oficial),
o aluno monta o **simulado por tema**: áreas, matérias e assuntos se **somam**,
e a tela mostra quantas questões o recorte tem antes de começar. Dá para
restringir a faixa de anos, o nível e treinar só o que ficou pendente ("só
inéditas", "só as que errei", "só favoritas") — e salvar o recorte para refazer
depois.

Qualquer simulado — uma prova oficial, um recorte por tema ou um que você
acabou de resolver — pode ser baixado como **caderno em PDF** no padrão do
ENEM: duas colunas, capa com a marca e a descrição do projeto, cartão-resposta
para preencher à caneta, gabarito no fim e, se você quiser, os comentários. A
cor do caderno é a do tema que você escolher no app (ou uma cor livre).

### Temas de cor

A tela **Temas** reúne as paletas do app, todas com lado claro e escuro (o
botão de sol/lua do topo alterna entre eles): as clássicas, criativas como
Cyberpunk, Synthwave e Terminal (com cantos, fonte de destaque e brilho
próprios, que dá para desligar em "Efeitos visuais") e as pensadas para
telas **OLED**, com preto absoluto no escuro. O aluno também monta o próprio
tema a partir de uma cor, com os dois lados gerados já com contraste de
leitura, salva na conta e, se quiser, publica na **comunidade**, onde os
outros podem usar, copiar e curtir. Um teste confere o contraste (texto,
marca e cores das áreas) de cada paleta pronta.

### Ferramentas

A tela **Ferramentas** lista projetos abertos no GitHub que complementam o
OpENEM: o [corretor de redação do Enem](https://github.com/migueldsants/AI-Skill-Corretor-Redacao-ENEM),
uma skill para agentes de IA que dá nota por competência citando a Matriz de
Referência do Inep, e a [API ENEM atualizada](https://github.com/migueldsants/updated-enem-api),
de onde vem o banco de questões. Cada cartão mostra quantas estrelas o
projeto tem, num botão **Estrela** que leva ao GitHub: é o jeito mais
simples de apoiar. A contagem é buscada pelo servidor, com cache de uma hora.
Para acrescentar um projeto, edite `openem_backend/src/tools/tools-catalog.ts`.

### Testes

```bash
# backend (em openem_backend/)
npm test            # unitários
npm run test:e2e    # end-to-end (no Postgres do DATABASE_URL, schema test_e2e)
```

## Contribuidores

*   **[Miguel dos Santos Miranda](https://github.com/migueldsants)**: criador e mantenedor.
*   **[Claude](https://claude.com/claude-code)** (Claude Code, da Anthropic): assistente de IA que contribui com código, testes e documentação. Os commits dele levam a linha `Co-Authored-By: Claude`.

Quer aparecer aqui? Veja o [guia de contribuição](CONTRIBUTING.md).
