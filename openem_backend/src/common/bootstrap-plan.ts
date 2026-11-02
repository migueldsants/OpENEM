/**
 * O que o container roda antes de subir a API (`prisma/bootstrap.ts`).
 *
 * Um banco novo nasce vazio: sem o seed não há nem as áreas do conhecimento, e
 * sem o import não há questão. Então, na primeira subida, o container popula o
 * banco sozinho, na ordem que o README manda. Com questões oficiais já no
 * banco, só reimporta quando o mapeamento do import mudou
 * (`ENEM_MAPPING_VERSION`): um conserto no mapeamento só chega às questões que
 * já estão no banco reimportando. Fora isso não faz nada, para o import não
 * rodar a cada restart.
 */
import { ENEM_MAPPING_VERSION } from './enem-import/mapping';

export type BootstrapStep =
  | 'db:seed'
  | 'db:import:enem'
  | 'db:classify:keywords'
  | 'db:classify:catalog'
  | 'db:seed:flashcards';

/** Chave do `AppState` com a versão do mapeamento do último import completo. */
export const MAPPING_VERSION_KEY = 'enem.mappingVersion';

export interface BootstrapState {
  /** Questões oficiais (importadas) já no banco. */
  officialQuestions: number;
  /** Valor de AUTO_IMPORT: "0"/"false"/"off" desliga. */
  autoImport: string | undefined;
  /** Valor gravado em `MAPPING_VERSION_KEY`; nulo se nunca foi gravado. */
  importedMappingVersion: string | null;
}

export function autoImportEnabled(value: string | undefined): boolean {
  return !['0', 'false', 'off', 'no'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

/** Versão gravada no banco; ausente ou ilegível conta como 0 (reimporta). */
export function parseMappingVersion(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function bootstrapPlan(
  state: BootstrapState,
  mappingVersion = ENEM_MAPPING_VERSION,
): BootstrapStep[] {
  if (!autoImportEnabled(state.autoImport)) return [];
  if (state.officialQuestions > 0) {
    return parseMappingVersion(state.importedMappingVersion) < mappingVersion
      ? ['db:import:enem']
      : [];
  }
  return [
    'db:seed',
    'db:import:enem',
    'db:classify:keywords',
    'db:classify:catalog',
    'db:seed:flashcards',
  ];
}
