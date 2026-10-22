-- O dia do desafio diário e da sequência passa a ser o de Brasília (issue #90).
-- Antes era o dia UTC, que vira às 21h de Brasília. Só dados mudam: as colunas
-- continuam as mesmas.

-- 1) DailyChallengeLog.day: rechaveia cada resgate pelo dia de Brasília em que
--    ele aconteceu. O código novo procura a chave de Brasília; sem isso, quem
--    resgatou entre 21h e meia-noite do dia da virada (chave UTC = amanhã)
--    poderia resgatar de novo no mesmo dia, e quem resgatou nesse horário na
--    véspera (chave UTC = hoje) ficaria sem poder resgatar hoje.
--
--    O bug deixava resgatar duas vezes no mesmo dia de Brasília (antes e
--    depois das 21h). Esses pares colidiriam no índice único: fica o primeiro
--    resgate. O XP do segundo já foi creditado e não é retirado.
DELETE FROM "DailyChallengeLog" AS dup
USING "DailyChallengeLog" AS first
WHERE dup."userId" = first."userId"
  AND ((dup."claimedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date
    = ((first."claimedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date
  AND (dup."claimedAt", dup."id") > (first."claimedAt", first."id");

-- Em dois passos: rechavear direto pode colidir, no meio do UPDATE, com uma
-- linha que ainda não mudou (o índice único é conferido linha a linha).
UPDATE "DailyChallengeLog" SET "day" = 'migrando:' || "id";
UPDATE "DailyChallengeLog"
SET "day" = to_char(
  ("claimedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo',
  'YYYY-MM-DD'
);

-- 2) GamificationStat.lastActivityOn guarda o dia (meia-noite UTC da data) em
--    que a sequência contou pela última vez. Quem estudou depois das 21h de
--    Brasília ficou com o dia seguinte gravado; com o código novo, estudar no
--    dia seguinte de verdade não contaria para a sequência. Volta um dia
--    quando a última atividade registrada (XpLog) foi, em Brasília, no dia
--    anterior ao gravado. As demais linhas já estão certas.
UPDATE "GamificationStat" AS g
SET "lastActivityOn" = g."lastActivityOn" - INTERVAL '1 day'
FROM (
  SELECT "userId", MAX("createdAt") AS "lastAt"
  FROM "XpLog"
  WHERE "action" <> 'DAILY_CHALLENGE'
  GROUP BY "userId"
) AS last
WHERE last."userId" = g."userId"
  AND g."lastActivityOn" IS NOT NULL
  AND ((last."lastAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date
    = g."lastActivityOn"::date - 1;
