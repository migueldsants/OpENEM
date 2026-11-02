# Security Policy

[Leia em Português](../../SECURITY.md)

## Reporting a Vulnerability
**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a potential security issue, please send an email to **openem.tmp@gmail.com**. 

### What to include:
- A detailed description of the vulnerability.
- Steps to reproduce the issue (PoC).
- Potential impact of the vulnerability.

## Our Response Process
- **Acknowledgment:** You will receive a response within 48 hours.
- **Handling:** We will provide updates every week until a fix is released.
- **Disclosure:** Once fixed, we will publish a security advisory and credit you for the discovery.

## Protections already in place

Before reporting, note that these behaviours are intentional:

- **Account lockout on wrong passwords:** 5 wrong passwords within 15 minutes lock the account for 15 minutes, wherever they come from, and each new lockout on the same day doubles the previous one (up to 24 hours). It also applies to emails with no account, so it does not reveal which ones exist.
- **Password in the request body:** signing in, signing up, changing the password, resetting it and deleting the account send the password as plain text in the JSON, protected by HTTPS. A tool like Burp, which opens TLS on your own machine, shows the password, and that is not a leak. The server stores only the argon2 hash (`User.passwordHash`), checks the password with `argon2.verify`, does not log request bodies and never returns the hash, not even in the data export. Hashing in the browser would protect nothing: the hash would become the password, and whoever captured it would sign in with it just the same.
- **Rate limiting:** the API limits each route per student (per IP without login), with counters in Redis, and nginx limits `/api/` per IP. Exceeding a limit returns HTTP 429 with `Retry-After`. The list of limits is in the [production docs](../../openem_site/src/docs/conteudo/hospedar/04-producao.md) (Portuguese).

A way around these limits (switching IPs, forging `X-Forwarded-For`, using an invalid token) is a vulnerability and should be reported.
