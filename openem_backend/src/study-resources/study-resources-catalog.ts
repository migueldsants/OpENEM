import type { StudyProvider, StudyResource } from './study-resource-rules';

/**
 * Catálogo da tela "Onde estudar" (discussão #126): materiais gratuitos de
 * instituições públicas ou sem fins lucrativos, um por link, conferidos à mão.
 * As regras estão em `study-resource-rules.ts` e o teste do catálogo as cobra.
 *
 * Para incluir um material:
 * 1. A instituição tem de ser pública ou sem fins lucrativos e o link tem de
 *    estar no site dela (nada de cópia em outro site, YouTube ou Drive).
 * 2. Abra o link num navegador sem login: tudo tem de abrir sem pagar e sem
 *    criar conta. Conta opcional (só para salvar progresso) pode.
 * 3. Escreva a descrição com as suas palavras; não copie a do site.
 * 4. `checkedAt` é a data em que você conferiu. Rode
 *    `npm run recursos:verificar` antes do PR.
 * Guia completo: `openem_site/src/docs/conteudo/contribuir/05-materiais-gratuitos.md`.
 */

export const STUDY_PROVIDERS: StudyProvider[] = [
  {
    id: 'inep',
    name: 'Inep',
    kind: 'publico',
    about:
      'Autarquia do Ministério da Educação que elabora e aplica o ENEM. Publica as provas, os gabaritos e os guias da prova.',
    bases: ['https://www.gov.br/inep/'],
  },
  {
    id: 'khan-academy',
    name: 'Khan Academy',
    kind: 'sem-fins-lucrativos',
    about:
      'Organização sem fins lucrativos. Todo o conteúdo é gratuito; criar conta é opcional e só serve para guardar o progresso.',
    bases: ['https://pt.khanacademy.org/'],
  },
  {
    id: 'obmep',
    name: 'OBMEP (IMPA)',
    kind: 'publico',
    about:
      'Olimpíada Brasileira de Matemática das Escolas Públicas, realizada pelo IMPA com recursos públicos. O material fica aberto a qualquer estudante.',
    bases: ['https://portaldaobmep.impa.br/', 'https://www.obmep.org.br/'],
  },
  {
    id: 'phet',
    name: 'PhET (Universidade do Colorado)',
    kind: 'publico',
    about:
      'Projeto de uma universidade pública dos Estados Unidos. As simulações são gratuitas e têm licença aberta.',
    bases: ['https://phet.colorado.edu/pt_BR/'],
  },
  {
    id: 'sbq',
    name: 'Sociedade Brasileira de Química',
    kind: 'sem-fins-lucrativos',
    about:
      'Associação científica sem fins lucrativos. A revista Química Nova na Escola tem todos os artigos abertos.',
    bases: ['https://qnesc.sbq.org.br/'],
  },
  {
    id: 'fiocruz',
    name: 'Fiocruz',
    kind: 'publico',
    about:
      'Fundação Oswaldo Cruz, instituição pública de pesquisa em saúde ligada ao Ministério da Saúde.',
    bases: ['https://invivo.fiocruz.br/'],
  },
  {
    id: 'ministerio-da-saude',
    name: 'Ministério da Saúde',
    kind: 'publico',
    about:
      'Publicações oficiais do Ministério da Saúde, abertas para leitura e download.',
    bases: ['https://www.gov.br/saude/'],
  },
  {
    id: 'ibge',
    name: 'IBGE',
    kind: 'publico',
    about:
      'Instituto Brasileiro de Geografia e Estatística, órgão público. O IBGE Educa reúne o conteúdo do instituto para estudantes.',
    bases: ['https://educa.ibge.gov.br/', 'https://atlasescolar.ibge.gov.br/'],
  },
  {
    id: 'atlas-brasil',
    name: 'Atlas do Desenvolvimento Humano (PNUD, Ipea e FJP)',
    kind: 'publico',
    about:
      'Plataforma do Programa das Nações Unidas para o Desenvolvimento, do Ipea e da Fundação João Pinheiro, com dados abertos.',
    bases: ['https://www.atlasbrasil.org.br/'],
  },
  {
    id: 'planalto',
    name: 'Presidência da República',
    kind: 'publico',
    about:
      'Portal oficial da legislação federal. Texto de lei é de domínio público e pode ser lido e copiado livremente.',
    bases: ['https://www.planalto.gov.br/ccivil_03/'],
  },
  {
    id: 'arquivo-nacional',
    name: 'Arquivo Nacional',
    kind: 'publico',
    about:
      'Órgão público que guarda os documentos do Estado brasileiro. O Memórias Reveladas reúne o acervo sobre o período de 1964 a 1985.',
    bases: ['https://www.gov.br/memoriasreveladas/'],
  },
  {
    id: 'fgv-cpdoc',
    name: 'FGV CPDOC',
    kind: 'sem-fins-lucrativos',
    about:
      'Centro de pesquisa em história da Fundação Getulio Vargas, fundação privada sem fins lucrativos. O atlas é aberto.',
    bases: ['https://atlas.fgv.br/'],
  },
  {
    id: 'usp-brasiliana',
    name: 'Biblioteca Brasiliana (USP)',
    kind: 'publico',
    about:
      'Biblioteca da Universidade de São Paulo. O acervo digital reúne livros e documentos de domínio público.',
    bases: ['https://digital.bbm.usp.br/'],
  },
  {
    id: 'ufsc',
    name: 'UFSC',
    kind: 'publico',
    about:
      'Universidade Federal de Santa Catarina. A biblioteca digital traz obras literárias completas, sem cadastro.',
    bases: ['https://literaturabrasileira.ufsc.br/'],
  },
  {
    id: 'abl',
    name: 'Academia Brasileira de Letras',
    kind: 'sem-fins-lucrativos',
    about:
      'Instituição cultural sem fins lucrativos que publica o Vocabulário Ortográfico, a referência oficial da grafia das palavras.',
    bases: ['https://www.academia.org.br/nossa-lingua/'],
  },
  {
    id: 'itau-cultural',
    name: 'Itaú Cultural',
    kind: 'sem-fins-lucrativos',
    about:
      'Instituto cultural sem fins lucrativos. A enciclopédia de arte e cultura brasileiras é aberta e não tem anúncios.',
    bases: ['https://enciclopedia.itaucultural.org.br/'],
  },
  {
    id: 'bbc',
    name: 'BBC Learning English',
    kind: 'publico',
    about:
      'Serviço da BBC, emissora pública do Reino Unido, para quem aprende inglês. Todo o conteúdo é aberto.',
    bases: ['https://www.bbc.co.uk/learningenglish/'],
  },
  {
    id: 'british-council',
    name: 'British Council',
    kind: 'sem-fins-lucrativos',
    about:
      'Organização britânica sem fins lucrativos para educação e cultura. O site para adolescentes é aberto, sem cadastro.',
    bases: ['https://learnenglishteens.britishcouncil.org/'],
  },
  {
    id: 'rae',
    name: 'Real Academia Española',
    kind: 'publico',
    about:
      'Instituição pública da Espanha que publica o dicionário de referência da língua espanhola, aberto para consulta.',
    bases: ['https://dle.rae.es/'],
  },
  {
    id: 'cervantes-virtual',
    name: 'Biblioteca Virtual Miguel de Cervantes',
    kind: 'sem-fins-lucrativos',
    about:
      'Fundação sem fins lucrativos ligada à Universidade de Alicante, com obras em espanhol abertas para leitura.',
    bases: ['https://www.cervantesvirtual.com/'],
  },
  {
    id: 'stanford',
    name: 'Stanford Encyclopedia of Philosophy',
    kind: 'sem-fins-lucrativos',
    about:
      'Enciclopédia da Universidade Stanford, escrita e revisada por especialistas. Aberta, em inglês.',
    bases: ['https://plato.stanford.edu/'],
  },
];

