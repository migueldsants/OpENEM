// Mapeia a área do conhecimento do ENEM para o seu tom no sistema de cor.
// As classes são literais (não construídas dinamicamente) para o Tailwind detectá-las.

export type AreaKey = 'mat' | 'nat' | 'hum' | 'lin' | 'red' | 'default';

export function areaKey(subjectName?: string): AreaKey {
  const n = (subjectName ?? '').toLowerCase();
  if (n.includes('matem')) return 'mat';
  if (n.includes('natureza')) return 'nat';
  if (n.includes('humanas')) return 'hum';
  if (n.includes('linguagens') || n.includes('linguagem')) return 'lin';
  if (n.includes('redaç') || n.includes('redac')) return 'red';
  return 'default';
}

export const AREA_TEXT: Record<AreaKey, string> = {
  mat: 'text-mat',
  nat: 'text-nat',
  hum: 'text-hum',
  lin: 'text-lin',
  red: 'text-red',
  default: 'text-brand',
};

export const AREA_DOT: Record<AreaKey, string> = {
  mat: 'bg-mat',
  nat: 'bg-nat',
  hum: 'bg-hum',
  lin: 'bg-lin',
  red: 'bg-red',
  default: 'bg-brand',
};

export const AREA_BORDER: Record<AreaKey, string> = {
  mat: 'border-mat',
  nat: 'border-nat',
  hum: 'border-hum',
  lin: 'border-lin',
  red: 'border-red',
  default: 'border-brand',
};

// Fundo tingido suave (mistura com a superfície via opacidade).
export const AREA_SOFT: Record<AreaKey, string> = {
  mat: 'bg-mat/12',
  nat: 'bg-nat/12',
  hum: 'bg-hum/12',
  lin: 'bg-lin/12',
  red: 'bg-red/12',
  default: 'bg-brand/12',
};

export const AREAS: { key: AreaKey; label: string; emoji: string }[] = [
  { key: 'mat', label: 'Matemática', emoji: '🧮' },
  { key: 'nat', label: 'Natureza', emoji: '🧪' },
  { key: 'hum', label: 'Humanas', emoji: '🌍' },
  { key: 'lin', label: 'Linguagens', emoji: '📖' },
  { key: 'red', label: 'Redação', emoji: '✍️' },
];

// Rótulo curto pelo nome completo do subject (ex.: "Matemática e suas Tecnologias").
export function shortArea(subjectName?: string): string {
  const key = areaKey(subjectName);
  return AREAS.find((a) => a.key === key)?.label ?? 'Geral';
}

// Emoji da área pelo nome completo do subject.
export function areaEmoji(subjectName?: string): string {
  const key = areaKey(subjectName);
  return AREAS.find((a) => a.key === key)?.emoji ?? '📚';
}

// Fundo de badge suave por área.
export const AREA_BADGE: Record<AreaKey, string> = {
  mat: 'bg-mat/12 text-mat',
  nat: 'bg-nat/12 text-nat',
  hum: 'bg-hum/12 text-hum',
  lin: 'bg-lin/12 text-lin',
  red: 'bg-red/12 text-red',
  default: 'bg-brand/12 text-brand',
};

// Borda colorida por área.
export const AREA_RING: Record<AreaKey, string> = {
  mat: 'ring-mat/30',
  nat: 'ring-nat/30',
  hum: 'ring-hum/30',
  lin: 'ring-lin/30',
  red: 'ring-red/30',
  default: 'ring-brand/30',
};
