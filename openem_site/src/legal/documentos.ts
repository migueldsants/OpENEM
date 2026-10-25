import { lerCabecalho } from '../docs/conteudo';
import type { Idioma } from '../docs/i18n';

/**
 * Termos de Uso e Política de Privacidade: Markdown em conteudo/<slug>.md, com
 * a tradução em conteudo/en/<slug>.md. Saem em /privacidade/ e /termos/, e em
 * inglês em /en/privacidade/ e /en/termos/ (o endereço inglês guarda o nome em
 * português, como na documentação). O cabeçalho `atualizado` é a versão que o
 * cadastro grava (`TERMS_VERSION` no backend); o teste cobra que batam.
 */

export type Slug = 'privacidade' | 'termos';

export const SLUGS: Slug[] = ['privacidade', 'termos'];

export interface Documento {
  slug: Slug;
  idioma: Idioma;
  titulo: string;
  descricao: string;
  /** Data da última mudança, AAAA-MM-DD. */
  atualizado: string;
  corpo: string;
  url: string;
  arquivo: string;
}

export function urlDoDocumento(slug: Slug, idioma: Idioma): string {
  return idioma === 'en' ? `/en/${slug}/` : `/${slug}/`;
}

/** /privacidade/ ↔ /en/privacidade/; null fora das páginas legais. */
export function lerUrl(url: string): { slug: Slug; idioma: Idioma } | null {
  const limpa = url.endsWith('/') ? url : `${url}/`;
  const m = /^\/(?:(en)\/)?(privacidade|termos)\/$/.exec(limpa);
  if (!m) return null;
  return { idioma: m[1] ? 'en' : 'pt', slug: m[2] as Slug };
}

export function lerAtualizado(fonte: string): string {
  return /^atualizado:\s*(\S+)\s*$/m.exec(fonte.replace(/\r\n/g, '\n'))?.[1] ?? '';
}

/** `./conteudo/en/termos.md` → slug e idioma. */
export function lerCaminhoLegal(caminho: string): { slug: Slug; idioma: Idioma } | null {
  const m = /conteudo\/(?:(en)\/)?(privacidade|termos)\.md$/.exec(caminho);
  if (!m) return null;
  return { idioma: m[1] ? 'en' : 'pt', slug: m[2] as Slug };
}

export function montarDocumentos(arquivos: Record<string, string>): Documento[] {
  const docs: Documento[] = [];
  for (const [caminho, fonte] of Object.entries(arquivos)) {
    const local = lerCaminhoLegal(caminho);
    if (!local) continue;
    const { titulo, descricao, corpo } = lerCabecalho(fonte);
    docs.push({
      ...local,
      titulo: titulo || local.slug,
      descricao,
      atualizado: lerAtualizado(fonte),
      corpo,
      url: urlDoDocumento(local.slug, local.idioma),
      arquivo: `openem_site/src/legal/conteudo/${local.idioma === 'en' ? 'en/' : ''}${local.slug}.md`,
    });
  }
  return docs.sort((a, b) => SLUGS.indexOf(a.slug) - SLUGS.indexOf(b.slug) || (a.idioma === 'pt' ? -1 : 1) - (b.idioma === 'pt' ? -1 : 1));
}

const ARQUIVOS = import.meta.glob(['./conteudo/*.md', './conteudo/en/*.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const DOCUMENTOS: Documento[] = montarDocumentos(ARQUIVOS);

export function documentoPorUrl(url: string): Documento | undefined {
  const local = lerUrl(url);
  if (!local) return undefined;
  return DOCUMENTOS.find((d) => d.slug === local.slug && d.idioma === local.idioma);
}

/** "25 de outubro de 2026" / "October 25, 2026", sem depender do fuso. */
export function dataPorExtenso(dia: string, idioma: Idioma): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  if (!ano || !mes || !d) return dia;
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, d)));
}

export const TEXTOS_LEGAIS = {
  pt: {
    atualizado: 'Última atualização',
    outroIdioma: 'Read in English',
    abrirApp: 'Abrir o app',
    inicio: 'Início do site',
    documentacao: 'Documentação',
    privacidade: 'Política de Privacidade',
    termos: 'Termos de Uso',
    codigo: 'Código no GitHub',
    rodape: 'Documentos legais',
    pular: 'Pular para o conteúdo',
  },
  en: {
    atualizado: 'Last updated',
    outroIdioma: 'Ler em português',
    abrirApp: 'Open the app',
    inicio: 'Site home',
    documentacao: 'Documentation',
    privacidade: 'Privacy Policy',
    termos: 'Terms of Use',
    codigo: 'Code on GitHub',
    rodape: 'Legal documents',
    pular: 'Skip to content',
  },
} satisfies Record<Idioma, Record<string, string>>;
