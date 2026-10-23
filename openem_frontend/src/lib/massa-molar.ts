// Calculadora de massa molar: lê a fórmula (parênteses, colchetes, hidratos
// com "·", índices normais ou subscritos) e soma as massas da própria tabela.
// Puro e testado.

export type ResultadoFormula =
  | { ok: true; contagem: Map<string, number>; ordem: string[] }
  | { ok: false; erro: string; posicao: number };

const SUBSCRITOS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

const ABRE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const SEPARADORES_HIDRATO = new Set(['·', '•', '∙', '.', '*']);

/**
 * Lê uma fórmula como "Ca(OH)2", "CuSO4·5H2O" ou "K₄[Fe(CN)₆]" e devolve
 * quantos átomos de cada elemento ela tem, na ordem em que aparecem.
 * `simbolos` são os símbolos válidos (os da tabela): "Xy" vira erro, e não um
 * elemento inventado.
 */
export function lerFormula(texto: string, simbolos: ReadonlySet<string>): ResultadoFormula {
  const f = texto.replace(/[₀-₉]/g, (c) => SUBSCRITOS[c]).replace(/\s+/g, '');
  if (!f) return { ok: false, erro: 'Digite uma fórmula.', posicao: 0 };
  let i = 0;
  const ordem: string[] = [];

  const numero = (): number | null => {
    const m = /^\d+/.exec(f.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };

  // Lê uma sequência de grupos até `fecha` (ou o fim, ou um separador de hidrato).
  const grupo = (fecha: string | null): Map<string, number> | { erro: string; posicao: number } => {
    const acc = new Map<string, number>();
    const somar = (m: Map<string, number>, vezes: number) => {
      for (const [k, v] of m) acc.set(k, (acc.get(k) ?? 0) + v * vezes);
    };
    while (i < f.length) {
      const c = f[i];
      if (fecha && c === fecha) return acc;
      if (Object.values(ABRE).includes(c)) return { erro: `"${c}" fecha um parêntese que não foi aberto.`, posicao: i };
      if (!fecha && SEPARADORES_HIDRATO.has(c)) return acc;
      if (ABRE[c]) {
        const inicio = i;
        i++;
        const dentro = grupo(ABRE[c]);
        if (!(dentro instanceof Map)) return dentro;
        if (f[i] !== ABRE[c]) return { erro: `Falta fechar o "${c}".`, posicao: inicio };
        i++;
        if (dentro.size === 0) return { erro: 'Parênteses vazios.', posicao: inicio };
        const n = numero();
        if (n === 0) return { erro: 'Índice zero.', posicao: i - 1 };
        somar(dentro, n ?? 1);
        continue;
      }
      if (/[A-Z]/.test(c)) {
        const inicio = i;
        const m = /^[A-Z][a-z]?/.exec(f.slice(i))!;
        let sim = m[0];
        // "Co" é cobalto, mas "CO" é carbono e oxigênio: só junta a minúscula
        // se o símbolo de duas letras existe.
        if (sim.length === 2 && !simbolos.has(sim)) sim = sim[0];
        if (!simbolos.has(sim)) return { erro: `"${m[0]}" não é o símbolo de um elemento.`, posicao: inicio };
        i += sim.length;
        if (!ordem.includes(sim)) ordem.push(sim);
        const n = numero();
        if (n === 0) return { erro: 'Índice zero.', posicao: i - 1 };
        acc.set(sim, (acc.get(sim) ?? 0) + (n ?? 1));
        continue;
      }
      if (/[a-z]/.test(c)) return { erro: `"${c}": o símbolo começa com letra maiúscula.`, posicao: i };
      if (/\d/.test(c)) return { erro: 'Número fora do lugar: o índice vem depois do símbolo.', posicao: i };
      return { erro: `"${c}" não faz parte de uma fórmula.`, posicao: i };
    }
    if (fecha) return { erro: `Falta fechar com "${fecha}".`, posicao: f.length };
    return acc;
  };

  const total = new Map<string, number>();
  let primeira = true;
  while (i < f.length || primeira) {
    if (!primeira) i++; // pula o separador do hidrato
    // Coeficiente da parte: o "5" de "·5H2O" (ou "2" em "2H2O").
    const coef = numero() ?? 1;
    if (coef === 0) return { ok: false, erro: 'Coeficiente zero.', posicao: i - 1 };
    const parte = grupo(null);
    if (!(parte instanceof Map)) return { ok: false, ...parte };
    if (parte.size === 0) {
      return { ok: false, erro: primeira ? 'Digite uma fórmula.' : 'Falta a fórmula depois do "·".', posicao: i };
    }
    for (const [k, v] of parte) total.set(k, (total.get(k) ?? 0) + v * coef);
    primeira = false;
    if (i >= f.length) break;
  }
  return { ok: true, contagem: total, ordem };
}

export interface ParcelaMassa {
  simbolo: string;
  atomos: number;
  massaAtomica: number;
  massa: number;
  /** Porcentagem em massa (0–100). */
  porcentagem: number;
}

/** Massa molar (g/mol) e composição percentual, na ordem da fórmula. */
export function massaMolar(
  contagem: Map<string, number>,
  ordem: string[],
  massas: ReadonlyMap<string, number>,
): { total: number; parcelas: ParcelaMassa[] } {
  const parcelas = ordem.map((simbolo) => {
    const atomos = contagem.get(simbolo) ?? 0;
    const massaAtomica = massas.get(simbolo) ?? Number.NaN;
    return { simbolo, atomos, massaAtomica, massa: atomos * massaAtomica, porcentagem: 0 };
  });
  const total = parcelas.reduce((t, p) => t + p.massa, 0);
  for (const p of parcelas) p.porcentagem = total > 0 ? (p.massa / total) * 100 : 0;
  return { total, parcelas };
}
