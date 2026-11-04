<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/openem-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/openem-logo-light.svg">
    <img alt="OpENEM" src=".github/assets/openem-logo-light.svg" width="320">
  </picture>
</h1>

<p align="center">
  <a href="https://github.com/migueldsants/OpENEM/blob/main/LICENSE"><img alt="Licença AGPL-3.0" src="https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-22c55e?style=flat-square"></a>
  <a href="https://github.com/migueldsants/OpENEM/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/migueldsants/OpENEM/ci.yml?branch=main&amp;style=flat-square&amp;label=CI"></a>
  <a href="https://github.com/migueldsants/OpENEM/commits/main"><img alt="Último commit" src="https://img.shields.io/github/last-commit/migueldsants/OpENEM/main?style=flat-square&amp;label=%C3%BAltimo%20commit&amp;color=0891b2"></a>
  <a href="https://github.com/migueldsants/OpENEM/stargazers"><img alt="Estrelas no GitHub" src="https://img.shields.io/github/stars/migueldsants/OpENEM?style=flat-square&amp;label=estrelas&amp;color=f59e0b"></a>
  <a href="https://openem.tech"><img alt="Site: openem.tech" src="https://img.shields.io/badge/site-openem.tech-d91748?style=flat-square"></a>
  <a href="https://openem.tech/docs/"><img alt="Documentação" src="https://img.shields.io/badge/documenta%C3%A7%C3%A3o-openem.tech%2Fdocs-7C3AED?style=flat-square"></a>
</p>

<p align="center"><a href=".github/docs/README-EN.md">Read in English</a></p>

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

### Tabela periódica

A tela **Tabela periódica** traz os 118 elementos na posição da IUPAC, com os
grupos nas duas numerações (1 a 18 e 1A a 8A) e uma ficha por elemento: massa
atômica com incerteza (CIAAW, revisão de 2024), configuração eletrônica nas
ordens energética e geométrica, elétrons por camada, exceções ao diagrama de
Pauling, propriedades periódicas e físicas, isótopos e um texto sobre a química
do elemento, com a fonte de cada dado. A grade se colore por categoria, bloco,
estado físico numa temperatura escolhida ou por um mapa de calor de uma
propriedade, com as setas das tendências periódicas, e embaixo ficam a
distribuição eletrônica passo a passo (inclusive de íons), a calculadora de
massa molar e a comparação de dois elementos. Funciona offline, no celular
(grade rolável ou lista) e só no teclado.

O catálogo (`openem_frontend/src/data/elementos.json`) é gerado por
`tools/tabela-periodica/` a partir das fontes primárias (CIAAW, NIST, PubChem,
IAEA) e conferido campo a campo contra uma segunda fonte. Para atualizar quando
a CIAAW ou a IUPAC revisarem algo:

```bash
node tools/tabela-periodica/baixar.mjs
node tools/tabela-periodica/montar.mjs
node tools/tabela-periodica/verificar.mjs   # precisa fechar com 0 não explicadas
```

### Testes

```bash
# backend (em openem_backend/)
npm test            # unitários
npm run test:e2e    # end-to-end (no Postgres do DATABASE_URL, schema test_e2e)
```

## Contribuidores

<!-- contribuidores:inicio -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="25%"><a href="https://github.com/migueldsants"><img src="https://avatars.githubusercontent.com/u/117553721?s=100&amp;v=4" width="100" alt="Miguel dos Santos Miranda" /><br /><sub><b>Miguel dos Santos Miranda</b></sub></a><br /><sub><a href="https://github.com/migueldsants">@migueldsants</a></sub><br /><sub>Criador e mantenedor</sub></td>
      <td align="center" valign="top" width="25%"><a href="https://github.com/ruggieroromulo"><img src="https://avatars.githubusercontent.com/u/134303575?s=100&amp;v=4" width="100" alt="Rômulo Ruggiero" /><br /><sub><b>Rômulo Ruggiero</b></sub></a><br /><sub><a href="https://github.com/ruggieroromulo">@ruggieroromulo</a></sub></td>
      <td align="center" valign="top" width="25%"><a href="https://claude.com/claude-code"><img src="https://avatars.githubusercontent.com/u/81847?s=100&amp;v=4" width="100" alt="Claude" /><br /><sub><b>Claude</b></sub></a><br /><sub><a href="https://github.com/claude">@claude</a></sub><br /><sub>Assistente de IA (Claude Code): código, testes e documentação</sub></td>
    </tr>
  </tbody>
</table>
<!-- contribuidores:fim -->

A tabela se atualiza sozinha. Ela sai do histórico de commits da `main`: entra o autor de cada commit e quem aparece nas linhas `Co-authored-by`, quando o e-mail está ligado a uma conta do GitHub (é assim que o Claude, assistente de IA do Claude Code, da Anthropic, aparece). A ordem é a de chegada. O workflow [`contribuidores.yml`](.github/workflows/contribuidores.yml) refaz a tabela a cada push na `main` e toda segunda-feira, e abre um PR quando ela muda; os papéis ficam em [`tools/contribuidores/papeis.json`](tools/contribuidores/papeis.json). Para gerar na hora: `GITHUB_TOKEN=$(gh auth token) node tools/contribuidores/atualizar.mjs`.

Quer aparecer aqui? Veja o [guia de contribuição](CONTRIBUTING.md).
