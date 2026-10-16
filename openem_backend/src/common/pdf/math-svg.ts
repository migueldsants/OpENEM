/**
 * LaTeX → SVG, para desenhar fórmula como vetor no PDF.
 *
 * PDFKit não sabe tipografar matemática. O MathJax (versão para Node, sem
 * navegador) monta a fórmula e devolve um SVG com os glifos já em caminhos;
 * o `svg-to-pdfkit` pinta esse SVG na página. O resultado é nítido em
 * qualquer zoom e na impressão, e não depende de fonte instalada.
 */

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
// Só os pacotes do TeX que as fórmulas usam (cada import registra o seu). A
// fórmula personalizada vem do aluno: pacote a mais é superfície a mais.
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import 'mathjax-full/js/input/tex/cancel/CancelConfiguration.js';
import 'mathjax-full/js/input/tex/gensymb/GensymbConfiguration.js';
import 'mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import 'mathjax-full/js/input/tex/textmacros/TextMacrosConfiguration.js';
import 'mathjax-full/js/input/tex/upgreek/UpgreekConfiguration.js';

/**
 * Pacotes do TeX ligados. `noundefined` pinta comando desconhecido de vermelho
 * (é assim que `error` detecta), `textmacros` dá os acentos dentro de \text e
 * `ams` o \underset da cedilha (ver normalizeLatex).
 */
export const TEX_PACKAGES = [
  'base',
  'ams',
  'boldsymbol',
  'cancel',
  'gensymb',
  'mhchem',
  'noundefined',
  'textmacros',
  'upgreek',
];

export interface MathSvg {
  svg: string;
  /** Medidas em "ex" (altura do x da fonte do MathJax). */
  widthEx: number;
  heightEx: number;
  /** Quanto a fórmula desce abaixo da linha de base (frações, subscritos). */
  depthEx: number;
  /** A expressão não compilou: o SVG traz o texto de erro do MathJax. */
  error: boolean;
}

/**
 * Letra acentuada → acento do TeX (pacote textmacros), que o MathJax desenha
 * com os glifos da própria fonte. A fonte não tem "ç" nem "ã" prontos, e sem
 * navegador para medir ele erra a largura de letra desconhecida: "solução"
 * saía como "soluç ã o". (O textmacros não tem \i sem pingo: "í" sai com o\n * acento sobre o i normal, que ainda se lê bem.)
 */
const ACENTOS: Record<string, string> = {
  // O textmacros não tem \i (i sem pingo): o acento vai sobre o i normal.
  á: "\\'a",
  é: "\\'e",
  í: "\\'i",
  ó: "\\'o",
  ú: "\\'u",
  Á: "\\'A",
  É: "\\'E",
  Í: "\\'I",
  Ó: "\\'O",
  Ú: "\\'U",
  â: '\\^a',
  ê: '\\^e',
  ô: '\\^o',
  Â: '\\^A',
  Ê: '\\^E',
  Ô: '\\^O',
  ã: '\\~a',
  õ: '\\~o',
  Ã: '\\~A',
  Õ: '\\~O',
  à: '\\`a',
  À: '\\`A',
  ü: '\\"u',
};
const LETRA_ACENTUADA = new RegExp(`[${Object.keys(ACENTOS).join('')}]`, 'g');

/**
 * Cedilha não existe nem no textmacros: é o "c" com uma vírgula miúda logo
 * abaixo, tudo com glifos do MathJax. Vale fora de \text (modo matemático).
 */
const cedilha = (c: 'c' | 'C') =>
  `\\underset{\\raise{0.62em}{\\scriptscriptstyle ,}}{\\text{${c}}}`;

/**
 * Ajustes antes de compilar.
 *
 * 1. `\c{c}` e `\acute{a}` fora de `\text{}` são acentos de modo texto usados
 *    em modo matemático: viram erro vermelho no KaTeX e no MathJax. Uma
 *    fórmula de aluno pode trazer isso, então viram a letra certa.
 * 2. A fonte do MathJax não tem letras acentuadas: "solução" sairia numa
 *    fonte do sistema, com espaçamento quebrado. Dentro de `\text{}` a letra
 *    vira o acento do TeX (pacote textmacros); fora, ganha um `\text{}`.
 */
