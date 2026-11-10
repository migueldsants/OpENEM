/**
 * Quantas colunas cada cartão da lista de simulações ocupa para a matéria
 * fechar as fileiras sem buraco. A fileira incompleta vai na frente e se
 * divide na largura toda (a tela põe as cenas 3D primeiro, então são elas que
 * ganham destaque); as demais fileiras ficam com um cartão por coluna.
 * `colunas` é 2 (tablet) ou 3 (desktop).
 */
export function vaos(n: number, colunas: number): number[] {
  const out = Array<number>(n).fill(1);
  const r = n % colunas;
  if (r === 0) return out;
  const base = Math.floor(colunas / r);
  const sobra = colunas % r;
  for (let i = 0; i < r; i++) out[i] = base + (i < sobra ? 1 : 0);
  return out;
}
