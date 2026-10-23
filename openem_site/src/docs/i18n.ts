/**
 * Idiomas da documentação (issue #89): português primeiro, como o resto do
 * projeto, e o espelho em inglês em /docs/en/. Página sem tradução aparece em
 * português no endereço inglês, com um aviso, para a navegação em inglês não
 * mandar ninguém de volta ao português no meio do caminho.
 */

export type Idioma = 'pt' | 'en';

export const IDIOMAS: { id: Idioma; nome: string; lang: string; base: string }[] = [
  { id: 'pt', nome: 'Português', lang: 'pt-BR', base: '/docs/' },
  { id: 'en', nome: 'English', lang: 'en', base: '/docs/en/' },
];

export function idiomaDaUrl(url: string): Idioma {
  return url === '/docs/en' || url.startsWith('/docs/en/') ? 'en' : 'pt';
}

export function baseDo(idioma: Idioma): string {
  return IDIOMAS.find((i) => i.id === idioma)!.base;
}

export function langDo(idioma: Idioma): string {
  return IDIOMAS.find((i) => i.id === idioma)!.lang;
}

/** O mesmo endereço no outro idioma: /docs/hospedar/ia/ ↔ /docs/en/hospedar/ia/. */
export function urlNoIdioma(url: string, idioma: Idioma): string {
  const resto = idiomaDaUrl(url) === 'en' ? url.replace(/^\/docs\/en\/?/, '') : url.replace(/^\/docs\/?/, '');
  return baseDo(idioma) + resto;
}

export const TEXTOS = {
  pt: {
    tituloBase: 'Documentação do OpENEM',
    inicioTitulo: 'Documentação do OpENEM',
    inicioResumo:
      'Como estudar com cada parte do app, e como rodar e melhorar o OpENEM se você for de uma escola ou quiser contribuir.',
    documentacao: 'Documentação',
    paginas: 'Páginas da documentação',
    vizinhas: 'Páginas vizinhas',
    anterior: 'Anterior',
    proxima: 'Próxima',
    nestaPagina: 'Nesta página',
    sugerir: 'Sugerir uma correção nesta página',
    abrirApp: 'Abrir o app',
    codigo: 'Código no GitHub',
    indice: 'Índice',
    fechar: 'Fechar',
    pular: 'Pular para o conteúdo',
    naoEncontradaTitulo: 'Página não encontrada',
    naoEncontradaTexto: 'Esse endereço não existe na documentação. Use a busca ou volte ao início.',
    irAoInicio: 'Ir para o início da documentação',
    semTraducao: '',
    outroIdioma: 'Read in English',
    buscar: 'Buscar',
    buscarNa: 'Buscar na documentação',
    nadaEncontrado: (q: string) => `Nada encontrado para “${q}”.`,
  },
  en: {
    tituloBase: 'OpENEM documentation',
    inicioTitulo: 'OpENEM documentation',
    inicioResumo:
      'How to run and improve OpENEM, for schools that host their own copy and for contributors. The student guides are in Portuguese, the language of the ENEM.',
    documentacao: 'Documentation',
    paginas: 'Documentation pages',
    vizinhas: 'Nearby pages',
    anterior: 'Previous',
    proxima: 'Next',
    nestaPagina: 'On this page',
    sugerir: 'Suggest a fix for this page',
    abrirApp: 'Open the app',
    codigo: 'Code on GitHub',
    indice: 'Contents',
    fechar: 'Close',
    pular: 'Skip to content',
    naoEncontradaTitulo: 'Page not found',
    naoEncontradaTexto: 'This address does not exist in the documentation. Use the search or go back to the start.',
    irAoInicio: 'Go to the documentation home',
    semTraducao: 'This page has not been translated yet, so it is shown in Portuguese.',
    outroIdioma: 'Ler em português',
    buscar: 'Search',
    buscarNa: 'Search the documentation',
    nadaEncontrado: (q: string) => `Nothing found for “${q}”.`,
  },
} satisfies Record<Idioma, Record<string, string | ((q: string) => string)>>;
