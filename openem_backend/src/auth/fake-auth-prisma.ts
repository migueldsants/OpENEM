/* eslint-disable @typescript-eslint/require-await -- imita os métodos assíncronos do Prisma */
/**
 * O pedaço do Prisma que o login usa (usuário, links de redefinição e
 * códigos do Google), em memória e com as unicidades do schema, para os
 * testes de unidade dos serviços de conta. Só os filtros que eles usam:
 * igualdade, `OR`, `lt`/`gt`, `equals` com `mode: 'insensitive'` e
 * `increment`.
 */

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;
type Tabela = 'user' | 'passwordResetToken' | 'loginCode';

function ehOperador(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !(valor instanceof Date);
}

function cumpre(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([campo, cond]) => {
    if (campo === 'OR') return (cond as Where[]).some((w) => cumpre(row, w));
    const valor = row[campo];
    if (ehOperador(cond)) {
      const op = cond as {
        equals?: string;
        mode?: string;
        lt?: Date;
        gt?: Date;
      };
      if (op.equals !== undefined) {
        return op.mode === 'insensitive'
          ? String(valor).toLowerCase() === op.equals.toLowerCase()
          : valor === op.equals;
      }
      if (op.lt) return (valor as Date) < op.lt;
      if (op.gt) return (valor as Date) > op.gt;
      return false;
    }
    if (cond instanceof Date) {
      return (valor as Date | null)?.getTime() === cond.getTime();
    }
    return valor === cond;
  });
}

const UNICOS: Record<Tabela, string[]> = {
  user: ['email', 'googleSub'],
  passwordResetToken: ['tokenHash'],
  loginCode: ['codeHash'],
};

const PADRAO: Record<Tabela, () => Where> = {
  user: () => ({
    passwordHash: null,
    tokenVersion: 0,
    googleSub: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
  }),
  passwordResetToken: () => ({ usedAt: null, createdAt: new Date() }),
  loginCode: () => ({ passwordDisabled: false, createdAt: new Date() }),
};

export function fakeAuthPrisma() {
  let seq = 0;
  const tabelas: Record<Tabela, Row[]> = {
    user: [],
    passwordResetToken: [],
    loginCode: [],
  };

  function escolhe(row: Row, select?: Where): Record<string, unknown> {
    if (!select) return { ...row };
    const saida: Record<string, unknown> = {};
    for (const [campo, quer] of Object.entries(select)) {
      if (!quer) continue;
      if (ehOperador(quer) && 'select' in quer) {
        // Relação: só `user`, pelo `userId`.
        const dono = tabelas.user.find((u) => u.id === row.userId);
        saida[campo] = dono ? escolhe(dono, quer.select as Where) : null;
      } else {
        saida[campo] = row[campo];
      }
    }
    return saida;
  }

  function confereUnicos(nome: Tabela, row: Row) {
    for (const campo of UNICOS[nome]) {
      if (row[campo] == null) continue;
      if (
        tabelas[nome].some((r) => r.id !== row.id && r[campo] === row[campo])
      ) {
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
        });
      }
    }
  }

  function aplica(row: Row, data: Where): Row {
    const novo = { ...row };
    for (const [campo, valor] of Object.entries(data)) {
      if (campo === 'profile') continue;
      novo[campo] =
        ehOperador(valor) && 'increment' in valor
          ? (row[campo] as number) + (valor.increment as number)
          : valor;
    }
    return novo;
  }

  function delegate(nome: Tabela) {
    return {
      findUnique: async (a: { where: Where; select?: Where }) => {
        const row = tabelas[nome].find((r) => cumpre(r, a.where));
        return row ? escolhe(row, a.select) : null;
      },
      findMany: async (a: { where?: Where; select?: Where; take?: number }) =>
        tabelas[nome]
          .filter((r) => cumpre(r, a.where))
          .slice(0, a.take ?? Infinity)
          .map((r) => escolhe(r, a.select)),
      create: async (a: { data: Where; select?: Where }) => {
        const row = aplica(
          { ...PADRAO[nome](), id: `${nome}-${++seq}` },
          a.data,
        );
        confereUnicos(nome, row);
        tabelas[nome].push(row);
        return escolhe(row, a.select);
      },
      update: async (a: { where: Where; data: Where; select?: Where }) => {
        const i = tabelas[nome].findIndex((r) => cumpre(r, a.where));
        if (i < 0) {
          throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        }
        const novo = aplica(tabelas[nome][i], a.data);
        confereUnicos(nome, novo);
        tabelas[nome][i] = novo;
        return escolhe(novo, a.select);
      },
      updateMany: async (a: { where: Where; data: Where }) => {
        let count = 0;
        tabelas[nome] = tabelas[nome].map((r) => {
          if (!cumpre(r, a.where)) return r;
          count++;
          return aplica(r, a.data);
        });
        return { count };
      },
      deleteMany: async (a: { where?: Where } = {}) => {
        const antes = tabelas[nome].length;
        tabelas[nome] = tabelas[nome].filter((r) => !cumpre(r, a.where));
        return { count: antes - tabelas[nome].length };
      },
    };
  }

  return {
    tabelas,
    user: delegate('user'),
    passwordResetToken: delegate('passwordResetToken'),
    loginCode: delegate('loginCode'),
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

export type FakeAuthPrisma = ReturnType<typeof fakeAuthPrisma>;
