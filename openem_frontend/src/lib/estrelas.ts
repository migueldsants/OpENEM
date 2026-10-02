const COMPACTO = new Intl.NumberFormat('pt-BR', { notation: 'compact' });

/** "1 estrela", "12 estrelas", "1,2 mil estrelas". */
export function rotuloEstrelas(n: number): string {
  return `${COMPACTO.format(n)} ${n === 1 ? 'estrela' : 'estrelas'}`;
}
