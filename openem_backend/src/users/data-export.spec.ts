import { Prisma } from '@prisma/client';
import {
  buildExport,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  EXPORT_SELECT,
  exportFilename,
  stripSecrets,
} from './data-export';

const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'User')!;

describe('EXPORT_SELECT', () => {
  it('leva toda relação de User: tabela nova ligada ao aluno tem de entrar no arquivo', () => {
    const relations = userModel.fields
      .filter((f) => f.kind === 'object')
      .map((f) => f.name);
    const selected = Object.keys(EXPORT_SELECT);
    expect(relations.filter((r) => !selected.includes(r))).toEqual([]);
  });

  it('leva todo campo da conta, menos o hash da senha', () => {
    const scalars = userModel.fields
      .filter((f) => f.kind !== 'object')
      .map((f) => f.name);
    const selected = Object.keys(EXPORT_SELECT);
    expect(scalars.filter((s) => !selected.includes(s))).toEqual([
      'passwordHash',
    ]);
    expect(EXPORT_SELECT).not.toHaveProperty('passwordHash');
  });
});

describe('stripSecrets()', () => {
  it('tira passwordHash em qualquer nível e mantém o resto', () => {
    const when = new Date('2026-10-25T00:00:00Z');
    const out = stripSecrets({
      passwordHash: 'x',
      createdAt: when,
      nested: { passwordHash: 'y', ok: 1 },
      list: [{ passwordHash: 'z', id: 'a' }, null, 'texto'],
    });
    expect(out).toEqual({
      createdAt: when,
      nested: { ok: 1 },
      list: [{ id: 'a' }, null, 'texto'],
    });
    expect(out.createdAt).toBeInstanceOf(Date);
  });
});

describe('buildExport()', () => {
  it('cabeçalho do formato, a conta separada e uma chave por relação', () => {
    const out = buildExport(
      {
        id: 'u1',
        email: 'a@b.com',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
        termsVersion: '2026-10-25',
        passwordHash: '$argon2id$...',
        profile: { displayName: 'Ana' },
        answers: [],
      },
      new Date('2026-10-25T15:00:00Z'),
    );
    expect(out).toEqual({
      format: EXPORT_FORMAT,
      version: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-10-25T15:00:00.000Z',
      account: {
        id: 'u1',
        email: 'a@b.com',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
        termsVersion: '2026-10-25',
      },
      profile: { displayName: 'Ana' },
      answers: [],
    });
    expect(JSON.stringify(out)).not.toContain('argon2');
  });
});

describe('exportFilename()', () => {
  it('usa o dia de Brasília (às 22h de Brasília em UTC já é o dia seguinte)', () => {
    expect(exportFilename(new Date('2026-10-26T01:00:00Z'))).toBe(
      'openem-meus-dados-2026-10-25.json',
    );
  });
});
