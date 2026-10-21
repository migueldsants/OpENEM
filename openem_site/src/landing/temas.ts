/**
 * Famílias de tema do app (openem_frontend/src/theme.tsx, FAMILIES). A landing
 * mostra cada uma com o próprio CSS do app (<div data-theme>); temas.test.ts
 * confere que a lista acompanha a do app.
 */
export const FAMILIAS: { key: string; label: string }[] = [
  { key: 'default', label: 'Padrão' },
  { key: 'sepia', label: 'Sépia' },
  { key: 'azure', label: 'Azul' },
  { key: 'indigo', label: 'Roxo' },
  { key: 'forest', label: 'Verde' },
  { key: 'gold', label: 'Dourado' },
  { key: 'fire', label: 'Fogo' },
  { key: 'cyberpunk', label: 'Cyberpunk' },
  { key: 'synthwave', label: 'Synthwave' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'arctic', label: 'Ártico' },
  { key: 'sakura', label: 'Sakura' },
  { key: 'ocean', label: 'Oceano' },
  { key: 'oled', label: 'Black' },
  { key: 'eclipse', label: 'Eclipse' },
  { key: 'abyss', label: 'Abissal' },
  { key: 'ember', label: 'Brasa' },
  { key: 'contrast', label: 'Contraste' },
];

/** Lado (claro/escuro) com que cada família aparece na faixa da landing. */
export function ladoDaVitrine(key: string): 'light' | 'dark' {
  // OLED só existe de verdade no escuro; os demais alternam para a faixa ter ritmo.
  if (['oled', 'eclipse', 'abyss', 'ember', 'cyberpunk', 'synthwave', 'terminal'].includes(key)) {
    return 'dark';
  }
  const i = FAMILIAS.findIndex((f) => f.key === key);
  return i % 2 === 0 ? 'light' : 'dark';
}
