import { RequestMethod } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';

/** Prefixo das rotas de domínio; a raiz e o /health ficam fora. */
export const API_PREFIX = 'api/v1';
export const API_PREFIX_EXCLUDE = [
  { path: '', method: RequestMethod.GET },
  { path: 'health', method: RequestMethod.GET },
];

/**
 * Cabeçalho do documento OpenAPI. O mesmo vale para o Swagger do dev (main.ts)
 * e para a referência da API na documentação (scripts/gerar-openapi.ts).
 */
export function openApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('OpENEM - API de Estudos')
    .setDescription(
      'Documentação da API da plataforma OpENEM, abrangendo ferramentas de estudo, ' +
        'gestão de conteúdos, simulados, métricas de desempenho, etc.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
