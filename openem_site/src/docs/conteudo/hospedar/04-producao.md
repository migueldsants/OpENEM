---
titulo: Produção
descricao: HTTPS na frente do OpENEM, TRUST_PROXY, cabeçalhos de segurança, rate limiting, backups e como atualizar uma instância.
---

## Caminho de uma requisição

O aluno acessa o nginx do container `frontend` (porta 8080). Ele serve o site na raiz (a página do projeto e a documentação em `/docs/`) e o app em `/app/`, e repassa `/api/`, `/health` e `/media/` para a API na porta 3000, acrescentando o IP do aluno ao cabeçalho `X-Forwarded-For`. A API fala com o PostgreSQL e com o Redis pela rede interna do compose.

## HTTPS na frente

O compose só serve HTTP. Em produção, coloque um proxy reverso com TLS (nginx, Caddy, Traefik ou o que você já usa) na frente, apontando para `http://127.0.0.1:8080`. Além de proteger senhas e tokens, o HTTPS é exigido pelo próprio PWA: o navegador só registra o service worker (uso offline e instalação do app) em contexto seguro, ou seja, HTTPS ou `localhost`.

O `nginx.conf` do app não envia `Strict-Transport-Security`. Se quiser HSTS, configure no seu proxy HTTPS.

## TRUST_PROXY

Sem login (cadastro, login), o rate limiting conta por IP. Atrás de um proxy, a API só enxerga o IP do aluno se souber quantos proxies há na frente dela, e é isso que `TRUST_PROXY` informa:

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

O app recebe os cabeçalhos do `location /app/` do [nginx.conf](https://github.com/migueldsants/OpENEM/blob/main/openem_frontend/nginx.conf): uma Content-Security-Policy que só aceita script da própria origem, sem `'unsafe-inline'`, mais `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`. As exceções da CSP são o que o app usa de fora: o player do YouTube sem cookies e imagens `https` nos flashcards. As fontes são servidas pelo próprio app, sem Google Fonts. O site (`location /`) tem uma CSP mais fechada, sem nenhuma origem de fora. A API recebe os cabeçalhos do helmet. O HTML sai com `Cache-Control: no-cache`, para o navegador nunca reabrir uma página que aponta para arquivos que um deploy já trocou.

Se o seu proxy HTTPS reescrever cabeçalhos, preserve esses. Quem mudar o app para usar uma origem externa nova precisa liberá-la no `nginx.conf`; o teste `src/nginx-csp.test.ts` do frontend quebra quando os dois se desencontram.

## Rate limiting

Cada limite é contado por rota. Com login, conta por aluno: uma turma atrás do mesmo IP (escola, cursinho, a rede da operadora) não divide o limite. Sem login, conta por IP.

| Rota | Limite | Por quê |
| --- | --- | --- |
| Qualquer rota | 20 por segundo e 100 por minuto | Rajada curta e o limite padrão (`THROTTLE_BURST_*`, `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`). Cobre `POST /answers` e o envio do simulado. |
| Login | 30 por minuto por IP, e 5 senhas erradas em 15 min por conta | Por IP, folgado para a sala de aula. Por conta, venha de onde vier: a quinta senha errada bloqueia a conta por 15 min, e cada novo bloqueio no mesmo dia dobra o anterior, até 24 h. O login certo zera as falhas. E-mail sem conta bloqueia igual, para o bloqueio não revelar quais existem. |
| Cadastro | 20 por minuto por IP | Cada cadastro calcula um hash argon2. |
| Esqueci minha senha | 10 a cada 15 min por IP, e 3 por hora por e-mail | Cada pedido pode mandar um e-mail. O limite por e-mail vale com ou sem conta, para não revelar quais existem. |
| Redefinir a senha e login com Google | 10 e 20 por minuto por IP | Os tokens têm 256 bits: o limite é contra abuso, não contra adivinhação. |
| Trocar a senha | 5 por minuto por aluno | Quem tem só um token roubado não fica testando senhas. |
| PDF (simulado e fórmulas) | 10 por minuto | O desenho é CPU pesada e passa por uma fila. |
| Comentário por IA | 10 por minuto | Cada pedido novo é uma chamada paga; a cota diária vale à parte. |
| Fórum (tópico e resposta) | 10 por minuto | Spam. |
| Temas (criar e editar) | 20 e 30 por minuto | Spam. |

`/health` e `/media/` só contam no limite padrão. Quem passa do limite recebe HTTP 429 com `Retry-After` e a mensagem "Muitas tentativas. Tente de novo em N s.", e o app mostra o tempo de espera.

Os contadores ficam no Redis: valem para todas as instâncias da API e sobrevivem a um deploy. Com o Redis fora do ar, cada instância conta na própria memória até ele voltar; os limites nunca deixam de valer. `THROTTLE_KEY_PREFIX` separa os contadores de duas instalações que usam o mesmo Redis.

### Na borda

O nginx do frontend limita `/api/` a 50 requisições por segundo por IP, com folga de 200, antes de chegar ao Node. É proteção contra inundação, não regra de negócio: fica bem acima do que uma sala inteira abrindo o app gera.

Com outro proxy ou CDN na frente desse nginx, ele enxerga o IP do proxy e passaria a limitar todo mundo junto. Nesse caso, além de subir o `TRUST_PROXY`, ensine o nginx a ler o IP real, num arquivo montado em `/etc/nginx/conf.d/`:

```nginx
set_real_ip_from 172.16.0.0/12;  # a rede do seu proxy
real_ip_header X-Forwarded-For;
```

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
