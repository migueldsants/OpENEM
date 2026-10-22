/** Provedores de IA suportados. */
export type AiProvider =
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'gemini';

/**
 * Uma chamada de IA que devolve JSON conforme um schema.
 *
 * Os provedores devolvem o TEXTO cru da resposta e não normalizam nada: cada
 * caso de uso (comentário de questão, classificação) tem a sua própria
 * validação, e é ela que sabe o que fazer com uma resposta fora do esperado.
 */
export interface JsonCompletionRequest {
  system: string;
  user: string;
  /** JSON Schema da resposta esperada. */
  schema: Record<string, unknown>;
  /** Nome do schema — exigido pela API da OpenAI. */
  schemaName: string;
  maxTokens?: number;
  /** Sobrescreve o modelo padrão do provedor para este caso de uso. */
  model?: string;
}
