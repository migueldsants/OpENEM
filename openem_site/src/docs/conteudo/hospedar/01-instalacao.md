---
titulo: Instalação
descricao: Como subir uma cópia do OpENEM com Docker Compose, o que acontece na primeira subida e onde ficam os dados.
---

O OpENEM roda em quatro containers, orquestrados pelo `docker-compose.yml` da raiz do repositório: o banco PostgreSQL, o cache Redis (Valkey), a API e o nginx com o site e o app web. Esta página vai do clone até a primeira conta criada.

## Requisitos

- Docker com o plugin Compose (o comando `docker compose`, sem hífen).
- Git, para clonar o repositório.
- Internet na primeira subida: o backend baixa do GitHub o dataset das provas, com cerca de 180 MB.
- Espaço em disco para o banco, o dataset e as imagens das questões.

Não é preciso instalar Node.js nem PostgreSQL na máquina: tudo roda dentro dos containers.

## Configurar o .env

```bash
git clone https://github.com/migueldsants/OpENEM.git
cd OpENEM
cp .env.example .env
```

O `.env` da raiz é lido pelo Docker Compose. Três variáveis são obrigatórias, e sem elas o compose para com erro antes de criar qualquer container:

```env
POSTGRES_PASSWORD=<gere com openssl rand -hex 24>
REDIS_PASSWORD=<gere com openssl rand -hex 24>
JWT_SECRET=<gere com openssl rand -hex 32>
```

- `POSTGRES_PASSWORD` é a senha do banco. Use só letras e números: ela entra sem escape na `DATABASE_URL` que o compose monta para o backend. A saída do `openssl rand -hex` já tem esse formato.
- `REDIS_PASSWORD` é a senha do Redis (Valkey), o cache da API. Também só letras e números, pelo mesmo motivo: ela entra na `REDIS_URL`. O cache não guarda nada em disco, então trocar a senha depois não causa problema.
- `JWT_SECRET` assina os tokens de login. Com `NODE_ENV=production`, que é o caso da imagem Docker, a API se recusa a subir se o segredo faltar ou tiver menos de 16 caracteres.

> **Atenção:** a imagem do PostgreSQL só lê `POSTGRES_PASSWORD` quando cria o volume `pg-data`. Trocar a senha no `.env` depois disso não muda a senha do banco, e o backend passa a falhar ao conectar.

As outras variáveis são opcionais e estão em [Variáveis de ambiente](/docs/hospedar/variaveis/).

## Subir

```bash
docker compose up --build
```

Para rodar em segundo plano e acompanhar só o log do backend:

```bash
docker compose up --build -d
docker compose logs -f backend
```

## Serviços e portas

| Serviço | O que é | Porta no host |
| --- | --- | --- |
| `db` | PostgreSQL 17 | `127.0.0.1:5432` (muda com `POSTGRES_PORT`) |
| `redis` | Valkey 8, o cache da API (sem persistência em disco) | `127.0.0.1:6379` (muda com `REDIS_PORT`) |
| `backend` | API NestJS | `127.0.0.1:3000` |
| `frontend` | nginx com o site (`/`, `/docs/`) e o app (`/app/`), repassando `/api/`, `/health` e `/media/` ao backend | `8080`, em todas as interfaces |

O banco, o Redis e a API ficam publicados só em `127.0.0.1`. De outra máquina, o acesso é sempre pela porta 8080; o motivo está em [Produção](/docs/hospedar/producao/).

## O que acontece na primeira subida

A cada início, o container do backend executa, nesta ordem:

1. `prisma migrate deploy`, que aplica as migrations pendentes;
2. o bootstrap (`prisma/bootstrap.ts`, compilado na imagem);
3. a API.

O bootstrap conta as questões oficiais no banco. Se não houver nenhuma, ele roda quatro passos:

