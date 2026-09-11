/**
 * Amostragem estratificada para montar simulados.
 *
 * A versão anterior carregava o banco inteiro de questões, embaralhava em JS e
 * ordenava por peso Pareto. Além do custo, o `sort` por peso fazia o assunto de
 * peso 5 monopolizar a prova inteira e jogava para o fim toda questão sem
 * assunto classificado. Aqui as vagas são distribuídas entre os estratos e só
 * então o banco é consultado — nenhuma consulta traz mais linhas que as vagas.
 */

export interface Stratum {
  /** Assunto do estrato; `null` agrupa as questões ainda não classificadas. */
  key: string | null;
  /** Quantas questões o estrato tem disponíveis. */
  available: number;
  /**
   * Multiplicador de chance do estrato (peso Pareto do assunto). O sorteio já é
   * proporcional ao tamanho do estrato; o peso apenas favorece os assuntos mais
   * frequentes no ENEM sem excluir os demais.
   */
  weight: number;
}

/**
 * Distribui `total` vagas entre os estratos, sorteando cada vaga com chance
 * proporcional a (disponível restante × peso). Devolve as vagas por estrato,
 * nunca acima do disponível. `rng` é injetável para o teste ser determinístico.
 */
export function allocateByWeight(
  strata: Stratum[],
  total: number,
  rng: () => number = Math.random,
): Map<string | null, number> {
  const restante = strata
    .filter((s) => s.available > 0 && s.weight > 0)
    .map((s) => ({ key: s.key, left: s.available, weight: s.weight }));

  const vagas = new Map<string | null, number>();
  const capacidade = restante.reduce((acc, s) => acc + s.left, 0);
  const alvo = Math.min(Math.max(0, Math.trunc(total)), capacidade);

  for (let i = 0; i < alvo; i++) {
    const peso = restante.reduce((acc, s) => acc + s.left * s.weight, 0);
    if (peso <= 0) break;
    let sorteio = rng() * peso;
    let escolhido = restante[restante.length - 1];
    for (const s of restante) {
      sorteio -= s.left * s.weight;
      if (sorteio < 0) {
        escolhido = s;
        break;
      }
    }
    escolhido.left -= 1;
    vagas.set(escolhido.key, (vagas.get(escolhido.key) ?? 0) + 1);
  }

  return vagas;
}

/**
 * Sorteia `take` posições DISTINTAS em [0, total), em ordem crescente
 * (algoritmo de Floyd: sem reposição e sem montar a lista inteira).
 *
 * Não serve ler uma janela contígua a partir de um deslocamento aleatório: os
 * ids das questões importadas saem em sequência, prova por prova, então uma
 * janela de 45 linhas é um bloco consecutivo da mesma prova — e quase sempre
 * da mesma área. Posições espalhadas dão um sorteio de verdade.
 */
export function sampleOffsets(
  total: number,
  take: number,
  rng: () => number = Math.random,
): number[] {
  const k = Math.max(0, Math.min(Math.trunc(take), Math.trunc(total)));
  const escolhidas = new Set<number>();
  for (let j = total - k; j < total; j++) {
    const t = Math.floor(rng() * (j + 1));
    escolhidas.add(escolhidas.has(t) ? j : t);
  }
  return [...escolhidas].sort((a, b) => a - b);
}
