import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown';

// Renderiza todos os flashcards do catálogo (seed do backend) com o mesmo
// <Markdown> das telas. Pega dois erros que só aparecem na renderização:
// fórmula que o KaTeX não entende e "R$" que o remark-math toma por início de
// fórmula (o texto entre dois cifrões vira LaTeX em itálico).

// Sobe diretórios até achar o backend: vale no repositório e também dentro da
// sandbox do Stryker (openem_frontend/.stryker-tmp/sandbox-*).
function seedPath(): string {
  const rel = join('openem_backend', 'prisma', 'seed-flashcards-data.json');
  for (let dir = __dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, rel);
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) throw new Error(`${rel} não encontrado acima de ${__dirname}`);
  }
}

const decks = JSON.parse(readFileSync(seedPath(), 'utf8')) as {
  title: string;
  cards: [string, string][];
}[];

const TEX = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g;
// Duas palavras seguidas fora de \text{} dentro de uma fórmula = prosa virando math.
const PROSE = /\s[a-záéíóúâêôãõç]{4,}\s[a-záéíóúâêôãõç]{4,}\s/i;

describe('flashcards do seed renderizados pelo <Markdown>', () => {
  it('todas as fórmulas renderizam e nenhum texto vira fórmula', () => {
    const problems: string[] = [];
    for (const deck of decks) {
      deck.cards.forEach((card, i) => {
        for (const text of card) {
          const html = renderToStaticMarkup(<Markdown>{text}</Markdown>);
          if (html.includes('katex-error')) problems.push(`${deck.title}#${i}: erro de KaTeX`);
          for (const [, tex] of html.matchAll(TEX)) {
            if (PROSE.test(tex) && !tex.includes('\\text')) {
              problems.push(`${deck.title}#${i}: texto dentro de fórmula: ${tex.slice(0, 60)}`);
            }
          }
        }
      });
    }
    expect(problems).toEqual([]);
    // ~2 mil cards com KaTeX: leva alguns segundos, acima do limite padrão.
  }, 60_000);
});
