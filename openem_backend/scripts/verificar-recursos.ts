/**
 * Verificador dos links do "Onde estudar" (`npm run recursos:verificar`).
 *
 * Abre cada link do catálogo como um navegador faria, segue os
 * redirecionamentos um a um e recusa qualquer desvio: sair do site da
 * instituição, cair em http, ir para login, cadastro ou pagamento, ou a
 * página não existir mais. Também avisa a conferência que vence em breve.
 *
 * Saída: 1 quando há falha ou conferência vencida (o workflow semanal fica
 * vermelho e o GitHub avisa quem mantém o projeto). "Inconclusivo" é site
 * com proteção contra robôs: não reprova, mas pede conferência no navegador.
 *
 * Não manda nenhum dado de aluno: só abre os endereços públicos do catálogo.
 */
import {
  classifyResponse,
  EXPIRY_WARNING_DAYS,
  followRedirect,
  MAX_REDIRECTS,
  type CheckResult,
} from '../src/study-resources/link-check';
import {
  daysSince,
  MAX_CHECK_AGE_DAYS,
} from '../src/study-resources/study-resource-rules';
import {
  STUDY_PROVIDERS,
  STUDY_RESOURCES,
} from '../src/study-resources/study-resources-catalog';

const UA =
  'Mozilla/5.0 (compatible; OpENEM-verificador-de-links/1.0; +https://github.com/migueldsants/OpENEM)';
const TIMEOUT_MS = 25_000;

async function abrir(
  url: string,
  bases: readonly string[],
): Promise<CheckResult> {
  let atual = url;
  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    const res = await fetch(atual, {
      redirect: 'manual',
      headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const passo = followRedirect(atual, res.headers.get('location'), bases);
      if ('outcome' in passo) return passo;
      atual = passo.next;
      continue;
    }
    const corpo = await res.text().catch(() => '');
    return classifyResponse(res.status, corpo);
  }
  return {
    outcome: 'falha',
    reason: `mais de ${MAX_REDIRECTS} redirecionamentos`,
  };
}

async function conferir(
  url: string,
  bases: readonly string[],
): Promise<CheckResult> {
  // Uma segunda tentativa separa rede instável de link quebrado.
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await abrir(url, bases);
    } catch (e) {
      if (tentativa >= 2) {
        const causa =
          (e as { cause?: { code?: string } }).cause?.code ??
          (e as Error).message;
        return { outcome: 'falha', reason: `sem resposta (${causa})` };
      }
    }
  }
}

async function main() {
  const hoje = new Date();
  const bases = new Map(STUDY_PROVIDERS.map((p) => [p.id, p.bases]));
  const resultados = await Promise.all(
    STUDY_RESOURCES.map(async (r) => ({
      r,
      check: await conferir(r.url, bases.get(r.provider) ?? []),
      idade: daysSince(r.checkedAt, hoje),
    })),
  );

  let falhas = 0;
  let inconclusivos = 0;
  for (const { r, check, idade } of resultados) {
    const resta = MAX_CHECK_AGE_DAYS - idade;
    const vencida = resta < 0;
    const avisos: string[] = [];
    if (vencida) {
      avisos.push(`conferência vencida há ${-resta} dias (some da tela)`);
    } else if (resta <= EXPIRY_WARNING_DAYS) {
      avisos.push(`conferência vence em ${resta} dias`);
    }
    // Cada link conta uma vez: vencido ou quebrado é problema.
    const situacao = vencida ? 'falha' : check.outcome;
    if (situacao === 'falha') falhas++;
    if (situacao === 'inconclusivo') inconclusivos++;
    const marca = { ok: 'OK  ', falha: 'FALHA', inconclusivo: '??  ' }[
      situacao
    ];
    console.log(
      `${marca} ${r.id} — ${check.reason}${avisos.length ? ` — ${avisos.join('; ')}` : ''}`,
    );
    if (check.outcome !== 'ok') console.log(`      ${r.url}`);
  }

  console.log(
    `\n${resultados.length} links: ${resultados.length - falhas - inconclusivos} ok, ${inconclusivos} para conferir no navegador, ${falhas} com problema.`,
  );
  if (falhas) {
    console.log(
      'Corrija ou tire o link do catálogo. Para tirar já de uma instalação no ar, sem nova versão, use STUDY_RESOURCES_BLOCKED.',
    );
    process.exitCode = 1;
  }
}

void main();
