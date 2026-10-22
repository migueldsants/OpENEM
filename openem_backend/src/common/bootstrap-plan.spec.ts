import { autoImportEnabled, bootstrapPlan } from './bootstrap-plan';

describe('bootstrapPlan', () => {
  it('banco sem questões oficiais: popula tudo, na ordem do README', () => {
    expect(
      bootstrapPlan({ officialQuestions: 0, autoImport: undefined }),
    ).toEqual([
      'db:seed',
      'db:import:enem',
      'db:classify:keywords',
      'db:classify:catalog',
      'db:seed:flashcards',
    ]);
  });

  it('banco já populado: não roda nada (o import não repete a cada restart)', () => {
    expect(bootstrapPlan({ officialQuestions: 1, autoImport: '1' })).toEqual(
      [],
    );
  });

  it('AUTO_IMPORT desligado: não roda nada nem com o banco vazio', () => {
    for (const v of ['0', 'false', 'OFF', ' no ']) {
      expect(bootstrapPlan({ officialQuestions: 0, autoImport: v })).toEqual(
        [],
      );
    }
  });

  it('ligado por padrão e com qualquer outro valor', () => {
    expect(autoImportEnabled(undefined)).toBe(true);
    expect(autoImportEnabled('')).toBe(true);
    expect(autoImportEnabled('1')).toBe(true);
    expect(autoImportEnabled('true')).toBe(true);
  });
});
