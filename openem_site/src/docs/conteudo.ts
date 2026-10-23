import { openApiParaMarkdown, type OpenApi } from './api';
import documentoDaApi from './api/openapi.json';
import { baseDo, type Idioma } from './i18n';

/**
 * Páginas da documentação: arquivos Markdown em conteudo/<grupo>/NN-slug.md,
 * com um cabeçalho simples (titulo, descricao). O número só ordena; a URL é
 * /docs/<grupo>/<slug>/.
 */

export type Grupo = 'alunos' | 'hospedar' | 'contribuir';

export const TITULO_BASE = 'Documentação do OpENEM';

export type InfoGrupo = { id: Grupo; titulo: string; resumo: string };

export const GRUPOS: InfoGrupo[] = [
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

export const GRUPOS_EN: InfoGrupo[] = [
  {
    id: 'alunos',
    titulo: 'For students',
    resumo: 'How to use each part of the app. These guides are in Portuguese, the language of the ENEM.',
  },
  {
    id: 'hospedar',
    titulo: 'For hosts',
    resumo: 'Running a copy of OpENEM at a school, prep course or on your own server.',
  },
  {
    id: 'contribuir',
    titulo: 'For contributors',
    resumo: 'How the code is organized and how to send an improvement.',
  },
];

export function gruposDo(idioma: Idioma): InfoGrupo[] {
  return idioma === 'en' ? GRUPOS_EN : GRUPOS;
}

export interface Pagina {
  idioma: Idioma;
  /** false: página em inglês que ainda não foi traduzida (mostra o português). */
  traduzida: boolean;
  grupo: Grupo;
  slug: string;
  ordem: number;
  titulo: string;
  descricao: string;
  corpo: string;
  url: string;
  /**
   * Caminho do arquivo no repositório (para o link "Editar no GitHub"). Vazio
   * na página gerada do código (a referência da API).
   */
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

/**
 * `conteudo/alunos/03-simulados.md` → grupo, ordem e slug. A tradução para o
 * inglês fica em `conteudo/en/<grupo>/`, com o mesmo nome de arquivo.
 */
export function lerCaminho(
  caminho: string,
): { idioma: Idioma; grupo: Grupo; ordem: number; slug: string } | null {
  const m = /conteudo\/(?:(en)\/)?(alunos|hospedar|contribuir)\/(\d+)-([a-z0-9-]+)\.md$/.exec(caminho);
  if (!m) return null;
  return { idioma: m[1] ? 'en' : 'pt', grupo: m[2] as Grupo, ordem: Number(m[3]), slug: m[4] };
}

export function montarPaginas(arquivos: Record<string, string>): Pagina[] {
  const paginas: Pagina[] = [];
  for (const [caminho, fonte] of Object.entries(arquivos)) {
    const local = lerCaminho(caminho);
    if (!local) continue;
    const { titulo, descricao, corpo } = lerCabecalho(fonte);
    const pasta = local.idioma === 'en' ? 'en/' : '';
    paginas.push({
      ...local,
      traduzida: true,
      titulo: titulo || local.slug,
      descricao,
      corpo,
      url: `${baseDo(local.idioma)}${local.grupo}/${local.slug}/`,
      arquivo: `openem_site/src/docs/conteudo/${pasta}${local.grupo}/${String(local.ordem).padStart(2, '0')}-${local.slug}.md`,
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

const ARQUIVOS = import.meta.glob(['./conteudo/*/*.md', './conteudo/en/*/*.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * As páginas em inglês, na mesma ordem das em português. A que não tem
 * tradução repete o português no endereço inglês, marcada como não traduzida.
 */
export function espelhoEmIngles(pt: Pagina[], en: Pagina[]): Pagina[] {
  return pt.map((p) => {
    const traducao = en.find((e) => e.grupo === p.grupo && e.slug === p.slug);
    if (traducao) return { ...traducao, ordem: p.ordem };
    return { ...p, idioma: 'en', traduzida: false, url: `${baseDo('en')}${p.grupo}/${p.slug}/` };
  });
}

/**
 * Referência da API: gerada do openapi.json que o backend monta dos próprios
 * controllers (`npm run openapi`), fecha o grupo "Para quem contribui".
 */
export const PAGINA_DA_API: Pagina = {
  idioma: 'pt',
  traduzida: true,
  grupo: 'contribuir',
  slug: 'api',
  ordem: 99,
  titulo: 'Referência da API',
  descricao:
    'Todas as rotas da API do OpENEM, geradas do código: método, caminho, parâmetros, corpo e se a rota exige login.',
  corpo: openApiParaMarkdown(documentoDaApi as unknown as OpenApi),
  url: '/docs/contribuir/api/',
  arquivo: '',
};

const TODAS = montarPaginas(ARQUIVOS);

/** Páginas em português (o padrão), com a referência da API no fim. */
export const PAGINAS: Pagina[] = [...TODAS.filter((p) => p.idioma === 'pt'), PAGINA_DA_API];

/** Páginas em inglês: as traduzidas e, no lugar das outras, o português. */
export const PAGINAS_EN: Pagina[] = espelhoEmIngles(
  PAGINAS,
  TODAS.filter((p) => p.idioma === 'en'),
);

export function paginasDo(idioma: Idioma): Pagina[] {
  return idioma === 'en' ? PAGINAS_EN : PAGINAS;
}

export function paginaPorUrl(url: string): Pagina | undefined {
  const limpa = url.endsWith('/') ? url : `${url}/`;
  return PAGINAS.find((p) => p.url === limpa) ?? PAGINAS_EN.find((p) => p.url === limpa);
}
