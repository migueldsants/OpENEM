import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Rate limiting na borda (issue #87): o nginx limita /api/ antes do Node e
 * responde o 429 no mesmo formato da API, com Retry-After.
 */
const nginx = readFileSync(resolve(__dirname, '../nginx.conf'), 'utf8');

/** Corpo de um bloco `location <alvo> { ... }` (sem blocos aninhados). */
function bloco(alvo: string): string {
  const inicio = nginx.indexOf(`location ${alvo} {`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  return nginx.slice(inicio, nginx.indexOf('\n  }', inicio));
}

describe('nginx — rate limiting da API', () => {
  it('declara a zona por IP fora do server', () => {
    expect(nginx).toMatch(
      /^limit_req_zone \$binary_remote_addr zone=api:\d+m rate=\d+r\/s;/m,
    );
    expect(nginx.indexOf('limit_req_zone')).toBeLessThan(
      nginx.indexOf('server {'),
    );
  });

  it('limita /api/ com status 429', () => {
    const api = bloco('/api/');
    expect(api).toMatch(/limit_req zone=api burst=\d+ nodelay;/);
    expect(api).toContain('limit_req_status 429;');
    expect(api).toContain('error_page 429 = @limitado;');
  });

  it('o 429 da borda tem Retry-After e a mensagem da API', () => {
    const limitado = bloco('@limitado');
    expect(limitado).toContain('add_header Retry-After 1 always;');
    expect(limitado).toContain('Muitas tentativas. Tente de novo em 1 s.');
  });

  it('não limita imagens nem o healthcheck', () => {
    expect(bloco('/media/')).not.toContain('limit_req');
    expect(bloco('= /health')).not.toContain('limit_req');
  });
});
