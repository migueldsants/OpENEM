// Funções puras compartilhadas pelo criar.mjs (o build.mjs tem as suas, que
// antecedem este arquivo).

// Resíduo de extração: área privada/replacement, mojibake, marcador de
// expoente que não virou texto, ou fórmula desmontada em letras soltas.
const PUA = /[\ue000-\uf8ff\ufffd\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const MOJIBAKE = /Ã[\u0080-¿]|â€/;
const MARCADOR = /\^\(|_\([^\s)]{1,6}\)(?!_)/;
const FORMULA_SOLTA = /(^|\s)\S\s\S\s\S\s\S\s\S(\s|$)/;

export function lixoso(q) {
  const txt = [q.context, q.alternativesIntroduction, ...q.alternatives.map((a) => a.text)].filter(Boolean).join('\n');
  return PUA.test(txt) || MOJIBAKE.test(txt) || MARCADOR.test(txt) || q.alternatives.some((a) => FORMULA_SOLTA.test(a.text || ''));
}

export const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function shingles(s) {
  const w = norm(s).split(' ').filter((x) => x.length >= 2);
  const out = new Set();
  for (let i = 0; i + 2 < w.length; i++) out.add(w.slice(i, i + 3).join(' '));
  return out;
}

/** Quanto de `a` aparece em `b` (0..1). */
export function contencao(a, b) {
  if (!a.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / a.size;
}

// Só palavras que não existem em português: o comando da questão é sempre em
// português e puxaria a contagem.
const EN = new Set('the and of to is in that it you for are with this be on was your have will we they he she his her my our their what when which who an at by from or'.split(' '));
const ES = new Set('el los las y del una un es por con su sus lo al pero muy esta este hay cuando donde mas tambien entre sobre hasta desde porque ya yo'.split(' '));

/** Idioma de uma questão de língua estrangeira, olhando só o texto de apoio. */
export function idioma(q) {
  const textos = q.blocos.filter((b) => b.text && !b.formula).map((b) => b.text);
  const apoio = textos.length > 1 ? textos.slice(0, -1).join(' ') : textos.join(' ');
  const ws = norm(apoio).split(' ');
  const en = ws.filter((w) => EN.has(w)).length;
  const es = ws.filter((w) => ES.has(w)).length;
  if (en === es) return null;
  return en > es ? 'ingles' : 'espanhol';
}

/**
 * Área pela posição no caderno — a mesma regra do import do OpENEM
 * (`areaBlocks`). A prova pode fixar a ordem em `areas`; o ENEM antigo
 * (1998–2008) não tem áreas e fica sem.
 */
export function areaPorNumero(cfg, n) {
  if (cfg.semAreas) return null;
  const blocos =
    cfg.areas ??
    (cfg.ano >= 2017
      ? ['linguagens', 'ciencias-humanas', 'ciencias-natureza', 'matematica']
      : cfg.ano === 2009
        ? ['ciencias-natureza', 'ciencias-humanas', 'linguagens', 'matematica']
        : ['ciencias-humanas', 'ciencias-natureza', 'linguagens', 'matematica']);
  return blocos[Math.floor((n - 1) / 45)] ?? null;
}

export const DISCIPLINAS = [
  { label: 'Ciências Humanas e suas Tecnologias', value: 'ciencias-humanas' },
  { label: 'Ciências da Natureza e suas Tecnologias', value: 'ciencias-natureza' },
  { label: 'Linguagens, Códigos e suas Tecnologias', value: 'linguagens' },
  { label: 'Matemática e suas Tecnologias', value: 'matematica' },
];

export const IDIOMAS = [
  { label: 'Espanhol', value: 'espanhol' },
  { label: 'Inglês', value: 'ingles' },
];
