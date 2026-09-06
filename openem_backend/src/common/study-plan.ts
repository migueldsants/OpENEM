// Gerador de cronograma de estudos (ver docs/PRD.md §6 E1).
//
// O plano trabalha em MATÉRIAS, não em subtópicos: o calendário mostra
// "Matemática", não "Análise combinatória". Antes o gerador puxava os 5
// tópicos alfabeticamente primeiros quando não havia histórico, o que fazia a
// semana inteira cair em duas ou três matérias repetindo o mesmo subtópico.
//
// O plano gerado é só um ponto de partida: cada bloco é editável na tela.

export interface PlanSubject {
  /** Matéria do catálogo do ENEM; nulo em blocos livres. */
  id?: string | null;
  name: string;
}

export interface PlanBlock {
  label: string;
  subjectId: string | null;
  dayIndex: number;
  minutes: number;
  position: number;
}

export interface StudyPlanOptions {
  days?: number; // horizonte do plano (default 7)
  blockMinutes?: number; // duração-alvo de cada bloco (default 60)
  maxBlocksPerDay?: number; // teto de blocos por dia (default 4)
}

/**
 * Distribui as matérias pelos dias em round-robin, priorizando as primeiras
 * da lista (as mais fracas). Dentro de um mesmo dia não repete matéria
 * enquanto houver outra disponível — a semana cobre o máximo de matérias
 * possível em vez de insistir em duas.
 */
export function buildStudyPlan(
  subjects: PlanSubject[],
  minutesPerDay: number,
  options: StudyPlanOptions = {},
): PlanBlock[] {
  const days = options.days ?? 7;
  if (subjects.length === 0 || minutesPerDay <= 0 || days <= 0) return [];

  const targetBlock = Math.max(1, options.blockMinutes ?? 60);
  const maxBlocks = Math.max(1, options.maxBlocksPerDay ?? 4);
  const blocksPerDay = Math.min(
    maxBlocks,
    Math.max(1, Math.round(minutesPerDay / targetBlock)),
  );
  const base = Math.floor(minutesPerDay / blocksPerDay);
  // O resto vai para os primeiros blocos, para o dia somar exatamente o tempo.
  const remainder = minutesPerDay - base * blocksPerDay;

  const blocks: PlanBlock[] = [];
  let cursor = 0;
  for (let day = 0; day < days; day += 1) {
    const usedToday = new Set<string>();
    let extra = remainder;
    for (let b = 0; b < blocksPerDay; b += 1) {
      let pick = subjects[cursor % subjects.length];
      // Avança até achar uma matéria ainda não usada hoje (se houver).
      for (
        let tries = 0;
        tries < subjects.length && usedToday.has(pick.name);
        tries += 1
      ) {
        cursor += 1;
        pick = subjects[cursor % subjects.length];
      }
      cursor += 1;
      usedToday.add(pick.name);

      const minutes = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      blocks.push({
        label: pick.name,
        subjectId: pick.id ?? null,
        dayIndex: day,
        minutes,
        position: b,
      });
    }
  }
  return blocks;
}
