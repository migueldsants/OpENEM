import { E2E_SCHEMA, e2eDatabaseUrl, isTestDatabaseUrl } from './test-database';

describe('test-database', () => {
  const base = 'postgresql://openem:senha@localhost:5432/openem';

  it('acrescenta o schema da suíte e2e', () => {
    const url = new URL(e2eDatabaseUrl(base));
    expect(url.searchParams.get('schema')).toBe(E2E_SCHEMA);
    expect(url.pathname).toBe('/openem');
    expect(url.password).toBe('senha');
  });

  it('troca o schema de dev em vez de usá-lo', () => {
    const url = new URL(
      e2eDatabaseUrl(`${base}?schema=public&sslmode=disable`),
    );
    expect(url.searchParams.get('schema')).toBe(E2E_SCHEMA);
    expect(url.searchParams.get('sslmode')).toBe('disable');
  });

  it('aceita o prefixo postgres://', () => {
    expect(isTestDatabaseUrl(e2eDatabaseUrl('postgres://u@h/db'))).toBe(true);
  });

  it('recusa banco que não é Postgres ou URL inválida', () => {
    expect(() => e2eDatabaseUrl('file:./dev.db')).toThrow(/Postgres/);
    expect(() => e2eDatabaseUrl('')).toThrow(/inválida/);
  });

  it('reconhece só o schema da suíte', () => {
    expect(isTestDatabaseUrl(`${base}?schema=${E2E_SCHEMA}`)).toBe(true);
    expect(isTestDatabaseUrl(`${base}?schema=public`)).toBe(false);
    expect(isTestDatabaseUrl(base)).toBe(false);
    expect(isTestDatabaseUrl('lixo')).toBe(false);
  });
});
