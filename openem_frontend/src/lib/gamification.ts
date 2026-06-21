// Estilo visual de cada liga. Classes literais (não construídas dinamicamente)
// para o Tailwind detectá-las. A cor/nome da liga vêm prontos da API.

export interface LeagueStyle {
  text: string;
  soft: string; // fundo tingido suave
  ring: string;
  gradient: string; // classe utilitária com o gradiente da liga
}

export const LEAGUE_STYLE: Record<string, LeagueStyle> = {
  BRONZE: {
    text: 'text-hum',
    soft: 'bg-hum/12',
    ring: 'ring-hum/30',
    gradient: 'league-bronze',
  },
  PRATA: {
    text: 'text-muted',
    soft: 'bg-surface-2',
    ring: 'ring-line',
    gradient: 'league-prata',
  },
  OURO: {
    text: 'text-mat',
    soft: 'bg-mat/12',
    ring: 'ring-mat/30',
    gradient: 'league-ouro',
  },
  PLATINA: {
    text: 'text-lin',
    soft: 'bg-lin/12',
    ring: 'ring-lin/30',
    gradient: 'league-platina',
  },
  DIAMANTE: {
    text: 'text-brand',
    soft: 'bg-brand/12',
    ring: 'ring-brand/30',
    gradient: 'league-diamante',
  },
};

export function leagueStyle(key: string): LeagueStyle {
  return LEAGUE_STYLE[key] ?? LEAGUE_STYLE.BRONZE;
}
