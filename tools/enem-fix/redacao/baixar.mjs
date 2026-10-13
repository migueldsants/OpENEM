// Baixa os cadernos oficiais do INEP que trazem a proposta de redação
// (lista em fontes.json) para ./pdfs, que não é versionada. Usa o curl: o
// servidor do INEP derruba a conexão do fetch do Node.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const destino = join(aqui, 'pdfs');
mkdirSync(destino, { recursive: true });
const fontes = JSON.parse(readFileSync(join(aqui, 'fontes.json'), 'utf8'));

for (const f of fontes) {
  const arquivo = join(destino, `${f.id}.pdf`);
  if (existsSync(arquivo)) continue;
  try {
    execFileSync(
      'curl',
      ['-sSfL', '--retry', '4', '--retry-all-errors', '-A', 'Mozilla/5.0', '-o', arquivo, f.url],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    if (readFileSync(arquivo).subarray(0, 4).toString() !== '%PDF') {
      throw new Error('a resposta não é um PDF');
    }
    console.log(`${f.id}: ok`);
  } catch (e) {
    rmSync(arquivo, { force: true });
    console.error(`${f.id}: ${String(e.stderr || e.message).trim()}`);
  }
}
