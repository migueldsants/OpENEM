-- GameScore sai junto com o GamesModule: o placar vinha do cliente e virava
-- XP sem teto. O XP já concedido continua em GamificationStat.

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GameScore";
PRAGMA foreign_keys=on;

