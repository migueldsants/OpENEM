---
titulo: Produção
descricao: HTTPS na frente do OpENEM, TRUST_PROXY, cabeçalhos de segurança, rate limiting, backups e como atualizar uma instância.
---

## Caminho de uma requisição

O aluno acessa o nginx do container `frontend` (porta 8080). Ele serve o app e repassa `/api/`, `/health` e `/media/` para a API na porta 3000, acrescentando o IP do aluno ao cabeçalho `X-Forwarded-For`. A API fala com o PostgreSQL pela rede interna do compose.

## HTTPS na frente

O compose só serve HTTP. Em produção, coloque um proxy reverso com TLS (nginx, Caddy, Traefik ou o que você já usa) na frente, apontando para `http://127.0.0.1:8080`. Além de proteger senhas e tokens, o HTTPS é exigido pelo próprio PWA: o navegador só registra o service worker (uso offline e instalação do app) em contexto seguro, ou seja, HTTPS ou `localhost`.

O `nginx.conf` do app não envia `Strict-Transport-Security`. Se quiser HSTS, configure no seu proxy HTTPS.

## TRUST_PROXY

O rate limiting conta por IP. Atrás de um proxy, a API só enxerga o IP do aluno se souber quantos proxies há na frente dela, e é isso que `TRUST_PROXY` informa:

- **Sem valor:** a API não confia em proxy nenhum. Atrás de um, todo aluno aparece com o IP do proxy e o rate limiting vira um contador único para o site: dez senhas erradas de uma pessoa bloqueiam o login de todos.
- **Um número N:** a API confia nos N últimos saltos. Com `1`, ela usa o último endereço do `X-Forwarded-For`, o que o nginx acrescentou, e ignora o que o cliente escreveu antes dele.
- **Lista de endereços ou sub-redes** no formato do Express, como `loopback, 10.0.0.0/8`.
- **`true` é recusado** e impede a API de subir, porque deixaria o cliente escolher o próprio IP.

O compose fixa `TRUST_PROXY=1`, o certo quando o nginx do frontend é o único proxy. Com um proxy HTTPS na frente dele, são dois:

1. O proxy HTTPS precisa mandar o IP do cliente no `X-Forwarded-For`. No nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`.
2. Suba `TRUST_PROXY` para 2 num `docker-compose.override.yml`:

```yaml
services:
  backend:
    environment:
      - TRUST_PROXY=2
```

3. Feche a porta 8080 para a rede. Com `TRUST_PROXY=2`, quem chegasse direto nela poderia forjar o `X-Forwarded-For`. Troque, no `docker-compose.yml`, a linha `ports` do frontend de `'8080:80'` para `'127.0.0.1:8080:80'`. A troca precisa ser no próprio arquivo: num arquivo de override, o Compose soma as portas em vez de substituir.

Se o proxy HTTPS ficar na frente com `TRUST_PROXY=1`, todos os alunos aparecem com o IP dele, o mesmo problema de não confiar em proxy nenhum.

### Por que a porta 3000 fica em 127.0.0.1

Com `TRUST_PROXY` ligado, quem chegasse na API sem passar pelo nginx poderia escrever qualquer `X-Forwarded-For` e ganhar um contador novo a cada requisição, escapando do rate limiting. Por isso o compose publica a porta 3000 só em `127.0.0.1`, e o banco também. Não as abra para a rede.

## Cabeçalhos de segurança

O app recebe os cabeçalhos do `location /` do [nginx.conf](https://github.com/migueldsants/OpENEM/blob/main/openem_frontend/nginx.conf): uma Content-Security-Policy que só aceita script da própria origem, sem `'unsafe-inline'`, mais `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`. As exceções da CSP são o que o app usa de fora: Google Fonts, o player do YouTube sem cookies e imagens `https` nos flashcards. A API recebe os cabeçalhos do helmet.

Se o seu proxy HTTPS reescrever cabeçalhos, preserve esses. Quem mudar o app para usar uma origem externa nova precisa liberá-la no `nginx.conf`; o teste `src/nginx-csp.test.ts` do frontend quebra quando os dois se desencontram.

## Rate limiting

- Limite padrão: 100 requisições por minuto, contadas por rota e por IP (`THROTTLE_TTL_MS` e `THROTTLE_LIMIT`).
- Limites próprios, por minuto e por IP: cadastro 5, login 10, PDF 10, comentário por IA 10, criar tópico ou responder no fórum 10, criar tema 20 e editar tema 30.
- Quem passa do limite recebe HTTP 429.
- Os contadores ficam na memória do processo da API: reiniciar o backend zera todos, e com mais de uma instância cada uma conta por conta própria.

## Backups

### Banco

```bash
docker compose exec -T db pg_dump -U openem -d openem -Fc > openem.dump
```

O `-T` desliga o terminal virtual, que corromperia a saída binária. Se você mudou `POSTGRES_USER` ou `POSTGRES_DB`, troque `openem` pelos seus valores. Para restaurar, pare o backend antes:

```bash
docker compose stop backend
docker compose exec -T db pg_restore -U openem -d openem --clean --if-exists < openem.dump
docker compose start backend
```

### Imagens das questões

```bash
docker compose exec -T backend tar czf - -C /data enem-media > enem-media.tgz
```

Para restaurar:

```bash
docker compose exec -T backend tar xzf - -C /data < enem-media.tgz
```

As questões no banco apontam para essas imagens, então guarde os dois backups do mesmo momento. A pasta `/data/enem-dataset` não precisa de backup: o import baixa o dataset de novo.

## Atualizar

Faça backup antes. Depois:

```bash
git pull
docker compose up --build -d
```

Ao iniciar, o backend aplica as migrations novas (`prisma migrate deploy`) antes de subir a API. O bootstrap não roda de novo, porque o banco já tem questões.

### Atualizar os dados

A imagem não tem ts-node, então os scripts rodam compilados, de `dist-scripts/`:

```bash
docker compose exec backend node dist-scripts/prisma/import-enem.js --refresh
docker compose exec backend node dist-scripts/prisma/classify-heuristic.js
docker compose exec backend node dist-scripts/prisma/seed-flashcards.js
docker compose exec backend node dist-scripts/prisma/seed.js
```

- `import-enem.js --refresh` apaga o dataset baixado e baixa de novo. O import atualiza sem duplicar e não desfaz comentários nem classificações feitos depois. Outras opções: `--exam=2023` (uma prova só), `--dry-run`, `--limit=5`, `--skip-download`, `--skip-images` e `--verbose`.
- `classify-heuristic.js` só mexe em questão sem assunto. Aceita `--dry-run` e `--sample=20` para auditar decisões.
- `seed-flashcards.js` sincroniza o catálogo: corrige o texto dos cards sem perder o progresso dos alunos.
- `seed.js` reaplica, por upsert, a taxonomia, os modelos de simulado, os temas de redação e o catálogo de fórmulas. Uma área que saiu da taxonomia só é removida se não tiver questões.

A classificação por IA está em [Inteligência artificial](/docs/hospedar/ia/).
