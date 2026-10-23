/**
 * Gera o documento OpenAPI da API sem subir o servidor nem abrir conexão com
 * o banco ou o Redis, e grava em openem_site/src/docs/api/openapi.json, de onde
 * a documentação monta a página "Referência da API" (issue #89).
 *
 *   npm run openapi            # grava o arquivo
 *   npm run openapi -- --check # só confere se o arquivo está em dia (CI)
 *
 * O modo preview do Nest monta o grafo de módulos e lê os decorators dos
 * controllers sem instanciar nenhum provider: o PrismaService não conecta, e
 * as factories (JWT, Redis, throttler) nem rodam.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { API_PREFIX, API_PREFIX_EXCLUDE, openApiConfig } from '../src/openapi';

const DESTINO = join(
  __dirname,
  '..',
  '..',
  'openem_site',
  'src',
  'docs',
  'api',
  'openapi.json',
);

async function main() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  app.setGlobalPrefix(API_PREFIX, { exclude: API_PREFIX_EXCLUDE });
  const documento = SwaggerModule.createDocument(app, openApiConfig());
  await app.close();

  const json = JSON.stringify(documento, null, 2) + '\n';
  const caminhos = Object.keys(documento.paths).length;

  if (process.argv.includes('--check')) {
    let atual = '';
    try {
      atual = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n');
    } catch {
      // sem arquivo: desatualizado
    }
    if (atual !== json) {
      console.error(
        `[openapi] ${DESTINO} está desatualizado: rode \`npm run openapi\` em openem_backend e faça commit.`,
      );
      process.exit(1);
    }
    console.log(`[openapi] em dia (${caminhos} caminhos)`);
    return;
  }

  writeFileSync(DESTINO, json);
  console.log(`[openapi] ${caminhos} caminhos gravados em ${DESTINO}`);
}

main().catch((e: unknown) => {
  console.error('[openapi]', e);
  process.exit(1);
});
