import {
  autoImportEnabled,
  bootstrapPlan,
  parseMappingVersion,
} from './bootstrap-plan';
import { ENEM_MAPPING_VERSION } from './enem-import/mapping';

const atual = String(ENEM_MAPPING_VERSION);

describe('bootstrapPlan', () => {
  it('banco sem questões oficiais: popula tudo, na ordem do README', () => {
    expect(
      bootstrapPlan({
        officialQuestions: 0,
        autoImport: undefined,
        importedMappingVersion: null,
      }),
    ).toEqual([
      'db:seed',
      'db:import:enem',
      'db:classify:keywords',
      'db:classify:catalog',
      'db:seed:flashcards',
    ]);
  });

  it('banco já populado com o mapeamento atual: não roda nada (o import não repete a cada restart)', () => {
    expect(
      bootstrapPlan({
        officialQuestions: 1,
        autoImport: '1',
        importedMappingVersion: atual,
      }),
    ).toEqual([]);
  });

  it('mapeamento subiu de versão: só reimporta, sem seed nem classificação', () => {
    expect(
      bootstrapPlan(
        { officialQuestions: 1, autoImport: '1', importedMappingVersion: '1' },
        2,
      ),
    ).toEqual(['db:import:enem']);
  });

  it('banco importado antes de existir a versão: reimporta uma vez', () => {
    expect(
      bootstrapPlan({
        officialQuestions: 1,
        autoImport: '1',
        importedMappingVersion: null,
      }),
    ).toEqual(['db:import:enem']);
  });

  it('versão gravada maior que a do código (rollback): não reimporta', () => {
    expect(
      bootstrapPlan(
        { officialQuestions: 1, autoImport: '1', importedMappingVersion: '3' },
        2,
      ),
    ).toEqual([]);
  });

  it('AUTO_IMPORT desligado: não roda nada, nem com o banco vazio nem com o mapeamento novo', () => {
    for (const v of ['0', 'false', 'OFF', ' no ']) {
      expect(
        bootstrapPlan({
          officialQuestions: 0,
          autoImport: v,
          importedMappingVersion: null,
        }),
      ).toEqual([]);
      expect(
        bootstrapPlan({
          officialQuestions: 1,
          autoImport: v,
          importedMappingVersion: null,
        }),
      ).toEqual([]);
    }
  });

  it('ligado por padrão e com qualquer outro valor', () => {
    expect(autoImportEnabled(undefined)).toBe(true);
    expect(autoImportEnabled('')).toBe(true);
    expect(autoImportEnabled('1')).toBe(true);
    expect(autoImportEnabled('true')).toBe(true);
  });

  it('versão ausente ou ilegível conta como 0', () => {
    expect(parseMappingVersion(null)).toBe(0);
    expect(parseMappingVersion('')).toBe(0);
    expect(parseMappingVersion('abc')).toBe(0);
    expect(parseMappingVersion('-2')).toBe(0);
    expect(parseMappingVersion('4')).toBe(4);
  });
});
