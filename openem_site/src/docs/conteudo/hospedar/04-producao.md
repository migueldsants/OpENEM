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
| Fórum (tópico, resposta e denúncia) | 10 por minuto | Spam. |
| Temas (criar e editar) | 20 e 30 por minuto | Spam. |
| Baixar meus dados (`GET /users/me/export`) | 5 a cada 10 minutos | Lê todas as tabelas do aluno de uma vez. |
| Excluir conta (`DELETE /users/me`) | 5 por minuto, e as senhas erradas contam no limite por conta do login | Quem tem só o token na mão não testa senhas por esta rota. |

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

## Privacidade e LGPD

Quem opera uma instalação é o controlador dos dados dos alunos, e boa parte deles é adolescente. O OpENEM traz a [Política de Privacidade](/privacidade/) e os [Termos de Uso](/termos/), mas só você sabe quem é o controlador, qual é o contato e quanto tempo os seus logs ficam guardados.

### Preencha os documentos

Os textos ficam em `openem_site/src/legal/conteudo/` (`privacidade.md` e `termos.md`, com a tradução em `en/`). Troque cada `[PLACEHOLDER: ...]` pelo dado real e gere a imagem de novo:

- identidade do controlador (nome ou razão social, CPF ou CNPJ, endereço) e do encarregado;
- e-mail de contato, que é o canal dos pedidos dos alunos e dos responsáveis;
- provedor de IA configurado (ou "nenhum") e empresa de hospedagem;
- prazo de retenção dos logs de acesso do nginx e dos backups;
- como você avisa mudanças relevantes e o foro.

Os documentos são um ponto de partida, não um parecer jurídico: revise com quem entende de LGPD e do Estatuto Digital da Criança e do Adolescente (Lei 15.211/2025) antes de abrir para alunos.

### Versão dos termos

O cadastro exige o aceite e grava, em cada conta, a data e a versão aceitas (`termsAcceptedAt` e `termsVersion`). A versão é `TERMS_VERSION`, em `openem_backend/src/common/terms.ts`, e tem de ser igual ao cabeçalho `atualizado` das quatro páginas; o teste do site quebra se não for. Mudou o texto, mude as duas datas juntas.

### Logs e retenção

O nginx da imagem do frontend escreve o log de acesso (IP, data, endereço, navegador) na saída do container, e quem guarda é o Docker. Limite o tamanho e o prazo no driver de log do Docker (por exemplo, `max-size` e `max-file` do `json-file`) e escreva esse prazo na política. Se o controlador é pessoa jurídica com fins econômicos, o Marco Civil da Internet (art. 15) pede que os registros de acesso fiquem guardados por 6 meses.

Os contadores do rate limiting no Redis expiram sozinhos (de 1 segundo a 10 minutos; o bloqueio de login dura até 24 h, com o e-mail em hash). O Redis do Compose roda sem persistência.

### Exclusão e backups

`DELETE /users/me` apaga a conta e, em cascata, tudo o que é do aluno. O que já foi para um backup continua lá: um dump antigo restaurado traz de volta contas excluídas. Defina um prazo para os backups, escreva-o na política e, ao restaurar, lembre que os alunos que se excluíram depois daquele dump precisam ser excluídos de novo.

### Denúncias do fórum

Ainda não há tela de moderação. As denúncias ficam na tabela `ForumReport`, com o motivo, quem denunciou e o tópico ou a resposta:

```bash
docker compose exec db psql -U openem -d openem -c 'SELECT r."createdAt", r.reason, t.title, p.body FROM "ForumReport" r JOIN "ForumThread" t ON t.id = r."threadId" LEFT JOIN "ForumPost" p ON p.id = r."postId" ORDER BY r."createdAt" DESC LIMIT 50;'
```

Para remover um conteúdo denunciado, apague a linha em `ForumThread` ou `ForumPost`; as respostas e as denúncias dele saem em cascata. Conteúdo que viole direitos de crianças e adolescentes, além de removido, pode ter de ser comunicado às autoridades.

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
