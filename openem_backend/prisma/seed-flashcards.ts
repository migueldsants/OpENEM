import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planDeckSync, type SeedDeck } from '../src/common/flashcard-seed';

const prisma = new PrismaClient();

async function main() {
  const dataPath = join(__dirname, 'seed-flashcards-data.json');
  const decks = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedDeck[];

  console.log(`Semeando ${decks.length} decks de flashcards (seed-flashcards)...`);

  let created = 0;
  let updated = 0;
  let cardsTouched = 0;
  for (const deck of decks) {
    // Só decks do catálogo (sem dono): um deck de aluno com o mesmo título
    // nunca é tocado. `formerTitle` acha o registro de antes de um renome.
    const titles = deck.formerTitle ? [deck.title, deck.formerTitle] : [deck.title];
    const existing = await prisma.flashcardDeck.findFirst({
      where: { userId: null, subject: deck.subject, title: { in: titles } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        flashcards: { select: { id: true, order: true, front: true, back: true } },
      },
    });

    if (!existing) {
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
      continue;
    }

    // Deck já existe — realinha título/taxonomia e sincroniza os cards pela
    // posição, para correções e cards novos chegarem a bancos já semeados.
    const plan = planDeckSync(existing.flashcards, deck.cards);
    await prisma.$transaction([
      prisma.flashcardDeck.update({
        where: { id: existing.id },
        data: {
          title: deck.title,
          description: deck.description,
          subject: deck.subject,
          topic: deck.topic,
          subtheme: deck.subtheme,
          icon: deck.icon,
          weight: deck.weight,
        },
      }),
      ...plan.update.map((c) =>
        prisma.flashcard.update({ where: { id: c.id }, data: { front: c.front, back: c.back } }),
      ),
      ...(plan.create.length
        ? [
            prisma.flashcard.createMany({
              data: plan.create.map((c) => ({ ...c, deckId: existing.id })),
            }),
          ]
        : []),
      ...(plan.remove.length
        ? [prisma.flashcard.deleteMany({ where: { id: { in: plan.remove } } })]
        : []),
    ]);
    cardsTouched += plan.update.length + plan.create.length + plan.remove.length;
    updated++;
  }

  const total = await prisma.flashcard.count();
  console.log(
    `  OK: ${created} decks criados, ${updated} sincronizados (${cardsTouched} cards alterados). Total: ${total} flashcards.`,
  );
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
