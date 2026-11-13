/**
 * Regras do catálogo "Onde estudar" (discussão #126). Tudo aqui é puro e
 * testado: o catálogo real passa por `validateCatalog` num teste, então um
 * link que fura alguma regra não chega ao CI verde.
 *
 * As garantias, em ordem:
 * 1. Só instituições públicas ou sem fins lucrativos (`ProviderKind`).
 *    Cursinho, editora e plataforma comercial ficam de fora, mesmo com
 *    conteúdo gratuito, porque o gratuito delas costuma ser vitrine.
 * 2. Cada link aponta para o site da própria instituição: a URL tem de
 *    começar por uma das `bases` dela. Nada de cópia hospedada por terceiros,
 *    encurtador nem plataforma em que qualquer pessoa publica (YouTube,
 *    Drive, Scribd…), onde o dono do conteúdo não é verificável.
 * 3. Só https, sem usuário/senha na URL e sem parâmetro de rastreio ou de
 *    afiliado.
 * 4. A descrição é do projeto, sem palavra de venda (assinatura, teste
 *    grátis, cupom…). Recurso pago ou que exige cadastro não entra.
 * 5. Cada link guarda a data em que foi conferido por uma pessoa e some da
 *    tela sozinho quando a conferência vence (`MAX_CHECK_AGE_DAYS`): se
 *    ninguém mantiver o catálogo, ele esvazia em vez de apodrecer.
 * 6. Quem hospeda pode tirar um link na hora, sem nova versão, pela variável
 *    `STUDY_RESOURCES_BLOCKED` (pedido de remoção, link quebrado).
 */

/** Público: órgão ou instituição pública. Sem fins lucrativos: fundação, associação, ONG. */
export type ProviderKind = 'publico' | 'sem-fins-lucrativos';

export const PROVIDER_KINDS: readonly ProviderKind[] = [
  'publico',
  'sem-fins-lucrativos',
];

export interface StudyProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Quem mantém e por que é gratuito, em uma ou duas frases do projeto. */
  about: string;
  /**
   * Endereços aceitos, cada um com `https://`, host e caminho terminando em
   * `/`. A URL de um recurso (e todo redirecionamento dela, no verificador)
   * tem de começar por uma delas.
   */
  bases: string[];
}

export type ResourceType =
  | 'curso'
  | 'videoaulas'
  | 'exercicios'
  | 'livros'
  | 'acervo'
  | 'simulador'
  | 'dicionario'
  | 'documento';

export const RESOURCE_TYPES: readonly ResourceType[] = [
  'curso',
  'videoaulas',
  'exercicios',
  'livros',
  'acervo',
  'simulador',
  'dicionario',
  'documento',
];

export type ResourceLanguage = 'pt' | 'en' | 'es';

export interface StudyResource {
  /** Estável: é o que `STUDY_RESOURCES_BLOCKED` cita. */
  id: string;
  title: string;
  url: string;
  provider: string;
  types: ResourceType[];
  /** Matérias da taxonomia. Vazio = serve para todas. */
  subjects: string[];
  /** Assuntos da taxonomia, das matérias acima. Vazio = a matéria inteira. */
  topics: string[];
  description: string;
  language: ResourceLanguage;
  /** Data (AAAA-MM-DD) em que uma pessoa abriu o link e conferiu tudo. */
  checkedAt: string;
}

/** Validade de uma conferência. Depois disso o link sai da tela. */
export const MAX_CHECK_AGE_DAYS = 365;

export const MIN_DESCRIPTION_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 260;
export const MAX_TITLE_LENGTH = 80;

/**
 * Plataformas em que o dono do conteúdo não é a instituição (qualquer um
 * publica), encurtadores e hospedagens de arquivo. Nenhuma base de
 * instituição pode morar nelas.
 */
export const FORBIDDEN_HOSTS: readonly string[] = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  't.me',
  'drive.google.com',
  'docs.google.com',
  'sites.google.com',
  'dropbox.com',
  'mega.nz',
  'mediafire.com',
  'scribd.com',
  'academia.edu',
  'slideshare.net',
  'issuu.com',
  'archive.org',
  'blogspot.com',
  'wordpress.com',
  'medium.com',
  'github.io',
  'linktr.ee',
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  'cutt.ly',
  'is.gd',
  'ow.ly',
  'encurtador.com.br',
];

