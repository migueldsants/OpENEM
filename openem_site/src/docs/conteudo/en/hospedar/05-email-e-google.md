---
titulo: E-mail and Google sign-in
descricao: How to turn on password recovery by e-mail (SMTP) and Google sign-in (OAuth), the two optional account features, and what to set on the Google consent screen.
---

An OpENEM account works with just an e-mail and a password. Two features depend on outside services and are therefore optional: password recovery by e-mail, which needs an SMTP server, and Google sign-in, which needs an OAuth client in Google Cloud. Without the variables, the sign-in screen hides **Esqueci minha senha** (forgot my password) and the **Entrar com Google** button, and the rest of the app works as usual.

Changing the password and **Sair de todos os dispositivos** (sign out of all devices), on the **Perfil** (profile) screen, depend on none of this and work in every installation.

## Public address

Both features need `SITE_URL`, the address students use, such as `https://openem.example`. The e-mail link and the Google return address are built from it, never from the request's `Host` header: whoever forged the `Host` would make the reset e-mail point to their own site.

In production, without `SITE_URL`, both features stay off and the API logs a warning at startup. Outside production, without it, the API uses `http://localhost:5173`, the address of the frontend's `npm run dev`.

Use HTTPS: the e-mail link carries a secret, and the cookie of the trip to Google only gets the `Secure` flag when `SITE_URL` starts with `https://`. See [Production](/docs/en/hospedar/producao/).

## Password recovery by e-mail

### How it works

1. On the sign-in screen, the student taps **Esqueci minha senha** and types the e-mail.
2. The API always answers with the same sentence, whether or not the e-mail has an account, and sends the e-mail in the background: neither the answer nor its timing reveals who has an account.
3. The e-mail holds a link to `/app/redefinir-senha`. The link is valid for 30 minutes and only once, and asking for another one invalidates the previous one.
4. After creating the new password, the student is signed in right away. Every other session of the account ends, the wrong-password lockout is cleared and the e-mail now counts as confirmed.

The token travels in the link fragment (after the `#`), which the browser never sends to any server, and the database stores only its SHA-256 hash. The limits are 3 requests per hour for the same e-mail, with or without an account, and 10 every 15 minutes per IP. An account created through Google, which has no password, uses the same path to create its first one.

### Setup

In the root `.env`:

```env
SITE_URL=https://openem.example
SMTP_URL=smtps://user:password@smtp.example.com:465
MAIL_FROM="OpENEM <no-reply@openem.example>"
```

- `smtps://` opens the connection with TLS from the start, usually on port 465. `smtp://` starts without TLS and switches to STARTTLS when the server offers it, usually on port 587.
- A user or password with special characters must be encoded in the URL: `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`.
- `MAIL_FROM` must belong to a domain that authorizes your SMTP server (SPF and DKIM). Without that, most messages land in spam or get rejected. Your domain provider's SMTP or a transactional e-mail service works; for a small school, an app password on a Gmail account also works, within its daily sending limit.

Then `docker compose up -d` recreates the backend with the new variables, with no rebuild. To test, ask for a link for your own account. If the e-mail does not arrive, look in the backend log (`docker compose logs backend`) for the line `falha ao enviar o link de redefinição`, which carries the SMTP server's error.

### Without SMTP

`POST /api/v1/auth/forgot-password` answers 503 and the screen does not show the link. Whoever forgets the password has no way to recover it through the app, so it is worth setting up SMTP before opening the installation to students.

## Google sign-in

### How it works

Sign-in follows OpenID Connect with authorization code, PKCE, `state` and `nonce`:

1. The **Entrar com Google** button goes to `/api/v1/auth/google`, which stores an encrypted cookie with the `state`, the `nonce` and the PKCE secret and redirects to Google, which asks which account to use.
2. Google comes back to `/api/v1/auth/google/callback`. The API checks the `state` against the cookie, exchanges the code for the ID token, checks the signature against Google's public keys plus the issuer, audience, expiry and `nonce`, and only accepts an e-mail confirmed by Google.
3. The API redirects to `/app/entrar/google` with a single-use code, valid for 2 minutes, and the app exchanges it for the session with a `POST`. The login token never shows up in the URL.