/** Data da conferência feita junto com a criação da tela. */
const CONFERIDO = '2026-11-13';

export const STUDY_RESOURCES: StudyResource[] = [
  // ---- Para todas as matérias ----
  {
    id: 'inep-provas-e-gabaritos',
    title: 'Provas e gabaritos do ENEM',
    url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos',
    provider: 'inep',
    types: ['documento', 'exercicios'],
    subjects: [],
    topics: [],
    description:
      'Os cadernos de prova e os gabaritos oficiais das edições do ENEM, publicados pelo Inep. É de onde vêm as questões do OpENEM.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Redação ----
  {
    id: 'inep-cartilha-redacao',
    title: 'A redação no ENEM: cartilha do participante',
    url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos',
    provider: 'inep',
    types: ['documento'],
    subjects: ['Redação'],
    topics: [
      'Estrutura dissertativa',
      'Argumentação',
      'Proposta de intervenção',
      'Repertório sociocultural',
    ],
    description:
      'Guia anual do Inep com o que cada uma das cinco competências avalia e redações nota mil comentadas. A página reúne as edições recentes.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Matemática ----
  {
    id: 'khan-prepare-se-ensino-medio',
    title: 'Prepare-se para o Ensino Médio',
    url: 'https://pt.khanacademy.org/math/pt-mat-prep-em-todo-conteudo',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: [
      'Porcentagem',
      'Razão e proporção',
      'Regra de três',
      'Equações do 2º grau',
      'Conjuntos numéricos',
    ],
    description:
      'Revisão da base do fundamental: porcentagem, proporção, notação científica e equações do segundo grau. Bom ponto de partida para quem está enferrujado.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-algebra-1',
    title: 'Matemática EM: Álgebra 1',
    url: 'https://pt.khanacademy.org/math/em-mat-algebra',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: [
      'Funções',
      'Função afim',
      'Função quadrática',
      'Sistemas de equações',
      'Equações do 1º grau',
    ],
    description:
      'Curso alinhado à BNCC com vídeos curtos e exercícios corrigidos na hora: expressões, taxas, função afim, sistemas lineares e função quadrática.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-algebra-2',
    title: 'Matemática EM: Álgebra 2',
    url: 'https://pt.khanacademy.org/math/em-mat-algebra2',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: [
      'Progressão aritmética',
      'Progressão geométrica',
      'Função exponencial',
      'Função logarítmica',
      'Geometria analítica',
    ],
    description:
      'Progressões aritméticas e geométricas, funções exponencial e logarítmica e equação da reta, com exercícios de cada unidade.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-geometria',
    title: 'Matemática EM: Geometria',
    url: 'https://pt.khanacademy.org/math/em-mat-geometria',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: [
      'Geometria plana',
      'Geometria espacial',
      'Áreas e perímetros',
      'Volumes',
    ],
    description:
      'Transformações, congruência, semelhança de triângulos, áreas e volumes de sólidos, com exercícios em cada etapa.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-medidas-trigonometria',
    title: 'Matemática EM: Medidas e Trigonometria',
    url: 'https://pt.khanacademy.org/math/em-mat-medidas',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: ['Trigonometria'],
    description:
      'Do teorema de Pitágoras ao ciclo trigonométrico: razões no triângulo retângulo, lei dos senos e cossenos e funções trigonométricas.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-probabilidade',
    title: 'Matemática EM: Probabilidade',
    url: 'https://pt.khanacademy.org/math/em-mat-probabilidade',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: ['Probabilidade', 'Análise combinatória'],
    description:
      'Princípio da contagem, arranjos e combinações e o cálculo de probabilidades, com problemas do tipo que aparece no ENEM.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'khan-em-estatistica',
    title: 'Matemática EM: Estatística',
    url: 'https://pt.khanacademy.org/math/em-mat-estatistica',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Matemática'],
    topics: [
      'Estatística',
      'Média, mediana e moda',
      'Interpretação de gráficos',
      'Juros simples e compostos',
    ],
    description:
      'Leitura de gráficos e tabelas, distribuição de frequências, média, mediana, moda e desvio padrão, e uma unidade sobre sistemas de amortização.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'obmep-portal-ensino-medio',
    title: 'Portal da OBMEP: Ensino Médio',
    url: 'https://portaldaobmep.impa.br/index.php/site/index?a=3',
    provider: 'obmep',
    types: ['videoaulas', 'exercicios', 'documento'],
    subjects: ['Matemática'],
    topics: [],
    description:
      'Videoaulas, exercícios resolvidos em vídeo, cadernos de exercícios e material teórico organizados pelos três anos do ensino médio.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'obmep-apostilas-pic',
    title: 'Apostilas do Programa de Iniciação Científica (PIC)',
    url: 'https://www.obmep.org.br/apostilas.htm',
    provider: 'obmep',
    types: ['livros'],
    subjects: ['Matemática'],
    topics: [
      'Análise combinatória',
      'Geometria plana',
      'Operações e propriedades',
    ],
    description:
      'Apostilas em PDF escritas para os alunos premiados da OBMEP, sobre aritmética, contagem e geometria. Vão além do ENEM; boas para aprofundar.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'obmep-banco-de-questoes',
    title: 'Banco de Questões da OBMEP',
    url: 'https://www.obmep.org.br/banco.htm',
    provider: 'obmep',
    types: ['exercicios'],
    subjects: ['Matemática'],
    topics: [],
    description:
      'Livros anuais de problemas com solução, em PDF. São mais difíceis que os do ENEM e treinam o raciocínio em problemas novos.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Física ----
  {
    id: 'khan-fisica-ensino-medio',
    title: 'Física: Ensino Médio',
    url: 'https://pt.khanacademy.org/science/fisica-ensino-medio',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Física'],
    topics: [
      'Cinemática',
      'Leis de Newton',
      'Trabalho e energia',
      'Impulso e quantidade de movimento',
      'Gravitação',
      'Ondas',
      'Acústica',
      'Óptica geométrica',
      'Circuitos elétricos',
      'Hidrostática',
      'Calorimetria',
      'Termodinâmica',
    ],
    description:
      'Curso completo em 16 unidades: movimentos, leis de Newton, energia, colisões, ondas, som, luz, circuitos, fluidos e termodinâmica.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'phet-fisica',
    title: 'Simulações PhET de Física',
    url: 'https://phet.colorado.edu/pt_BR/simulations/filter?subjects=physics',
    provider: 'phet',
    types: ['simulador'],
    subjects: ['Física'],
    topics: [
      'Cinemática',
      'Leis de Newton',
      'Circuitos elétricos',
      'Ondas',
      'Óptica geométrica',
    ],
    description:
      'Experimentos interativos em português: monte circuitos, lance projéteis, mexa em ondas e lentes e veja o que muda em cada grandeza.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Química ----
  {
    id: 'khan-quimica-ensino-medio',
    title: 'Química: Ensino Médio',
    url: 'https://pt.khanacademy.org/science/quimica-ensino-medio',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Química'],
    topics: [
      'Estrutura atômica',
      'Tabela periódica',
      'Ligações químicas',
      'Funções orgânicas',
      'Funções inorgânicas',
      'Estequiometria',
      'Reações químicas',
      'Cinética química',
      'Equilíbrio químico',
      'Termoquímica',
    ],
    description:
      'Modelos atômicos, tabela periódica, ligações, ácidos, bases e sais, mol, reações, cinética, equilíbrio e termoquímica.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'phet-quimica',
    title: 'Simulações PhET de Química',
    url: 'https://phet.colorado.edu/pt_BR/simulations/filter?subjects=chemistry',
    provider: 'phet',
    types: ['simulador'],
    subjects: ['Química'],
    topics: [
      'Estrutura atômica',
      'Soluções',
      'Reações químicas',
      'Propriedades da matéria',
    ],
    description:
      'Experimentos interativos em português: monte átomos e moléculas, balanceie equações, prepare soluções e mude a temperatura de um gás.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'qnesc-revista',
    title: 'Química Nova na Escola',
    url: 'https://qnesc.sbq.org.br/',
    provider: 'sbq',
    types: ['acervo'],
    subjects: ['Química'],
    topics: [],
    description:
      'Revista de ensino de química com artigos abertos sobre experimentos e química do cotidiano. Escrita para professores, serve para aprofundar um assunto.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Biologia ----
  {
    id: 'khan-biologia-ensino-medio',
    title: 'Biologia: Ensino Médio',
    url: 'https://pt.khanacademy.org/science/biologia-ensino-medio',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Biologia'],
    topics: [
      'Citologia',
      'Metabolismo energético',
      'Reprodução',
      'Genética',
      'Evolução',
      'Botânica',
      'Zoologia',
      'Fisiologia humana',
      'Ecologia',
    ],
    description:
      'Células, metabolismo, divisão celular, genética clássica e molecular, evolução, plantas, animais, corpo humano e ecologia.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'fiocruz-invivo',
    title: 'Invivo (Museu da Vida)',
    url: 'https://invivo.fiocruz.br/',
    provider: 'fiocruz',
    types: ['acervo'],
    subjects: ['Biologia'],
    topics: ['Saúde e doenças', 'Microbiologia', 'Imunologia', 'Biotecnologia'],
    description:
      'Textos de divulgação científica da Fiocruz sobre saúde, doenças, vacinas, microrganismos e biotecnologia, em linguagem acessível.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'phet-biologia',
    title: 'Simulações PhET de Biologia',
    url: 'https://phet.colorado.edu/pt_BR/simulations/filter?subjects=biology',
    provider: 'phet',
    types: ['simulador'],
    subjects: ['Biologia'],
    topics: ['Evolução', 'Genética'],
    description:
      'Experimentos interativos em português sobre seleção natural, expressão gênica e membranas celulares.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- História ----
  {
    id: 'fgv-atlas-historico',
    title: 'Atlas Histórico do Brasil',
    url: 'https://atlas.fgv.br/',
    provider: 'fgv-cpdoc',
    types: ['acervo'],
    subjects: ['História'],
    topics: [
      'Brasil Colônia',
      'Brasil Império',
      'República Velha',
      'Era Vargas',
      'Ditadura militar',
      'Redemocratização',
    ],
    description:
      'A história do Brasil em mapas, fotos, documentos e verbetes, da colônia à Nova República, organizada por período.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'memorias-reveladas',
    title: 'Memórias Reveladas',
    url: 'https://www.gov.br/memoriasreveladas/pt-br',
    provider: 'arquivo-nacional',
    types: ['acervo'],
    subjects: ['História'],
    topics: ['Ditadura militar'],
    description:
      'Acervo do Arquivo Nacional sobre o período de 1964 a 1985, com documentos originais e os relatórios das comissões da verdade.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'brasiliana-usp',
    title: 'Acervo digital da Brasiliana',
    url: 'https://digital.bbm.usp.br/',
    provider: 'usp-brasiliana',
    types: ['acervo', 'livros'],
    subjects: ['História', 'Literatura'],
    topics: [
      'Brasil Colônia',
      'Brasil Império',
      'Escravidão no Brasil',
      'Romantismo',
    ],
    description:
      'Livros, mapas e documentos históricos digitalizados pela USP, em domínio público. Bom para ler as fontes de época e obras do século XIX.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Geografia ----
  {
    id: 'ibge-conheca-o-brasil',
    title: 'IBGE Educa: Conheça o Brasil',
    url: 'https://educa.ibge.gov.br/jovens/conheca-o-brasil.html',
    provider: 'ibge',
    types: ['acervo'],
    subjects: ['Geografia'],
    topics: [
      'População',
      'Biomas',
      'Relevo',
      'Hidrografia',
      'Clima',
      'Regionalização do Brasil',
    ],
    description:
      'Textos curtos do IBGE sobre território e população do Brasil: biomas, relevo, rios, clima, divisão regional e dados do Censo 2022.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'ibge-no-enem',
    title: 'O IBGE no ENEM',
    url: 'https://educa.ibge.gov.br/jovens/material-de-estudo/enem',
    provider: 'ibge',
    types: ['exercicios'],
    subjects: ['Geografia', 'Matemática'],
    topics: [
      'Cartografia',
      'População',
      'Interpretação de gráficos',
      'Estatística',
    ],
    description:
      'Questões de provas do ENEM que usaram dados e mapas do IBGE, reunidas pelo próprio instituto em PDF.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'ibge-atlas-escolar',
    title: 'Atlas Geográfico Escolar',
    url: 'https://atlasescolar.ibge.gov.br/',
    provider: 'ibge',
    types: ['acervo'],
    subjects: ['Geografia'],
    topics: ['Cartografia', 'Regionalização do Brasil', 'Geopolítica'],
    description:
      'Mapas do Brasil e do mundo do IBGE para estudantes, com noções de cartografia: escala, projeções e leitura de mapas.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Sociologia ----
  {
    id: 'atlas-desenvolvimento-humano',
    title: 'Atlas do Desenvolvimento Humano no Brasil',
    url: 'https://www.atlasbrasil.org.br/',
    provider: 'atlas-brasil',
    types: ['acervo'],
    subjects: ['Sociologia', 'Geografia'],
    topics: ['Desigualdade social', 'População'],
    description:
      'IDH, renda, educação e longevidade de cada município e estado, com gráficos e comparações. Ajuda a ler as questões sobre desigualdade com dados.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'constituicao-federal',
    title: 'Constituição Federal de 1988',
    url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    provider: 'planalto',
    types: ['documento'],
    subjects: ['Sociologia', 'História'],
    topics: ['Cidadania', 'Estado e poder', 'Redemocratização'],
    description:
      'O texto oficial e atualizado da Constituição. Os direitos fundamentais e sociais (artigos 5º a 11) caem com frequência na prova.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Filosofia ----
  {
    id: 'stanford-encyclopedia',
    title: 'Stanford Encyclopedia of Philosophy',
    url: 'https://plato.stanford.edu/',
    provider: 'stanford',
    types: ['acervo'],
    subjects: ['Filosofia'],
    topics: [],
    description:
      'Verbetes revisados por especialistas sobre filósofos e conceitos, de Platão à filosofia contemporânea. Em inglês e aprofundado: use para consulta.',
    language: 'en',
    checkedAt: CONFERIDO,
  },

  // ---- Língua Portuguesa e Literatura ----
  {
    id: 'khan-prepare-se-portugues',
    title: 'Prepare-se para o Ensino Médio: Português',
    url: 'https://pt.khanacademy.org/humanities/prepare-se-para-o-ensino-medio-portugues',
    provider: 'khan-academy',
    types: ['curso', 'exercicios'],
    subjects: ['Língua Portuguesa'],
    topics: ['Interpretação de texto', 'Gêneros textuais'],
    description:
      'Leitura e interpretação de textos jornalísticos, da vida pública, de estudo e literários, com exercícios corrigidos na hora.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'abl-volp',
    title: 'Vocabulário Ortográfico da Língua Portuguesa',
    url: 'https://www.academia.org.br/nossa-lingua/busca-no-vocabulario',
    provider: 'abl',
    types: ['dicionario'],
    subjects: ['Língua Portuguesa'],
    topics: ['Ortografia'],
    description:
      'A consulta oficial da grafia das palavras, com hífen e acentuação segundo o Acordo Ortográfico. Útil para tirar dúvidas na redação.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'ufsc-literatura-lusofona',
    title: 'Biblioteca Digital de Literatura de Países Lusófonos',
    url: 'https://literaturabrasileira.ufsc.br/',
    provider: 'ufsc',
    types: ['livros'],
    subjects: ['Literatura'],
    topics: [
      'Barroco',
      'Arcadismo',
      'Romantismo',
      'Realismo e Naturalismo',
      'Parnasianismo e Simbolismo',
    ],
    description:
      'Obras completas de autores de língua portuguesa para ler no navegador, com fichas dos autores. Inclui os clássicos que o ENEM costuma citar.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Artes e Educação Física ----
  {
    id: 'khan-historia-da-arte',
    title: 'História da Arte',
    url: 'https://pt.khanacademy.org/humanities/art-history',
    provider: 'khan-academy',
    types: ['curso', 'videoaulas'],
    subjects: ['Artes'],
    topics: ['História da arte', 'Movimentos artísticos'],
    description:
      'Da arte pré-histórica aos movimentos modernos, com análise de obras em vídeo e texto. Começa com um módulo sobre como olhar uma obra.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'enciclopedia-itau-cultural',
    title: 'Enciclopédia Itaú Cultural',
    url: 'https://enciclopedia.itaucultural.org.br/',
    provider: 'itau-cultural',
    types: ['acervo'],
    subjects: ['Artes'],
    topics: [
      'Arte brasileira',
      'Movimentos artísticos',
      'Teatro e cinema',
      'Música e dança',
    ],
    description:
      'Verbetes sobre artistas, obras e movimentos da arte brasileira: artes visuais, teatro, cinema, música e dança.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },
  {
    id: 'guia-atividade-fisica',
    title: 'Guia de Atividade Física para a População Brasileira',
    url: 'https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/guias-e-manuais/2021/guia-de-atividade-fisica-para-a-populacao-brasileira.pdf/view',
    provider: 'ministerio-da-saude',
    types: ['documento'],
    subjects: ['Educação Física'],
    topics: ['Atividade física e qualidade de vida', 'Corpo e saúde'],
    description:
      'Guia oficial com as recomendações de atividade física para cada idade e o papel da educação física escolar. Base para as questões de saúde e corpo.',
    language: 'pt',
    checkedAt: CONFERIDO,
  },

  // ---- Língua Estrangeira ----
  {
    id: 'bbc-learning-english',
    title: 'BBC Learning English',
    url: 'https://www.bbc.co.uk/learningenglish/',
    provider: 'bbc',
    types: ['curso', 'videoaulas', 'exercicios'],
    subjects: ['Língua Estrangeira'],
    topics: ['Interpretação de texto em inglês', 'Vocabulário e expressões'],
    description:
      'Cursos por nível, notícias comentadas, vocabulário e gramática em vídeos e áudios curtos. Todo em inglês, bom para treinar leitura.',
    language: 'en',
    checkedAt: CONFERIDO,
  },
  {
    id: 'british-council-teens',
    title: 'LearnEnglish Teens',
    url: 'https://learnenglishteens.britishcouncil.org/',
    provider: 'british-council',
    types: ['exercicios'],
    subjects: ['Língua Estrangeira'],
    topics: [
      'Interpretação de texto em inglês',
      'Leitura e compreensão',
      'Gêneros textuais estrangeiros',
    ],
    description:
      'Textos de vários gêneros por nível, com exercícios de compreensão, feitos para adolescentes. Todo em inglês.',
    language: 'en',
    checkedAt: CONFERIDO,
  },
  {
    id: 'rae-diccionario',
    title: 'Diccionario de la lengua española',
    url: 'https://dle.rae.es/',
    provider: 'rae',
    types: ['dicionario'],
    subjects: ['Língua Estrangeira'],
    topics: ['Interpretação de texto em espanhol', 'Vocabulário e expressões'],
    description:
      'O dicionário de referência do espanhol. Útil para os falsos cognatos, palavras que parecem português e significam outra coisa.',
    language: 'es',
    checkedAt: CONFERIDO,
  },
  {
    id: 'cervantes-virtual',
    title: 'Biblioteca Virtual Miguel de Cervantes',
    url: 'https://www.cervantesvirtual.com/',
    provider: 'cervantes-virtual',
    types: ['livros'],
    subjects: ['Língua Estrangeira'],
    topics: ['Interpretação de texto em espanhol', 'Leitura e compreensão'],
    description:
      'Obras literárias e textos em espanhol, de Cervantes a autores latino-americanos, para treinar leitura no idioma.',
    language: 'es',
    checkedAt: CONFERIDO,
  },
];
