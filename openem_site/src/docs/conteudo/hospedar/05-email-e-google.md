---
titulo: E-mail e login com Google
descricao: Como ligar a recuperação de senha por e-mail (SMTP) e o login com Google (OAuth), os dois recursos opcionais da conta, e o que configurar na tela de consentimento do Google.
---

A conta do OpENEM funciona só com e-mail e senha. Dois recursos dependem de serviço de fora e por isso são opcionais: a recuperação de senha por e-mail, que precisa de um servidor SMTP, e o login com Google, que precisa de um cliente OAuth no Google Cloud. Sem as variáveis, a tela de entrada esconde o **Esqueci minha senha** e o botão **Entrar com Google**, e o resto do app segue igual.

Trocar a senha e **Sair de todos os dispositivos**, na tela **Perfil**, não dependem de nada disso e funcionam em qualquer instalação.

## Endereço público

Os dois recursos precisam da `SITE_URL`, o endereço que os alunos usam, como `https://openem.exemplo`. O link do e-mail e o endereço de volta do Google saem dela, e nunca do cabeçalho `Host` do pedido: quem forjasse o `Host` faria o e-mail de redefinição apontar para o site dele.

Em produção, sem `SITE_URL`, os dois recursos ficam desligados e a API deixa um aviso no log ao subir. Fora de produção, sem ela, a API usa `http://localhost:5173`, o endereço do `npm run dev` do frontend.

Use HTTPS: o link do e-mail carrega um segredo, e o cookie da ida ao Google só sai com a marca `Secure` quando a `SITE_URL` começa com `https://`. Veja [Produção](/docs/hospedar/producao/).

## Recuperação de senha por e-mail

### Como funciona

1. Na tela de entrada, o aluno toca em **Esqueci minha senha** e digita o e-mail.
2. A API responde sempre a mesma frase, tenha o e-mail conta ou não, e manda o e-mail em segundo plano: nem a resposta nem o tempo dela dizem quem tem conta.
3. O e-mail traz um link para `/app/redefinir-senha`. O link vale por 30 minutos e uma vez só, e pedir outro invalida o anterior.
4. Ao criar a senha nova, o aluno entra direto. Todas as outras sessões da conta são encerradas, o bloqueio por senhas erradas é liberado e o e-mail passa a contar como confirmado.

O token vai no fragmento do link (depois do `#`), que o navegador não manda a servidor nenhum, e o banco guarda só o hash SHA-256 dele. Os limites são 3 pedidos por hora para o mesmo e-mail, com ou sem conta, e 10 a cada 15 minutos por IP. A conta criada pelo Google, que não tem senha, usa o mesmo caminho para criar a primeira.

### Configurar

No `.env` da raiz:

```env
SITE_URL=https://openem.exemplo
SMTP_URL=smtps://usuario:senha@smtp.exemplo.com:465
MAIL_FROM="OpENEM <nao-responda@openem.exemplo>"
```

- `smtps://` abre a conexão já com TLS, em geral na porta 465. `smtp://` começa sem TLS e passa para STARTTLS quando o servidor oferece, em geral na porta 587.
- Usuário e senha com caracteres especiais vão codificados na URL: `@` vira `%40`, `:` vira `%3A`, `/` vira `%2F`.
- O `MAIL_FROM` deve ser de um domínio que autorize o seu servidor SMTP (SPF e DKIM). Sem isso, a maior parte dos e-mails cai no spam ou é recusada. Serve o SMTP do provedor do seu domínio ou um serviço de e-mail transacional; para uma escola pequena, a senha de app de uma conta Gmail também funciona, com o limite diário de envio dela.

Depois, `docker compose up -d` recria o backend com as variáveis novas, sem rebuild. Para testar, peça um link para a sua própria conta. Se o e-mail não chegar, procure no log do backend (`docker compose logs backend`) a linha `falha ao enviar o link de redefinição`, que traz o erro do servidor SMTP.

### Sem SMTP

`POST /api/v1/auth/forgot-password` responde 503 e a tela não mostra o link. Quem esquece a senha não tem como recuperá-la pelo app, então vale configurar o SMTP antes de abrir a instalação para os alunos.

## Login com Google

### Como funciona

O login segue o OpenID Connect com authorization code, PKCE, `state` e `nonce`:

1. O botão **Entrar com Google** leva a `/api/v1/auth/google`, que grava um cookie cifrado com o `state`, o `nonce` e o segredo do PKCE e redireciona para o Google, que pergunta qual conta usar.
2. O Google volta para `/api/v1/auth/google/callback`. A API confere o `state` contra o cookie, troca o código pelo ID token, confere a assinatura com as chaves públicas do Google, o emissor, o destinatário, a validade e o `nonce`, e só aceita e-mail confirmado pelo Google.
3. A API redireciona para `/app/entrar/google` com um código de uso único, que vale 2 minutos, e o app o troca pelo login com um `POST`. O token de login nunca aparece na URL.