OpENEM asks only for the `openid` and `email` scopes: the Google account's name and photo never reach the server.

### New account and existing account

- The first time, if there is no account with that e-mail, OpENEM creates one, without a password. The student can create a password later through **Esqueci minha senha**.
- If an account with the same e-mail already exists, the two are linked, and from then on the student signs in with the password or with Google.
- If that account has a password and its e-mail was never confirmed (it was created with a password and never went through a reset), the password is disabled and the open sessions end. Signing up with a password does not confirm the e-mail, so anyone could have created the account with someone else's e-mail and waited for the owner to sign in with Google. The app tells the student, who can create a new password through **Esqueci minha senha**.
- If the e-mail is already linked to another Google account, or if there are two accounts with the same e-mail in different letter case, Google sign-in is refused and the student signs in with the password.

### Setup in Google Cloud

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project for the installation.
2. Open the **Google Auth Platform** (in the older console, **APIs & Services** and then **OAuth consent screen**). Section names change from time to time; what matters is the content:
   - **Branding**: the **app name** and **support e-mail**, which the student sees on Google's screen; the **app home page**, which is `SITE_URL`; the **privacy policy link**, a page published on your domain stating which data the installation keeps (the e-mail, the Google account identifier and what the student does in the app), what for and how to ask for deletion; and the **authorized domains**, with the `SITE_URL` domain. Google asks for the policy link and for the domain to be verified in [Google Search Console](https://search.google.com/search-console), by the same account that manages the project, to verify the brand and show the app name and logo on the consent screen.
   - **Audience**: **External** user type.
   - **Data access**: only the `openid` and `.../auth/userinfo.email` scopes. They are non-sensitive scopes, which skip Google's security review.
3. In **Audience**, publish the app (**In production**). While it is **Testing**, only the registered test users can sign in.
4. In **Clients** (in the older console, **Credentials**), create an **OAuth client ID** of type **Web application** and register the **authorized redirect URI**, identical to the one the API uses:

   ```
   https://openem.example/api/v1/auth/google/callback
   ```

   To develop on your own machine, also register `http://localhost:5173/api/v1/auth/google/callback`. The **authorized JavaScript origins** are not used: the code exchange happens on the server.
5. Copy the client ID and secret into the root `.env`:

   ```env
   SITE_URL=https://openem.example
   GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<client secret>
   ```

6. Run `docker compose up -d`. The sign-in screen now shows **Entrar com Google**.

The client secret stays on the server only. If it leaks, generate another one in Google Cloud and replace it in `.env`.

### When it goes wrong

The app shows a sentence (in Portuguese) for each reason, and the API logs the failure cases:

| The student sees | Likely cause |
| --- | --- |
| Você cancelou a entrada pelo Google. | The student closed or declined Google's screen. |
| A entrada pelo Google demorou demais ou foi aberta em outra aba. | More than 10 minutes went by, the browser blocked the cookie or the return came from another tab. |
| O Google não confirmou o e-mail desta conta. | Google account with an unconfirmed e-mail. |
| Este e-mail já está ligado a outra conta Google... | See the last rule in [New account and existing account](#new-account-and-existing-account). |
| Não foi possível entrar pelo Google. | Redirect URI different from the registered one (Google shows `redirect_uri_mismatch`), wrong secret, server clock off or Google out of reach. The reason is in the backend log. |

## Sessions

The login token carries the account's session version, which the API checks on every request. Changing the password, resetting it by e-mail, having the password disabled by the Google link or tapping **Sair de todos os dispositivos** raises that version, and every earlier token stops working right away. With several API instances and no Redis, each instance keeps the version for up to 30 seconds; with the Compose Redis, the change applies to all of them at once.
