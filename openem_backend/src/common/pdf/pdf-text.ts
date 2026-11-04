/**
 * Texto de questão pronto para o PDF. Puro e testado.
 *
 * O texto das questões vem de extração de PDF e traz o que uma fonte de PDF
 * não espera: acento decomposto (a letra seguida do acento combinante, em
 * vez do caractere acentuado), caractere de controle que sobrou da extração e
 * símbolos que existem com outro código no Unicode. Aqui isso vira o
 * caractere que a fonte do caderno tem, sem mudar o que o texto diz.
 */

/**
 * Trocas que não mudam o sentido: o mesmo símbolo com outro código, ou a
 * forma escrita do que a fonte não tem.
 */
const TROCAS: Record<string, string> = {
  '⋅': '·', // ⋅ (operador ponto) → · (ponto médio): "k⋅m"
  '\u{1D70B}': 'π', // 𝜋 (pi itálico matemático) → π
  ꞌ: '’', // ꞌ (saltillo) → ’: "Didnꞌt" na letra de música
  '∼': '~', // ∼ (til de operador) → ~: "∼600 nm"
  '─': '—', // ─ (traço de desenho de caixa) → —
  Ԑ: 'ε', // Ԑ (cirílico) → ε: a tensão nominal "Ԑ" é épsilon
  '∛': '³√', // ∛ → ³√
};

/**
 * Caractere de controle (C0 sem \t e \n, DEL e C1) e área de uso privado:
 * restos da extração, que nenhuma fonte desenha.
 */
// eslint-disable-next-line no-control-regex
const LIXO = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F-]/g;

/** Texto de questão com acentos compostos, sem lixo de extração e com as trocas. */
export function pdfSafeText(texto: string): string {
  let saida = texto.normalize('NFC').replace(LIXO, '');
  for (const [de, para] of Object.entries(TROCAS)) {
    if (saida.includes(de)) saida = saida.split(de).join(para);
  }
  return saida;
}

export interface TextRun {
  text: string;
  /** Desenhar com a fonte de símbolos. */
  fallback: boolean;
}

/**
 * Parte o texto em trechos pela fonte que desenha cada caractere: a principal
 * quando ela tem o glifo; a de símbolos quando só ela tem. Sem glifo em
 * nenhuma, fica na principal (o PDF mostra o quadrado de glifo ausente, mas o
 * texto continua copiável).
 */
export function splitRuns(
  texto: string,
  temNaPrincipal: (cp: number) => boolean,
  temNaReserva: (cp: number) => boolean,
): TextRun[] {
  const runs: TextRun[] = [];
  for (const c of texto) {
    const cp = c.codePointAt(0)!;
    const fallback = !temNaPrincipal(cp) && temNaReserva(cp);
    const ultimo = runs[runs.length - 1];
    if (ultimo && ultimo.fallback === fallback) ultimo.text += c;
    else runs.push({ text: c, fallback });
  }
  return runs;
}
