/**
 * Converte JSON Schema para o formato de schema do Gemini.
 *
 * Sem isso, cada caso de uso precisaria escrever o mesmo schema duas vezes —
 * uma em JSON Schema (Anthropic/OpenAI) e outra com os enums `Type.*` do
 * Gemini, e as duas cópias acabam saindo de sincronia.
 */

type JsonSchema = Record<string, unknown>;

/** Espelha os valores de `Type` do @google/genai sem importar o SDK. */
const TIPOS: Record<string, string> = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  integer: 'INTEGER',
  number: 'NUMBER',
  boolean: 'BOOLEAN',
};

export function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const tipo = typeof schema.type === 'string' ? schema.type : 'string';
  const out: Record<string, unknown> = { type: TIPOS[tipo] ?? 'STRING' };

  if (Array.isArray(schema.enum)) {
    // O Gemini só aceita enum em STRING; números viram string e a validação
    // de quem chamou converte de volta.
    out.type = 'STRING';
    out.enum = schema.enum.map((v) => String(v));
  }
  if (typeof schema.description === 'string') {
    out.description = schema.description;
  }

  if (tipo === 'object' && schema.properties) {
    const props = schema.properties as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
    if (Array.isArray(schema.required)) out.required = schema.required;
  }

  if (tipo === 'array' && schema.items) {
    out.items = toGeminiSchema(schema.items as JsonSchema);
  }

  return out;
}