1. **seed**: áreas, matérias e assuntos, modelos de simulado, temas de redação e o catálogo de fórmulas;
2. **import das provas oficiais**: baixa o dataset do [updated-enem-api](https://github.com/migueldsants/updated-enem-api), grava as questões no Postgres e copia as imagens para o volume `enem-media`;
3. **classificação por palavra-chave**: dá assunto às questões em que o vocabulário não deixa dúvida, sem IA;
4. **flashcards**: sincroniza o catálogo público de decks.

Isso leva alguns minutos. Nas subidas seguintes, com questões já no banco, o bootstrap não faz nada, a não ser que uma versão nova mude o mapeamento do import: aí ele reimporta as provas em segundo plano, com a API no ar. Para atualizar os dados depois, veja [Produção](/docs/hospedar/producao/#atualizar).

Se um passo falhar (sem internet, por exemplo), o erro aparece no log com o prefixo `[bootstrap]` e a API sobe mesmo assim, sem questões. Como o banco continua sem questões oficiais, o próximo início tenta de novo:

```bash
docker compose restart backend
```

### Desligar o import automático

Com `AUTO_IMPORT=0` no `.env` (também valem `false`, `off` e `no`), o bootstrap inteiro é pulado, inclusive o seed. O banco fica só com as tabelas vazias, e os passos precisam ser rodados à mão dentro do container:

```bash
docker compose exec backend node dist-scripts/prisma/seed.js
docker compose exec backend node dist-scripts/prisma/import-enem.js
docker compose exec backend node dist-scripts/prisma/classify-heuristic.js
docker compose exec backend node dist-scripts/prisma/seed-flashcards.js
```

A imagem não tem ts-node, por isso os scripts rodam compilados, de `dist-scripts/`.

## Healthcheck

O compose testa o backend com `GET /health` a cada 30 segundos, com 15 minutos de tolerância no início para o bootstrap. O frontend só é iniciado depois que o backend fica saudável, então a porta 8080 só responde quando a API já está no ar.

> **Atenção:** se a primeira subida passar de 15 minutos (internet lenta, por exemplo), o backend é marcado como `unhealthy` e o compose desiste de iniciar o frontend. Espere o import terminar no log e rode `docker compose up -d` de novo.

Para conferir à mão:

```bash
curl http://localhost:8080/health
```

A resposta esperada é `{"status":"ok","database":"up","redis":"up"}`. A rota responde 200 mesmo com o banco ou o Redis fora do ar; nesse caso, o campo correspondente vem `down`. Sem `REDIS_URL` (fora do Docker), `redis` vem `disabled`.

## Volumes

| Volume | Montado em | Conteúdo |
| --- | --- | --- |
| `pg-data` | `/var/lib/postgresql/data`, no `db` | O banco inteiro: contas, progresso dos alunos e questões. |
| `enem-media` | `/data`, no `backend` | `enem-media/`, com as imagens das questões servidas em `/media/enem/`, e `enem-dataset/`, com o dataset baixado. |

Os dois sobrevivem a `docker compose down` e ao rebuild das imagens. Já `docker compose down -v` apaga os volumes, e com eles todas as contas e o progresso dos alunos. Como fazer backup está em [Produção](/docs/hospedar/producao/#backups).

## Primeiro acesso

Abra `http://localhost:8080` (ou o endereço do servidor na porta 8080): a raiz é a página do projeto e a documentação fica em `/docs/`. O app mora em `/app/`; abra `http://localhost:8080/app/` e crie uma conta na tela de entrada. Os endereços antigos do app, de antes de ele ir para `/app/` (como `/questoes`), redirecionam para o novo. Não existe usuário padrão nem conta de administrador: todas as contas são de aluno, criadas pelo próprio app.

O Swagger da API fica desligado na imagem Docker, porque ela roda com `NODE_ENV=production`. Ele só aparece no ambiente de desenvolvimento, descrito em [Desenvolvimento](/docs/contribuir/desenvolvimento/).

> **Dica:** para ligar o comentário de questões por IA, veja [Inteligência artificial](/docs/hospedar/ia/). Antes de abrir a instância para alunos de fora da sua rede, leia [Produção](/docs/hospedar/producao/).
