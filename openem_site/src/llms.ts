// llms.txt e llms-full.txt (https://llmstxt.org), gerados no build com a
// documentação: um índice curto em Markdown para assistentes de IA acharem o
// que importa, e o texto inteiro das páginas num arquivo só. Saem das mesmas
// páginas do site, então nunca ficam desatualizados. Com SITE_URL os links
// saem completos; sem ela, relativos à raiz.

export interface EntradaLlms {
  titulo: string;
  url: string;
  descricao: string;
}

export interface SecaoLlms {
  titulo: string;
  entradas: EntradaLlms[];
}

export interface PaginaLlms extends EntradaLlms {
  corpo: string;
}

export const RESUMO_LLMS =
  'Plataforma gratuita e de código aberto (AGPL-3.0) para estudar para o ENEM, a prova nacional que dá acesso ao ensino superior no Brasil: as questões oficiais de 1998 a 2025, simulados no padrão da prova, revisão espaçada do que o aluno errou, temas de redação oficiais e acompanhamento do desempenho.';

const CONTEXTO_LLMS = [
  'O app fica em `/app/` e exige conta; o site público e a documentação ficam na raiz. Questões e temas de redação vêm das provas oficiais do INEP, e o OpENEM não tem vínculo com o INEP.',
  'A documentação é em português; as partes para quem hospeda e para quem contribui também existem em inglês. Qualquer escola ou cursinho pode hospedar a própria cópia.',
].join(' ');

function link(site: string | null, url: string): string {
  return /^https?:\/\//.test(url) ? url : `${site ?? ''}${url}`;
}

/** Uma linha de lista no formato do llms.txt: `- [título](url): descrição`. */
function item(site: string | null, e: EntradaLlms): string {
  const descricao = e.descricao.trim();
  return `- [${e.titulo}](${link(site, e.url)})${descricao ? `: ${descricao}` : ''}`;
}

/**
 * O índice. `opcionais` vai na seção "Optional", que o formato reserva ao que
 * pode ser pulado quando o contexto é curto.
 */
export function llmsTxt(
  site: string | null,
  secoes: SecaoLlms[],
  opcionais: EntradaLlms[],
): string {
  const partes = ['# OpENEM', '', `> ${RESUMO_LLMS}`, '', CONTEXTO_LLMS];
  for (const secao of [...secoes, { titulo: 'Optional', entradas: opcionais }]) {
    if (secao.entradas.length === 0) continue;
    partes.push('', `## ${secao.titulo}`, '', ...secao.entradas.map((e) => item(site, e)));
  }
  return partes.join('\n') + '\n';
}

/**
 * O texto completo: cada página com o título, o endereço e a descrição antes
 * do corpo. O corpo já começa nos títulos `##` (as páginas não têm H1), então
 * o título de cada página entra como H1 e a hierarquia continua certa.
 */
export function llmsFullTxt(site: string | null, paginas: PaginaLlms[]): string {
  const partes = ['# OpENEM: documentação completa', '', `> ${RESUMO_LLMS}`, '', CONTEXTO_LLMS];
  for (const p of paginas) {
    partes.push(
      '',
      '---',
      '',
      `# ${p.titulo}`,
      '',
      `Fonte: ${link(site, p.url)}`,
      ...(p.descricao.trim() ? ['', `> ${p.descricao.trim()}`] : []),
      '',
      p.corpo.replace(/\r\n/g, '\n').trim(),
    );
  }
  return partes.join('\n') + '\n';
}
