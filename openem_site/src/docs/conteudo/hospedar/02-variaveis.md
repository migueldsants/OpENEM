---
titulo: Variáveis de ambiente
descricao: Todas as variáveis de ambiente que o OpENEM lê, com o valor padrão e o efeito de cada uma, agrupadas por assunto.
---

## Onde cada variável é definida

- **`.env` da raiz** (modelo: [.env.example](https://github.com/migueldsants/OpENEM/blob/main/.env.example)): lido pelo Docker Compose.
- **`openem_backend/.env`** (modelo: [openem_backend/.env.example](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/.env.example)): lido pelo backend quando ele roda fora do Docker, em desenvolvimento.

O compose não repassa o `.env` inteiro ao backend, só as variáveis listadas em `environment` no [docker-compose.yml](https://github.com/migueldsants/OpENEM/blob/main/docker-compose.yml), e algumas delas com valor fixo. Nas tabelas, "fixo no compose" quer dizer que mudar a variável no `.env` não tem efeito, e "fora do compose" que ela não chega ao container. Para definir uma dessas no Docker, crie um `docker-compose.override.yml` na raiz. O Compose lê esse arquivo sozinho, o git o ignora, e as variáveis dele valem por cima das do `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - THROTTLE_LIMIT=200
      - PDF_CONCURRENCY=2
```

Nas variáveis numéricas (rate limiting, PDF e cotas de IA), valor ausente ou inválido cai no padrão.

## Banco de dados

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | nenhum | Obrigatória no compose. Senha do PostgreSQL, só letras e números. Só vale na criação do volume `pg-data`. |
| `POSTGRES_USER` | `openem` | Usuário do PostgreSQL do compose. |
| `POSTGRES_DB` | `openem` | Nome do banco do compose. |
| `POSTGRES_PORT` | `5432` | Porta do banco publicada em `127.0.0.1`, para o backend de desenvolvimento, `psql` ou `pg_dump` na própria máquina. O backend do compose usa a rede interna. |
| `DATABASE_URL` | nenhum | URL de conexão do Prisma. No compose, é montada com as três variáveis acima; em desenvolvimento, vem do `openem_backend/.env`. |

## Cache (Redis)

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `REDIS_PASSWORD` | nenhum | Obrigatória no compose. Senha do Redis (Valkey), só letras e números. |
| `REDIS_PORT` | `6379` | Porta do Redis publicada em `127.0.0.1`, para o backend de desenvolvimento. O backend do compose usa a rede interna. |
| `REDIS_MAXMEMORY` | `128mb` | Memória máxima do cache. Cheio, ele descarta as chaves menos usadas. |
| `REDIS_URL` | nenhum | URL do Redis, como `redis://:senha@redis:6379`. No compose, é montada com `REDIS_PASSWORD`. Sem ela, o cache fica na memória do processo da API, o que serve para uma instância só. |

O cache guarda o que é igual para todo aluno: matérias, provas, facetas da busca, o detalhe de cada questão e as estrelas da tela Ferramentas. Os scripts de seed, import e classificação o invalidam ao terminar. Se o Redis cair, a API lê do banco e o `/health` mostra `redis: down`, sem mudar o `status`.

## Autenticação

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `JWT_SECRET` | nenhum | Obrigatória no compose. Assina os tokens de login e cifra o cookie da ida e volta do login com Google. Com `NODE_ENV` igual a `production` ou `test`, a API não sobe se ela faltar ou tiver menos de 16 caracteres; fora disso, a API usa um segredo fixo de desenvolvimento. Trocá-la encerra a sessão de todos os alunos. |
| `JWT_EXPIRES_IN` | `7d` | Validade do token de login, como `7d` ou `12h`. |

O token traz a versão de sessão da conta, conferida a cada pedido. Trocar a senha, redefini-la pelo e-mail ou tocar em **Sair de todos os dispositivos** no Perfil invalida na hora todos os tokens já emitidos para aquela conta, sem esperar o `JWT_EXPIRES_IN`.

## E-mail e login com Google

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `SMTP_URL` | nenhum | Servidor de e-mail da recuperação de senha, como `smtps://usuario:senha@smtp.exemplo.com:465` (TLS direto) ou `smtp://usuario:senha@smtp.exemplo.com:587` (STARTTLS). Sem ela, `POST /auth/forgot-password` responde 503 e a tela de entrada esconde o **Esqueci minha senha**. |
| `MAIL_FROM` | nenhum | Remetente do e-mail, como `OpENEM <nao-responda@openem.exemplo>`. Vale só junto com `SMTP_URL`. |
| `GOOGLE_CLIENT_ID` | nenhum | ID do cliente OAuth do Google. Com `GOOGLE_CLIENT_SECRET`, liga o botão **Entrar com Google**. |
| `GOOGLE_CLIENT_SECRET` | nenhum | Segredo do cliente OAuth do Google. |

Os dois recursos são opcionais e precisam da `SITE_URL`: o link do e-mail e o endereço de volta do Google saem dela. Variável definida pela metade desliga o recurso e deixa um aviso no log da API ao subir. O passo a passo, com a tela de consentimento do Google, está em [E-mail e login com Google](/docs/hospedar/email-e-google/).

## Servidor e proxy

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API. Fixo no compose. |
| `NODE_ENV` | nenhum (`production` na imagem Docker) | `production` desliga o Swagger em `/api` e exige um `JWT_SECRET` válido. Fixo no compose. |
| `TRUST_PROXY` | nenhum (não confia em proxy) | Número de proxies à frente da API (`1`) ou lista de endereços e sub-redes (`loopback, 10.0.0.0/8`). `true` é recusado e impede a API de subir. Fixo em `1` no compose; veja [Produção](/docs/hospedar/producao/). |
| `CORS_ORIGINS` | nenhum | Origens liberadas no CORS, separadas por vírgula. Sem valor, a API aceita requisições de qualquer origem. Fora do compose. |
| `SITE_URL` | nenhum | Domínio público da instalação, como `https://openem.exemplo`. Entra no build da imagem do frontend, onde gera o `sitemap.xml` e deixa absolutas as URLs do Open Graph, e o backend monta com ela o link do e-mail de redefinição de senha e o endereço de volta do login com Google. Sem ela, o site sai sem sitemap e com URLs relativas, e esses dois recursos ficam desligados (fora de produção, o backend usa `http://localhost:5173`). Trocar exige `docker compose up --build`. |

## Rate limiting

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `THROTTLE_TTL_MS` | `60000` | Janela do limite padrão, em milissegundos. Fora do compose. |
| `THROTTLE_LIMIT` | `100` | Requisições permitidas por janela, contadas por rota e por aluno (por IP sem login). Fora do compose. |
| `THROTTLE_BURST_TTL_MS` | `1000` | Janela da rajada curta, em milissegundos. Fora do compose. |
| `THROTTLE_BURST_LIMIT` | `20` | Requisições permitidas na rajada, por rota e por aluno. Fora do compose. |
| `THROTTLE_KEY_PREFIX` | nenhum | Separa no Redis os contadores de duas instalações que usam o mesmo servidor. Instâncias da mesma instalação devem usar o mesmo valor. Fora do compose. |

Esses são os limites padrão. As rotas caras (cadastro, login, PDF, IA, escrita no fórum e nos temas) têm limites próprios no código, que essas variáveis não mudam; a tabela está em [Produção](/docs/hospedar/producao/). Os contadores ficam no Redis da `REDIS_URL`.

## IA

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `AI_PROVIDER` | detecção automática | `anthropic`, `openai`, `openai-compatible` ou `gemini`. Vale para o comentário de questão e a classificação de assunto. |
| `AI_EXPLANATION_MODEL` | modelo do provedor | Modelo do comentário de questão. Fora do compose. |
| `AI_CLASSIFY_MODEL` | modelo do provedor | Modelo do script de classificação de assunto. Fora do compose. |
| `ANTHROPIC_API_KEY` | nenhum | Chave da Anthropic (Claude). |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Modelo padrão da Anthropic. |
| `OPENAI_API_KEY` | nenhum | Chave da OpenAI. No modo compatível, é opcional. |
| `OPENAI_MODEL` | `gpt-4o` na OpenAI, `llama3.1` no modo compatível | Modelo padrão da OpenAI e do endpoint compatível. |
| `OPENAI_BASE_URL` | nenhum | Base URL de um endpoint compatível com a API da OpenAI (Ollama, Groq, OpenRouter, LM Studio, vLLM). Habilita o provedor `openai-compatible`. |
| `GEMINI_API_KEY` | nenhum | Chave do Google Gemini. |
| `GOOGLE_API_KEY` | nenhum | Alternativa a `GEMINI_API_KEY`, usada quando ela não está definida. Fora do compose; no Docker, use `GEMINI_API_KEY`. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo padrão do Gemini. |

> **Atenção:** quando `ANTHROPIC_MODEL`, `OPENAI_MODEL` ou `GEMINI_MODEL` faltam no `.env`, o compose as repassa vazias, e o backend usa o valor vazio em vez do padrão da tabela. No Docker, defina sempre o modelo do provedor que você configurar.

Detalhes em [Inteligência artificial](/docs/hospedar/ia/).

## Cotas de IA

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `AI_EXPLANATION_DAILY_LIMIT` | `30` | Comentários de questão gerados por aluno, numa janela de 24 horas. Abrir um comentário já gravado não conta. `0` desliga esse limite. |
| `AI_DAILY_LIMIT` | `0` (sem teto) | Teto global: soma das chamadas pagas de todos os alunos em 24 horas. |

## PDF

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PDF_CONCURRENCY` | `1` | Quantos PDFs são desenhados ao mesmo tempo, cada um numa worker thread. Mínimo 1. Fora do compose. |
| `PDF_MAX_QUEUE` | `8` | Quantos pedidos podem esperar na fila. Acima disso, a API responde 503 na hora. Mínimo 0. Fora do compose. |
| `PDF_TIMEOUT_MS` | `60000` | Tempo-limite de cada desenho, em milissegundos; estourado, a API responde 503. Mínimo 1000. Fora do compose. |

A fila vale para o caderno de simulado e o caderno de fórmulas. Aumente `PDF_CONCURRENCY` só se o servidor tiver núcleos sobrando.

## Import e dados

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `AUTO_IMPORT` | ligado (`1` no compose) | Liga o bootstrap da primeira subida do container (seed, import, classificação por palavra-chave e flashcards). `0`, `false`, `off` ou `no` desligam. |
| `ENEM_DATASET_DIR` | `prisma/.enem-dataset` | Onde o import guarda o dataset baixado. Fixo em `/data/enem-dataset` no compose. |
| `ENEM_MEDIA_DIR` | `public/enem` | Onde ficam as imagens das questões, servidas pela API em `/media/enem/`. Fixo em `/data/enem-media` no compose. |
| `SEED_DEMO` | nenhum | Com `1`, o seed cria o conteúdo de demonstração da suíte e2e (6 questões e 2 simulados). Fora do compose. |

Os caminhos padrão são relativos a `openem_backend/`.
