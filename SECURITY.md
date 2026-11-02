# Política de Segurança

[Read in English](.github/docs/SECURITY-EN.md)

## Reportando uma Vulnerabilidade

**Por favor, não abra uma "Issue" pública no GitHub para reportar vulnerabilidades de segurança.**

Se você descobrir um problema de segurança em potencial, envie um e-mail para **openem.tmp@gmail.com**.

### O que incluir:
- **Descrição detalhada:** Explique o que é a vulnerabilidade e onde ela se encontra.
- **Passo a passo (PoC):** Instruções claras de como reproduzir o problema (Prova de Conceito).
- **Impacto:** Qual o risco potencial desta vulnerabilidade (ex: acesso a dados, queda do serviço).

## Nosso Processo de Resposta
- **Confirmação:** Você receberá uma resposta confirmando o recebimento em até **48 horas**.
- **Tratamento:** Enviaremos atualizações semanais sobre o progresso até que uma correção seja lançada.
- **Divulgação:** Assim que o problema for corrigido, publicaremos um aviso de segurança e daremos o devido crédito a você pela descoberta (se desejar).

## Proteções que já existem

Antes de reportar, saiba que estes comportamentos são intencionais:

- **Bloqueio de conta por senha errada:** 5 senhas erradas em 15 minutos bloqueiam a conta por 15 minutos, venham de onde vierem, e cada novo bloqueio no mesmo dia dobra o anterior (até 24 horas). O bloqueio vale também para e-mail sem conta, para não revelar quais existem.
- **Senha no corpo do pedido:** entrar, criar conta, trocar a senha, redefini-la e excluir a conta mandam a senha em texto no JSON, protegida pelo HTTPS. Uma ferramenta como o Burp, que abre o TLS na própria máquina, mostra a senha, e isso não é vazamento. O servidor guarda só o hash argon2 (`User.passwordHash`), confere a senha com `argon2.verify`, não registra o corpo dos pedidos e nunca devolve o hash, nem na exportação de dados. Fazer o hash no navegador não protegeria nada: o hash passaria a ser a senha, e quem o capturasse entraria com ele do mesmo jeito.
- **Rate limiting:** a API limita cada rota por aluno (por IP sem login), com os contadores no Redis, e o nginx limita `/api/` por IP. Quem passa do limite recebe HTTP 429 com `Retry-After`. A tabela de limites está na [documentação de produção](openem_site/src/docs/conteudo/hospedar/04-producao.md).

Um jeito de contornar esses limites (trocar de IP, forjar `X-Forwarded-For`, usar token inválido) é uma vulnerabilidade e deve ser reportado.
