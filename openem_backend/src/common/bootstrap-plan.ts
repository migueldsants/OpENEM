/**
 * O que o container roda antes de subir a API (`prisma/bootstrap.ts`).
 *
 * Um banco novo nasce vazio: sem o seed não há nem as áreas do conhecimento, e
 * sem o import não há questão. Então, na primeira subida, o container popula o
 * banco sozinho, na ordem que o README manda. Com questões oficiais já no
 * banco, não faz nada: o import baixa ~180 MB do GitHub e não deve rodar a
 * cada restart. Atualizar o banco depois é manual (ver README).
 */
export type BootstrapStep =
  | 'db:seed'
  | 'db:import:enem'
  | 'db:classify:keywords'
  | 'db:classify:catalog'
  | 'db:seed:flashcards';

export interface BootstrapState {
  /** Questões oficiais (importadas) já no banco. */
  officialQuestions: number;
  /** Valor de AUTO_IMPORT: "0"/"false"/"off" desliga. */
  autoImport: string | undefined;
}

export function autoImportEnabled(value: string | undefined): boolean {
  return !['0', 'false', 'off', 'no'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

export function bootstrapPlan(state: BootstrapState): BootstrapStep[] {
  if (!autoImportEnabled(state.autoImport)) return [];
  if (state.officialQuestions > 0) return [];
  return [
    'db:seed',
    'db:import:enem',
    'db:classify:keywords',
    'db:classify:catalog',
    'db:seed:flashcards',
  ];
}