export function normalizeLatex(latex: string): string {
  const unicode = latex
    .replace(/\\c\{c\}/g, 'ç')
    .replace(/\\c\{C\}/g, 'Ç')
    // "\c{a}" não existe em português: é "ã" digitado com o acento errado.
    .replace(/\\c\{a\}/g, 'ã')
    .replace(
      /\\~\{?([aon])\}?/g,
      (_, v: string) => ({ a: 'ã', o: 'õ', n: 'ñ' })[v] ?? v,
    )
    .replace(
      /\\acute\{([aeiou])\}/g,
      (_, v: string) => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' })[v] ?? v,
    )
    .trim();

  const foraDoTexto = (s: string) =>
    s
      .replace(/[çÇ]/g, (c) => cedilha(c === 'ç' ? 'c' : 'C'))
      .replace(LETRA_ACENTUADA, (c) => `\\text{${ACENTOS[c]}}`);
  // Dentro de \text a cedilha fecha o texto, entra em modo matemático e reabre.
  const dentroDoTexto = (s: string) =>
    `\\text{${s
      .replace(LETRA_ACENTUADA, (c) => ACENTOS[c])
      .replace(
        /[çÇ]/g,
        (c) => `}${cedilha(c === 'ç' ? 'c' : 'C')}\\text{`,
      )}}`.replace(/\\text\{\}/g, '');

  // Separa os trechos \text{...} (sem chaves aninhadas, como no catálogo) do resto.
  let out = '';
  let last = 0;
  for (const m of unicode.matchAll(/\\text\{([^{}]*)\}/g)) {
    out += foraDoTexto(unicode.slice(last, m.index));
    out += dentroDoTexto(m[1]);
    last = m.index + m[0].length;
  }
  return out + foraDoTexto(unicode.slice(last));
}

/**
 * Tira do SVG qualquer elemento de imagem: a fórmula é só vetor, e nada além
 * de caminhos e texto deve chegar ao `svg-to-pdfkit`.
 */
export function semImagens(svg: string): string {
  return svg
    .replace(/<image\b[^>]*\/>/gi, '')
    .replace(/<image\b[^>]*>[\s\S]*?<\/image\s*>/gi, '')
    .replace(/<\/?image\b[^>]*>/gi, '');
}

type Converter = (latex: string, display: boolean) => MathSvg;

let converter: Converter | null = null;

/** Carrega o MathJax uma vez só: montar o documento custa ~100 ms. */
function getConverter(): Converter {
  if (converter) return converter;
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const doc = mathjax.document('', {
    InputJax: new TeX({ packages: TEX_PACKAGES }),
    // Sem cache de glifos: cada SVG precisa ser autossuficiente, porque é
    // pintado sozinho no PDF (o cache usa <use> apontando para outro SVG).
    OutputJax: new SVG({ fontCache: 'none' }),
  });

  converter = (latex, display) => {
    // `convert` é tipado como `any` no MathJax; no adaptador lite é um nó lite.
    const node = doc.convert(latex, { display }) as LiteElement;
    const svg = semImagens(adaptor.innerHTML(node));
    const num = (re: RegExp) => Number(re.exec(svg)?.[1] ?? 0);
    const widthEx = num(/width="([\d.]+)ex"/);
    const heightEx = num(/height="([\d.]+)ex"/);
    // vertical-align negativo = quanto a caixa desce abaixo da linha de base.
    const depthEx = -num(/vertical-align:\s*(-?[\d.]+)ex/);
    // Comando desconhecido sai pintado de vermelho (pacote noundefined);
    // erro de sintaxe vira um nó merror.
    const error = /data-mml-node="merror"|fill="red"/.test(svg);
    return { svg, widthEx, heightEx, depthEx: Math.max(0, depthEx), error };
  };
  return converter;
}

/** Desenhado no lugar de uma expressão que derruba o MathJax. */
const FORMULA_QUEBRADA = '\\text{?}';

/**
 * Converte uma expressão. `display` = fórmula em destaque (frações maiores).
 * Algumas entradas (caractere de controle, por exemplo) fazem o MathJax lançar
 * exceção em vez de marcar erro; aí sai um "?" marcado como erro, e o resto do
 * caderno continua.
 */
export function texToSvg(latex: string, display = true): MathSvg {
  const converter = getConverter();
  try {
    return converter(normalizeLatex(latex), display);
  } catch {
    return { ...converter(FORMULA_QUEBRADA, display), error: true };
  }
}
