-- O e-mail passa a ser gravado sem espaços nas pontas e em minúsculas (o
-- cadastro e o login normalizam). Antes, "Ana@x.com" e "ana@x.com" eram duas
-- contas, e quem se cadastrou com a maiúscula do teclado do celular não
-- entrava digitando em minúsculas. Só dados mudam.
--
-- Normaliza o e-mail de cada conta que não colide com outra. Contas que
-- colidem (a mesma pessoa cadastrada duas vezes) ficam como estão: o login
-- procura sem diferenciar maiúsculas e entra na mais antiga.
UPDATE "User" AS u
SET "email" = lower(btrim(u."email"))
WHERE u."email" <> lower(btrim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "User" AS o
    WHERE o."id" <> u."id"
      AND lower(btrim(o."email")) = lower(btrim(u."email"))
  );
