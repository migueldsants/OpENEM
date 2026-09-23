// gid → caractere, a partir das fontes do Windows (a numeração de glifo do
// subconjunto embutido no PDF é a da fonte original: "g38" = gid 38).
import * as fontkit from 'fontkit';
import { SYMBOL } from './symbol.mjs';
const ARQ = {
  ArialMT: 'arial.ttf', 'Arial-BoldMT': 'arialbd.ttf', 'Arial-ItalicMT': 'ariali.ttf',
  'Arial-BoldItalicMT': 'arialbi.ttf', Arial: 'arial.ttf', Tahoma: 'tahoma.ttf', 'Tahoma-Bold': 'tahomabd.ttf',
  TimesNewRomanPSMT: 'times.ttf', SymbolMT: 'symbol.ttf', 'TimesNewRomanPS-BoldMT': 'timesbd.ttf', 'TimesNewRomanPS-ItalicMT': 'timesi.ttf',
};
const cache = new Map();
export function gidTable(psName) {
  const base = psName.replace(/^[A-Z]{6}\+/, '');
  const arq = ARQ[base];
  if (!arq) return null;
  if (cache.has(arq)) return cache.get(arq);
  const font = fontkit.openSync('C:/Windows/Fonts/' + arq);
  const map = new Map();
  if (arq === 'symbol.ttf') {
    for (let cp = 0xf020; cp <= 0xf0ff; cp++) {
      const id = font.glyphForCodePoint(cp).id;
      if (id && !map.has(id)) map.set(id, SYMBOL[cp - 0xf000] ?? String.fromCharCode(cp - 0xf000));
    }
    cache.set(arq, map);
    return map;
  }
  for (const cp of font.characterSet) {
    const g = font.glyphForCodePoint(cp);
    const sym = arq === 'symbol.ttf';
    const pref = (c) => (sym ? (c >= 0xf000 && c <= 0xf0ff ? 0 : 1) : 0) * 1e6 + c;
    if (!map.has(g.id) || pref(cp) < pref(map.get(g.id).codePointAt(0))) map.set(g.id, String.fromCodePoint(cp));
  }
  // ligaduras sem codepoint direto
  for (let id = 0; id < font.numGlyphs; id++) {
    if (map.has(id)) continue;
    const n = font.getGlyph(id).name;
    if (n === 'fi' || n === 'uniFB01') map.set(id, 'fi');
    if (n === 'fl' || n === 'uniFB02') map.set(id, 'fl');
  }
  cache.set(arq, map);
  return map;
}
