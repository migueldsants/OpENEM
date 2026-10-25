import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE';

/**
 * CORS da API, lido de CORS_ORIGINS e NODE_ENV.
 *
 * O app chega à API pela mesma origem (o nginx do frontend encaminha `/api/`),
 * então em produção nenhuma outra origem precisa de CORS. Sem CORS_ORIGINS,
 * a produção não liga o CORS: o navegador recusa a leitura da resposta por
 * qualquer outro site. Fora de produção continua liberado para qualquer
 * origem, como antes, para ferramentas de dev. Com CORS_ORIGINS, só as
 * origens da lista, separadas por vírgula. `*` é recusado: ele é exatamente o
 * que a produção sem a variável evita.
 *
 * Devolve `null` quando o CORS não deve ser ligado.
 */
export function corsOptions(
  rawOrigins: string | undefined,
  nodeEnv: string | undefined,
): CorsOptions | null {
  const origins = (rawOrigins ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGINS="*" libera a API para qualquer site. Liste as origens (ex.: CORS_ORIGINS=https://openem.exemplo) ou deixe vazio.',
    );
  }
  if (origins.length > 0) return { origin: origins, methods: METHODS };
  if (nodeEnv === 'production') return null;
  return {};
}