O OpENEM pede só os escopos `openid` e `email`: o nome e a foto da conta Google não chegam ao servidor.

### Conta nova e conta que já existe

- Na primeira vez, se não há conta com aquele e-mail, o OpENEM cria uma, sem senha. O aluno pode criar uma senha depois pelo **Esqueci minha senha**.
- Se já há uma conta com o mesmo e-mail, as duas são vinculadas, e dali em diante o aluno entra com a senha ou com o Google.
- Se essa conta tem senha e o e-mail dela nunca foi confirmado (foi criada com senha e nunca passou por uma redefinição), a senha é desativada e as sessões abertas caem. O cadastro por senha não confirma o e-mail, então qualquer pessoa poderia ter criado a conta com o e-mail de outra e esperado o dono entrar pelo Google. O app avisa o aluno, que pode criar uma senha nova pelo **Esqueci minha senha**.
- Se o e-mail já está ligado a outra conta Google, ou se há duas contas com o mesmo e-mail em maiúsculas e minúsculas diferentes, o login pelo Google é recusado e o aluno entra com a senha.

### Configurar no Google Cloud

1. No [console do Google Cloud](https://console.cloud.google.com/), crie um projeto para a instalação.
2. Abra a **Google Auth Platform** (no console antigo, **APIs e serviços** e depois **Tela de consentimento OAuth**). Os nomes das seções mudam de tempos em tempos; o que importa é o conteúdo:
   - **Informações da marca** (Branding): o **nome do app** e o **e-mail de suporte**, que o aluno vê na tela do Google; a **página inicial do app**, que é a `SITE_URL`; o **link da Política de Privacidade**, uma página publicada no seu domínio dizendo quais dados a instalação guarda (o e-mail, o identificador da conta Google e o que o aluno faz no app), para quê e como pedir a exclusão; e os **domínios autorizados**, com o domínio da `SITE_URL`. O Google pede o link da política e que o domínio seja verificado no [Google Search Console](https://search.google.com/search-console), pela mesma conta que administra o projeto, para verificar a marca e mostrar o nome e o logo do app na tela de consentimento.
   - **Público-alvo** (Audience): tipo **Externo**.
   - **Acesso a dados** (Data access): só os escopos `openid` e `.../auth/userinfo.email`. São escopos não sensíveis, que não passam pela revisão de segurança do Google.
3. Em **Público-alvo**, publique o app (**Em produção**). Enquanto ele está **Em teste**, só os usuários de teste cadastrados conseguem entrar.
4. Em **Clientes** (no console antigo, **Credenciais**), crie um **ID do cliente OAuth** do tipo **Aplicativo da Web** e cadastre o **URI de redirecionamento autorizado**, idêntico ao que a API usa:

   ```
   https://openem.exemplo/api/v1/auth/google/callback
   ```

   Para desenvolver na própria máquina, cadastre também `http://localhost:5173/api/v1/auth/google/callback`. As **origens JavaScript autorizadas** não são usadas: a troca do código acontece no servidor.
5. Copie o ID e o segredo do cliente para o `.env` da raiz:

   ```env
   SITE_URL=https://openem.exemplo
   GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<segredo do cliente>
   ```

6. Rode `docker compose up -d`. A tela de entrada passa a mostrar **Entrar com Google**.

O segredo do cliente fica só no servidor. Se ele vazar, gere outro no Google Cloud e troque no `.env`.

### Quando dá errado

O app mostra uma frase para cada motivo, e a API registra no log os casos de falha:

| O aluno vê | Causa provável |
| --- | --- |
| Você cancelou a entrada pelo Google. | O aluno fechou ou recusou a tela do Google. |
| A entrada pelo Google demorou demais ou foi aberta em outra aba. | Passaram mais de 10 minutos, o navegador bloqueou o cookie ou a volta veio de outra aba. |
| O Google não confirmou o e-mail desta conta. | Conta Google com e-mail não confirmado. |
| Este e-mail já está ligado a outra conta Google... | Veja a última regra de [Conta nova e conta que já existe](#conta-nova-e-conta-que-ja-existe). |
| Não foi possível entrar pelo Google. | URI de redirecionamento diferente do cadastrado (o Google mostra `redirect_uri_mismatch`), segredo errado, relógio do servidor fora da hora ou o Google fora do alcance. O motivo está no log do backend. |

## Sessões

O token de login traz a versão de sessão da conta, que a API confere a cada pedido. Trocar a senha, redefini-la pelo e-mail, ter a senha desativada pelo vínculo com o Google ou tocar em **Sair de todos os dispositivos** sobe essa versão, e todos os tokens anteriores param de valer na hora. Com várias instâncias da API e sem Redis, cada instância guarda a versão por até 30 segundos; com o Redis do compose, a mudança vale para todas imediatamente.
