---
titulo: Arquitetura
descricao: Como o repositório do OpENEM é organizado: a API NestJS, o app React, o site de documentação e onde fica cada tipo de código.
---

## O repositório

| Pasta | O que tem |
| --- | --- |
| `openem_backend/` | API NestJS com Prisma e PostgreSQL. |
| `openem_frontend/` | O app: React, Vite e Tailwind v4, como PWA. |
| `openem_site/` | A landing page e esta documentação. |
| `tools/enem-fix/` | Scripts que consertam o dataset das provas e geram o catálogo de redações. |
| `docs/` | O PRD, com as decisões de produto e arquitetura. |
| `.github/` | CI, modelos de issue e PR e os espelhos em inglês da documentação. |

Cada projeto tem o próprio `package.json`: os comandos `npm` rodam de dentro da pasta dele. O `docker-compose.yml` da raiz junta banco, backend e frontend.

## Backend

### Entrada

- [`src/main.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/main.ts) põe as rotas de domínio sob o prefixo `api/v1` (a raiz `/` e `/health` ficam fora), liga o `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` (toda entrada passa por DTOs com `class-validator`), aplica o helmet, serve as imagens das questões em `/media/enem/` e monta o Swagger em `/api` quando `NODE_ENV` não é `production`.
- [`src/app.module.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/app.module.ts) importa os módulos e registra o rate limiting global. Módulo novo entra no array `imports`; prefira gerar com `npx nest g module <nome>`.
- O `PrismaModule` é global: injete o `PrismaService` em qualquer serviço sem importá-lo de novo.

### Módulos

- **Conta:** `auth` (cadastro e login com JWT) e `users` (perfil de estudo e perfil público).
- **Banco de questões:** `subjects` (áreas, matérias e assuntos), `questions` (inclui o comentário sob demanda por IA), `question-notes` e `favorites`.
- **Estudo:** `answers`, `simulations` (simulados, por prova ou por tema, e o caderno em PDF), `review` (revisão espaçada SM-2), `recommendation`, `performance`, `study-plan`, `weekly-goals` e `pomodoro`.
- **Materiais:** `flashcards`, `formulas` (com o caderno de fórmulas em PDF), `videos` e `tools` (a lista da tela Ferramentas, com as estrelas do GitHub).
- **Progresso e comunidade:** `gamification` (XP, nível, liga, sequência, conquistas, desafio diário), `community` (fórum) e `themes` (temas de cor dos alunos).
- **Infraestrutura:** `prisma`, `health` e `ai-usage` (cotas das chamadas pagas de IA).
- **`essays`:** envio de redação e correção por rubrica. Continua na API, mas o app não tem tela para ele.

### Lógica pura em src/common

Regra de negócio que não depende de banco nem de rede fica em `src/common/`, com um `.spec.ts` ao lado. Alguns exemplos: `spaced-repetition.ts` (SM-2), `gamification.ts`, `irt.ts` (nota TRI), `simulation-filters.ts`, `simulation-answers.ts`, `sampling.ts`, `ai-quota.ts`, `trust-proxy.ts`, `enem-import/mapping.ts` e `classification/heuristic.ts`. Os serviços dos módulos chamam essas funções e cuidam do Prisma.

O `rootDir` do Jest é `src/`. Por isso lógica testável não mora em `prisma/`: os scripts de lá (seed, import, classificação) importam de `src/common/`. Duas subpastas merecem nota:

- `src/common/ai/` é a camada de provedores de IA (escolha do provedor e uma chamada que devolve JSON). O comentário de questão e a classificação de assunto passam por ela.
- `src/common/pdf/` desenha os PDFs com PDFKit. Todo PDF passa pela fila do `PdfRenderService`, que desenha cada um numa worker thread, porque o desenho é CPU síncrona e travaria a API. Não chame as funções de desenho direto de um serviço.

### Banco

- Prisma 6, fixado. O Prisma 7 muda o modelo de configuração; não atualize sem migrar para ele.
- PostgreSQL em todo lugar: desenvolvimento, CI, e2e e produção. Schema em `prisma/schema.prisma`, migrations em `prisma/migrations/`.
- Evite SQL cru. Busca de texto usa `mode: 'insensitive'`, porque o `contains` do Postgres diferencia maiúsculas.
- Selecione alternativas sempre por `src/questions/question.select.ts`, que garante a ordem por `position`.
- Questão oficial pode ter `topicId` e `explanation` nulos: todo código que lê questão precisa aceitar os dois.

## Frontend

| Caminho | O que tem |
| --- | --- |
| `src/App.tsx` | As rotas (React Router). |
| `src/pages/` | Uma tela por arquivo: Home, Questoes, Simulados, Revisao, Redacoes, Temas e as demais. |
| `src/components/` | Peças reutilizáveis. |
| `src/lib/` | Lógica pura, com `*.test.ts` ao lado. |
| `src/api.ts` | Cliente da API, com base em `/api/v1`. |
| `src/offline/` | Fila de ações feitas sem rede. |
| `src/data/redacoes.json` | Catálogo estático das propostas de redação. |
| `src/themes.css`, `src/theme.tsx` | Temas de cor; veja [Temas de cor](/docs/contribuir/temas/). |
| `nginx.conf` | Servidor de produção, com a CSP. |

O PWA usa `vite-plugin-pwa`. O service worker guarda as leituras da API (rede primeiro, cache como reserva) e as imagens das questões (cache primeiro, porque o nome do arquivo nunca muda), para o app funcionar com internet limitada.

## O site (openem_site)

O `openem_site/` é um projeto React + Vite separado do app, com a landing em `/` e a documentação em `/docs/`.

- **Pré-renderizado.** `npm run build` gera o bundle do navegador, um bundle de servidor (`src/entry-server.tsx`) e roda `scripts/prerender.mjs`, que grava um HTML estático por página. O texto aparece antes de o JavaScript carregar, e buscadores leem a página inteira.
- **Mesma aparência do app.** O CSS do site importa o `index.css` do app (tokens, temas e componentes), e o build reaproveita `theme-boot.js` e `icon.svg` de `openem_frontend/public/`. Um tema novo no app chega ao site sem cópia de arquivo.
- **Dados do app.** A landing lê, no build, o catálogo de redações do app para listar os temas por ano.
- **Páginas da documentação.** São arquivos Markdown em `src/docs/conteudo/<grupo>/NN-slug.md`, com cabeçalho `titulo` e `descricao`; o número só ordena, e a URL é `/docs/<grupo>/<slug>/`. O teste `src/docs/conteudo.test.ts` exige título e descrição, proíbe título de nível 1 e travessão no corpo e confere se os links internos apontam para páginas que existem.

Para rodar o site e o resto do projeto na sua máquina, veja [Desenvolvimento](/docs/contribuir/desenvolvimento/).
