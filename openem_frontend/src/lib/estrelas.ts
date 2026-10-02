const COMPACTO = new Intl.NumberFormat('pt-BR', { notation: 'compact' });

/** "27", "1,2 mil": o número do botão de estrela. */
export function numeroEstrelas(n: number): string {
  return COMPACTO.format(n);
}

/** "1 estrela", "12 estrelas", "1,2 mil estrelas". */
export function rotuloEstrelas(n: number): string {
  return `${numeroEstrelas(n)} ${n === 1 ? 'estrela' : 'estrelas'}`;
}
