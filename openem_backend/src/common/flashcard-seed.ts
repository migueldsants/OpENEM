/**
 * Sincronização dos decks do catálogo (`prisma/seed-flashcards-data.json`) com
 * o banco.
 *
 * O seed antigo só criava decks que ainda não existiam: card novo num deck
 * antigo e correção de texto nunca chegavam a um banco já semeado. Aqui o card
 * é casado pela posição (`order`), não pelo texto — assim uma correção de
 * enunciado atualiza o mesmo registro e o progresso SM-2 do aluno
 * (`FlashcardReview`) continua valendo.
 */

export type SeedCard = [front: string, back: string];

export interface SeedDeck {
  title: string;
  /** Título antigo do deck: o seed renomeia o registro em vez de criar outro. */
  formerTitle?: string;
  description: string;
  subject: string;
  topic: string | null;
  subtheme: string | null;
  icon: string;
  weight: number;
  cards: SeedCard[];
}

export interface ExistingCard {
  id: string;
  order: number;
  front: string;
  back: string;
}

export interface DeckSyncPlan {
  create: { order: number; front: string; back: string }[];
  update: { id: string; front: string; back: string }[];
  /** Cards de catálogo que saíram do seed (posição além do fim). */
  remove: string[];
}

/**
 * Compara os cards gravados com os do seed. Posição repetida no banco (não
 * deveria acontecer, mas `order` não é único) fica com o primeiro registro
 * recebido e os demais saem, para o deck não mostrar o mesmo card duas vezes.
 */
export function planDeckSync(
  existing: ExistingCard[],
  cards: SeedCard[],
): DeckSyncPlan {
  const byOrder = new Map<number, ExistingCard>();
  const remove: string[] = [];
  for (const card of existing) {
    if (
      byOrder.has(card.order) ||
      card.order < 0 ||
      card.order >= cards.length
    ) {
      remove.push(card.id);
    } else {
      byOrder.set(card.order, card);
    }
  }

  const create: DeckSyncPlan['create'] = [];
  const update: DeckSyncPlan['update'] = [];
  cards.forEach(([front, back], order) => {
    const current = byOrder.get(order);
    if (!current) {
      create.push({ order, front, back });
    } else if (current.front !== front || current.back !== back) {
      update.push({ id: current.id, front, back });
    }
  });

  return { create, update, remove };
}
