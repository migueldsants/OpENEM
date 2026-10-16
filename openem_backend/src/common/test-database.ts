/**
 * Banco da suíte e2e: o mesmo Postgres de desenvolvimento, num schema próprio.
 *
 * A suíte apaga e recria o schema a cada execução (`migrate reset`), então ele
 * nunca pode ser o `public` em que vivem os dados de dev. Os scripts que
 * escrevem em massa (import, classificação) usam `isTestDatabaseUrl` para se
 * recusar a rodar contra ele.
 */
export const E2E_SCHEMA = 'test_e2e';

/** A URL de base com `?schema=test_e2e` (troca o schema se já houver um). */
export function e2eDatabaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('DATABASE_URL inválida para a suíte e2e');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(
      'a suíte e2e precisa de um Postgres (DATABASE_URL=postgresql://...)',
    );
  }
  url.searchParams.set('schema', E2E_SCHEMA);
  return url.toString();
}

/** Verdadeiro quando a URL aponta para o schema da suíte e2e. */
export function isTestDatabaseUrl(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).searchParams.get('schema') === E2E_SCHEMA;
  } catch {
    return false;
  }
}