/** Parâmetros de rastreio, campanha ou afiliado (prefixo ou nome exato). */
const TRACKING_PARAM =
  /^(utm_|mc_|fbclid$|gclid$|dclid$|msclkid$|yclid$|ref$|ref_|referrer$|aff|afiliad|partner|parceiro|coupon|cupom|promo|desconto|discount|indicacao|campaign|campanha|source$|src$|cmp$)/i;

/** Palavras de quem vende: o texto do catálogo descreve material gratuito. */
const COMMERCIAL_WORDS =
  /\b(assinatura|assine|assinante|premium|teste gr[aá]tis|gr[aá]tis por|per[ií]odo de (teste|avalia[cç][aã]o)|cupom|desconto|promo[cç][aã]o|mensalidade|matr[ií]cula|compre|comprar|pre[cç]o|pago|paga)\b|R\$|US\$|€/i;

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function hostMatches(host: string, forbidden: string): boolean {
  return host === forbidden || host.endsWith(`.${forbidden}`);
}

/** Host proibido (plataforma aberta, encurtador, hospedagem de arquivo). */
export function isForbiddenHost(host: string): boolean {
  const h = host.toLowerCase();
  return FORBIDDEN_HOSTS.some((f) => hostMatches(h, f));
}

/** Nomes dos parâmetros de rastreio/afiliado presentes na URL. */
export function trackingParams(url: URL): string[] {
  return [...url.searchParams.keys()].filter((k) => TRACKING_PARAM.test(k));
}

/** A palavra de venda encontrada no texto, ou null. */
export function commercialWord(text: string): string | null {
  return COMMERCIAL_WORDS.exec(text)?.[0] ?? null;
}

/** A URL começa por uma das bases da instituição? */
export function withinBases(url: string, bases: readonly string[]): boolean {
  return bases.some((b) => url.startsWith(b));
}

/** Problemas de uma base de instituição (vazio = ok). */
export function baseProblems(base: string): string[] {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return [`base inválida: ${base}`];
  }
  const out: string[] = [];
  if (u.protocol !== 'https:') out.push(`base sem https: ${base}`);
  if (!base.endsWith('/')) out.push(`base tem de terminar em "/": ${base}`);
  if (u.search || u.hash) out.push(`base com parâmetro: ${base}`);
  if (u.username || u.password || u.port)
    out.push(`base com credencial ou porta: ${base}`);
  if (isForbiddenHost(u.hostname))
    out.push(`base numa plataforma aberta ou encurtador: ${base}`);
  // `https://host/` + o resto: a base precisa ser exatamente o que o URL
  // normaliza, senão "https://Host" aceitaria "https://host.evil".
  if (u.href !== base)
    out.push(`base fora da forma normalizada (${u.href}): ${base}`);
  return out;
}

/** Problemas de uma URL de recurso frente às bases da instituição. */
export function urlProblems(url: string, bases: readonly string[]): string[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return ['URL inválida'];
  }
  const out: string[] = [];
  if (u.protocol !== 'https:') out.push('URL sem https');
  if (u.username || u.password) out.push('URL com usuário ou senha');
  if (u.port) out.push('URL com porta');
  if (isForbiddenHost(u.hostname)) out.push(`host proibido: ${u.hostname}`);
  const rastreio = trackingParams(u);
  if (rastreio.length)
    out.push(`parâmetro de rastreio/afiliado: ${rastreio.join(', ')}`);
  if (u.href !== url) out.push(`URL fora da forma normalizada (${u.href})`);
  if (!withinBases(url, bases)) out.push('URL fora do site da instituição');
  return out;
}

/** Dias inteiros entre a data AAAA-MM-DD e `now` (UTC). */
export function daysSince(date: string, now: Date): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  const hoje = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor((hoje - t) / 86_400_000);
}

/** A conferência venceu? */
export function isExpired(
  checkedAt: string,
  now: Date,
  maxAgeDays = MAX_CHECK_AGE_DAYS,
): boolean {
  return daysSince(checkedAt, now) > maxAgeDays;
}

/**
 * Ids bloqueados por quem hospeda (`STUDY_RESOURCES_BLOCKED`), separados por
 * vírgula, espaço ou quebra de linha. Vazio ou ausente: nenhum.
 */
