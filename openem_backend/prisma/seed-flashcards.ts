import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

interface SeedDeck {
  title: string;
  description: string;
  subject: string;
  topic: string | null;
  subtheme: string | null;
  icon: string;
  weight: number;
  cards: [front: string, back: string][];
}

async function main() {
  const dataPath = join(__dirname, 'seed-flashcards-data.json');
  const decks = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedDeck[];

  console.log(`🌱 Semeando ${decks.length} decks de flashcards (seed-flashcards)...`);

  let created = 0;
  let updated = 0;
  for (const deck of decks) {
    const existing = await prisma.flashcardDeck.findFirst({
      where: { title: deck.title, topic: deck.topic ?? undefined, subtheme: deck.subtheme ?? undefined },
      select: { id: true },
    });
    if (existing) {
      // Deck já existe — realinha a taxonomia (ex.: Redação migrou para Linguagens).
      await prisma.flashcardDeck.update({
        where: { id: existing.id },
        data: {
          subject: deck.subject,
          topic: deck.topic,
          subtheme: deck.subtheme,
          icon: deck.icon,
          weight: deck.weight,
        },
      });
      updated++;
      continue;
    }

    await prisma.flashcardDeck.create({
      data: {
        title: deck.title,
        description: deck.description,
        subject: deck.subject,
        topic: deck.topic,
        subtheme: deck.subtheme,
        icon: deck.icon,
        weight: deck.weight,
        isPublic: true,
        flashcards: {
          create: deck.cards.map(([front, back], i) => ({ front, back, order: i })),
        },
      },
    });
    created++;
  }

  const total = await prisma.flashcard.count();
  console.log(`  ✔ ${created} decks criados (${updated} realinhados). Total: ${total} flashcards.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
