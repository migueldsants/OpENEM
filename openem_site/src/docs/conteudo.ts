/**
 * Páginas da documentação: arquivos Markdown em conteudo/<grupo>/NN-slug.md,
 * com um cabeçalho simples (titulo, descricao). O número só ordena; a URL é
 * /docs/<grupo>/<slug>/.
 */

export type Grupo = 'alunos' | 'hospedar' | 'contribuir';

export const TITULO_BASE = 'Documentação do OpENEM';

export const GRUPOS: { id: Grupo; titulo: string; resumo: string }[] = [
  {
    id: 'alunos',
    titulo: 'Para estudantes',
    resumo: 'Como usar cada parte do app, da primeira questão ao simulado.',
  },
  {
    id: 'hospedar',
    titulo: 'Para quem hospeda',
    resumo: 'Rodar uma cópia do OpENEM numa escola, cursinho ou servidor próprio.',
  },
  {
    id: 'contribuir',
    titulo: 'Para quem contribui',
    resumo: 'Como o código é organizado e como enviar uma melhoria.',
  },
];

export interface Pagina {
  grupo: Grupo;
  slug: string;
  ordem: number;
  titulo: string;
  descricao: string;
  corpo: string;
  url: string;
  /** Caminho do arquivo no repositório (para o link "Editar no GitHub"). */
  arquivo: string;
}

export interface Cabecalho {
  titulo: string;
  descricao: string;
  corpo: string;
}

/** Lê o bloco `---` do início do arquivo. Linhas fora de chave: valor são ignoradas. */
export function lerCabecalho(fonte: string): Cabecalho {
  const texto = fonte.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(texto);
  const campos: Record<string, string> = {};
  if (m) {
    for (const linha of m[1].split('\n')) {
      const i = linha.indexOf(':');
      if (i > 0) campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return {
    titulo: campos.titulo ?? '',
    descricao: campos.descricao ?? '',
    corpo: m ? texto.slice(m[0].length).trimStart() : texto,
  };
}

/** `conteudo/alunos/03-simulados.md` → grupo, ordem e slug. */
export function lerCaminho(caminho: string): { grupo: Grupo; ordem: number; slug: string } | null {
  const m = /conteudo\/(alunos|hospedar|contribuir)\/(\d+)-([a-z0-9-]+)\.md$/.exec(caminho);
  if (!m) return null;
  return { grupo: m[1] as Grupo, ordem: Number(m[2]), slug: m[3] };
}

export function montarPaginas(arquivos: Record<string, string>): Pagina[] {
  const paginas: Pagina[] = [];
  for (const [caminho, fonte] of Object.entries(arquivos)) {
    const local = lerCaminho(caminho);
    if (!local) continue;
    const { titulo, descricao, corpo } = lerCabecalho(fonte);
    paginas.push({
      ...local,
      titulo: titulo || local.slug,
      descricao,
      corpo,
      url: `/docs/${local.grupo}/${local.slug}/`,
      arquivo: `openem_site/src/docs/conteudo/${local.grupo}/${String(local.ordem).padStart(2, '0')}-${local.slug}.md`,
    });
  }
  const ordemGrupo = (g: Grupo) => GRUPOS.findIndex((x) => x.id === g);
  return paginas.sort((a, b) => ordemGrupo(a.grupo) - ordemGrupo(b.grupo) || a.ordem - b.ordem);
}

/** Id de âncora de um título: minúsculo, sem acento, só letras, números e hífen. */
export function ancora(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Títulos `##` da página, para o "Nesta página". */
export function titulosDaPagina(corpo: string): { texto: string; id: string }[] {
  const saida: { texto: string; id: string }[] = [];
  let emCodigo = false;
  for (const linha of corpo.split('\n')) {
    if (linha.startsWith('```')) emCodigo = !emCodigo;
    if (emCodigo) continue;
    const m = /^##\s+(.+?)\s*#*$/.exec(linha);
    if (m) {
      const texto = m[1].replace(/[*_`]/g, '');
      saida.push({ texto, id: ancora(texto) });
    }
  }
  return saida;
}

/** Texto corrido sem marcação, para a busca. */
function semMarcacao(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface Resultado {
  pagina: Pagina;
  trecho: string;
}

/**
 * Busca simples e local: todas as palavras precisam aparecer; título vale
 * mais que descrição, que vale mais que o corpo. Sem acento e sem caixa.
 */
export function buscar(paginas: Pagina[], consulta: string, limite = 8): Resultado[] {
  const termos = normalizar(consulta).split(/\s+/).filter((t) => t.length > 1);
  if (termos.length === 0) return [];
  const pontuadas: { pagina: Pagina; pontos: number; trecho: string }[] = [];
  for (const pagina of paginas) {
    const titulo = normalizar(pagina.titulo);
    const descricao = normalizar(pagina.descricao);
    const corpoLimpo = semMarcacao(pagina.corpo);
    const corpo = normalizar(corpoLimpo);
    let pontos = 0;
    let ok = true;
    for (const t of termos) {
      const noTitulo = titulo.includes(t);
      const naDescricao = descricao.includes(t);
      const noCorpo = corpo.includes(t);
      if (!noTitulo && !naDescricao && !noCorpo) {
        ok = false;
        break;
      }
      pontos += (noTitulo ? 10 : 0) + (naDescricao ? 4 : 0) + (noCorpo ? 1 : 0);
    }
    if (!ok) continue;
    const i = corpo.indexOf(termos[0]);
    const trecho =
      i >= 0
        ? (i > 40 ? '…' : '') + corpoLimpo.slice(Math.max(0, i - 40), i + 110).trim() + '…'
        : pagina.descricao;
    pontuadas.push({ pagina, pontos, trecho });
  }
  return pontuadas
    .sort((a, b) => b.pontos - a.pontos || a.pagina.ordem - b.pagina.ordem)
    .slice(0, limite)
    .map(({ pagina, trecho }) => ({ pagina, trecho }));
}

const ARQUIVOS = import.meta.glob('./conteudo/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const PAGINAS: Pagina[] = montarPaginas(ARQUIVOS);

export function paginaPorUrl(url: string): Pagina | undefined {
  const limpa = url.endsWith('/') ? url : `${url}/`;
  return PAGINAS.find((p) => p.url === limpa);
}