export function parseBlocked(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Os recursos que podem aparecer agora: conferência válida e sem bloqueio. */
export function visibleResources<T extends StudyResource>(
  resources: readonly T[],
  now: Date,
  blocked: ReadonlySet<string>,
): T[] {
  return resources.filter(
    (r) => !blocked.has(r.id) && !isExpired(r.checkedAt, now),
  );
}

/**
 * Tudo o que está errado no catálogo (vazio = ok). `taxonomy` é matéria →
 * assuntos; `now` serve para recusar data de conferência no futuro.
 */
export function validateCatalog(
  providers: readonly StudyProvider[],
  resources: readonly StudyResource[],
  taxonomy: ReadonlyMap<string, readonly string[]>,
  now: Date,
): string[] {
  const out: string[] = [];
  const porId = new Map<string, StudyProvider>();

  for (const p of providers) {
    const onde = `instituição ${p.id}`;
    if (!ID.test(p.id)) out.push(`${onde}: id fora do formato`);
    if (porId.has(p.id)) out.push(`${onde}: id repetido`);
    porId.set(p.id, p);
    if (!PROVIDER_KINDS.includes(p.kind))
      out.push(`${onde}: tipo ${p.kind} não aceito`);
    if (!p.bases.length) out.push(`${onde}: sem base`);
    for (const b of p.bases)
      out.push(...baseProblems(b).map((e) => `${onde}: ${e}`));
    if (p.about.length < MIN_DESCRIPTION_LENGTH)
      out.push(`${onde}: "about" curto demais`);
    const venda = commercialWord(p.about);
    if (venda) out.push(`${onde}: palavra de venda "${venda}"`);
  }

  const ids = new Set<string>();
  const urls = new Set<string>();
  const usados = new Set<string>();
  for (const r of resources) {
    const onde = `recurso ${r.id}`;
    if (!ID.test(r.id)) out.push(`${onde}: id fora do formato`);
    if (ids.has(r.id)) out.push(`${onde}: id repetido`);
    ids.add(r.id);
    if (urls.has(r.url)) out.push(`${onde}: URL repetida`);
    urls.add(r.url);

    const p = porId.get(r.provider);
    if (!p) {
      out.push(`${onde}: instituição ${r.provider} não existe`);
    } else {
      usados.add(p.id);
      out.push(...urlProblems(r.url, p.bases).map((e) => `${onde}: ${e}`));
    }

    if (!r.title.trim() || r.title.length > MAX_TITLE_LENGTH)
      out.push(`${onde}: título vazio ou longo`);
    if (
      r.description.length < MIN_DESCRIPTION_LENGTH ||
      r.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      out.push(`${onde}: descrição com ${r.description.length} caracteres`);
    }
    for (const texto of [r.title, r.description]) {
      const venda = commercialWord(texto);
      if (venda) out.push(`${onde}: palavra de venda "${venda}"`);
    }

    if (!r.types.length) out.push(`${onde}: sem tipo`);
    for (const t of r.types) {
      if (!RESOURCE_TYPES.includes(t))
        out.push(`${onde}: tipo ${t} não existe`);
    }
    if (new Set(r.types).size !== r.types.length)
      out.push(`${onde}: tipo repetido`);
    if (!['pt', 'en', 'es'].includes(r.language))
      out.push(`${onde}: idioma ${r.language}`);

    const assuntos = new Set<string>();
    for (const s of r.subjects) {
      const t = taxonomy.get(s);
      if (!t) out.push(`${onde}: matéria ${s} não existe na taxonomia`);
      else t.forEach((a) => assuntos.add(a));
    }
    if (new Set(r.subjects).size !== r.subjects.length)
      out.push(`${onde}: matéria repetida`);
    if (r.topics.length && !r.subjects.length)
      out.push(`${onde}: assunto sem matéria`);
    for (const a of r.topics) {
      if (!assuntos.has(a))
        out.push(`${onde}: assunto ${a} não é das matérias citadas`);
    }
    if (new Set(r.topics).size !== r.topics.length)
      out.push(`${onde}: assunto repetido`);

    if (
      !DATE.test(r.checkedAt) ||
      Number.isNaN(Date.parse(`${r.checkedAt}T00:00:00Z`))
    ) {
      out.push(`${onde}: data de conferência inválida`);
    } else if (daysSince(r.checkedAt, now) < 0) {
      out.push(`${onde}: data de conferência no futuro`);
    }
  }

  for (const p of providers) {
    if (!usados.has(p.id)) out.push(`instituição ${p.id}: nenhum recurso`);
  }
  return out;
}
