import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SeedDeck } from '../common/flashcard-seed';

/**
 * Trava de qualidade do catálogo de flashcards (prisma/seed-flashcards-data.json).
 * O seed sincroniza estes decks com bancos já em uso, então um erro aqui chega
 * a todos os alunos: estes testes pegam o que dá para pegar sem ler os cards.
 */
const decks = JSON.parse(
  readFileSync(
    join(__dirname, '../../prisma/seed-flashcards-data.json'),
    'utf8',
  ),
) as SeedDeck[];

const AREAS = [
  'Matemática e suas Tecnologias',
  'Ciências da Natureza e suas Tecnologias',
  'Ciências Humanas e suas Tecnologias',
  'Linguagens, Códigos e suas Tecnologias',
];

// Chaves que o front sabe desenhar (openem_frontend/src/lib/achievement-icon.ts).
const ICONS = [
  'dna',
  'lightning',
  'globe',
  'scroll',
  'book',
  'calculator',
  'flask',
  'run',
  'pen-nib',
];

const allText = (d: SeedDeck) => d.cards.flat();

describe('catálogo de flashcards do seed', () => {
  it('todo deck está numa das quatro áreas do ENEM, com ícone e peso válidos', () => {
    for (const d of decks) {
      expect(AREAS).toContain(d.subject);
      expect(ICONS).toContain(d.icon);
      expect(Number.isInteger(d.weight) && d.weight >= 1 && d.weight <= 5).toBe(
        true,
      );
      expect(d.description.startsWith(d.title)).toBe(true);
    }
  });

  it('título é único por área e o título antigo não colide com outro deck', () => {
    const keys = new Set<string>();
    for (const d of decks) {
      const key = `${d.subject}|${d.title}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    for (const d of decks) {
      if (d.formerTitle)
        expect(keys.has(`${d.subject}|${d.formerTitle}`)).toBe(false);
    }
  });

  it('todo deck tem pelo menos 5 cards, sem frente repetida nem lado vazio', () => {
    for (const d of decks) {
      expect(d.cards.length).toBeGreaterThanOrEqual(5);
      const fronts = new Set<string>();
      for (const [front, back] of d.cards) {
        expect(front.trim()).not.toBe('');
        expect(back.trim()).not.toBe('');
        expect(fronts.has(front)).toBe(false);
        fronts.add(front);
      }
    }
  });

  it('não sobra lixo de ferramenta nem caractere de outro alfabeto', () => {
    for (const d of decks) {
      for (const text of allText(d)) {
        expect(text).not.toMatch(/<!--|_rights|�/);
        expect(text).not.toMatch(/[぀-ヿ㐀-鿿가-힯]/);
      }
    }
  });

  it('cifrões de fórmula fecham e "R$" nunca vira fórmula no remark-math', () => {
    for (const d of decks) {
      for (const text of allText(d)) {
        // Fora da fórmula a moeda vai escapada (R\$); dentro, \textdollar.
        expect(text).not.toMatch(/(?<![\\\w{$])R\$(?= ?-?\d)/);
        expect(text).not.toMatch(/\\text\{R\\\$/);
        const dollars = (text.replace(/\\\$/g, '').match(/\$/g) ?? []).length;
        expect(dollars % 2).toBe(0);
      }
    }
  });
});
