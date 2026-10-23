import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Toda variável dos .env.example (raiz e backend) tem de aparecer na página
 * de variáveis de ambiente (issue #89). Quem cria uma variável nova e esquece
 * a documentação vê este teste quebrar.
 */
const raiz = resolve(__dirname, '../../..');
const pagina = readFileSync(resolve(__dirname, 'conteudo/hospedar/02-variaveis.md'), 'utf8');

/** Nomes das variáveis de um .env.example, definidas ou comentadas. */
function variaveis(arquivo: string): string[] {
  const texto = readFileSync(resolve(raiz, arquivo), 'utf8');
  return [...texto.matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)].map(([, nome]) => nome);
}

describe.each(['.env.example', 'openem_backend/.env.example'])('variáveis de %s', (arquivo) => {
  const nomes = variaveis(arquivo);

  it('o arquivo tem variáveis', () => {
    expect(nomes.length).toBeGreaterThan(3);
  });

  it.each(nomes)('%s está na página de variáveis', (nome) => {
    expect(pagina).toContain(`\`${nome}\``);
  });
});
