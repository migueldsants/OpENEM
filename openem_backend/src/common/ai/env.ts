// Leitura das variáveis de ambiente da camada de IA.
//
// O docker-compose passa `${VAR:-}` para toda variável que o .env não define,
// então "não configurado" chega como string vazia, e não como ausente. Com
// `??`, um ANTHROPIC_MODEL vazio virava o modelo '' na chamada e uma
// GEMINI_API_KEY vazia escondia a GOOGLE_API_KEY.

/** Valor da variável, ou undefined quando ela falta ou está em branco. */
export function envValue(name: string): string | undefined {
  return presente(process.env[name]);
}

/** Primeiro valor que não está em branco. */
export function firstPresent(
  ...values: (string | null | undefined)[]
): string | undefined {
  for (const value of values) {
    const v = presente(value);
    if (v !== undefined) return v;
  }
  return undefined;
}

function presente(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}
