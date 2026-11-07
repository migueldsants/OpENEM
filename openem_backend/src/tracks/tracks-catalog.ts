/**
 * Trilhas de estudo por matéria (discussão #122): a ordem sugerida para quem
 * começa a matéria do zero. Cada etapa junta de 1 a 4 assuntos da taxonomia
 * (`src/common/taxonomy.ts`), citados pelo nome; os ids são resolvidos na
 * leitura. `tracks-catalog.spec.ts` cobra que todo assunto da matéria esteja
 * em exatamente uma etapa ou em `extras`.
 *
 * Regras de escrita:
 * 1. Ordem por pré-requisito primeiro, depois pelo que mais cai.
 * 2. Etapa que soma menos de 0,5 questão por prova (nas regulares recentes)
 *    vai para `extras`, mostrada como "Se sobrar tempo".
 * 3. `why` é do projeto, em português simples, sem prometer nota e sem
 *    número (a tela mostra a incidência ao lado, vinda do banco).
 * 4. Em Humanas, nenhuma etapa toma lado em debate público; conceito
 *    controverso é atribuído ao autor, como nos flashcards.
 */

export interface TrackStageDef {
  title: string;
  why: string;
  topics: string[];
}

export interface TrackDef {
  subject: string;
  stages: TrackStageDef[];
  /** Assuntos que quase não caíram: no fim da trilha, recolhidos. */
  extras: string[];
}

export const MAX_TOPICS_PER_STAGE = 4;
export const MAX_WHY_LENGTH = 90;

/**
 * Assuntos de uma língua só: o aluno vê o do idioma do perfil
 * (`Profile.foreignLanguage`).
 */
export const LANGUAGE_TOPICS: Readonly<Record<string, 'ingles' | 'espanhol'>> =
  {
    'Interpretação de texto em inglês': 'ingles',
    'Interpretação de texto em espanhol': 'espanhol',
  };

export const TRACKS: TrackDef[] = [
  {
    subject: 'Matemática',
    stages: [
      {
        title: 'Base numérica',
        why: 'As contas que todas as outras etapas usam',
        topics: ['Operações e propriedades', 'Conjuntos numéricos'],
      },
      {
        title: 'Proporção e porcentagem',
        why: 'O bloco que mais cai na prova de Matemática',
        topics: ['Razão e proporção', 'Regra de três', 'Porcentagem'],
      },
      {
        title: 'Leitura de dados',
        why: 'Tabelas, gráficos e médias, presentes em toda prova',
        topics: [
          'Interpretação de gráficos',
          'Média, mediana e moda',
          'Estatística',
        ],
      },
      {
        title: 'Equações',
        why: 'Transformar o enunciado em conta e resolver',
        topics: [
          'Equações do 1º grau',
          'Equações do 2º grau',
          'Sistemas de equações',
        ],
      },
      {
        title: 'Geometria plana',
        why: 'Figuras, áreas e o triângulo retângulo',
        topics: ['Geometria plana', 'Áreas e perímetros', 'Trigonometria'],
      },
      {
        title: 'Geometria espacial',
        why: 'Sólidos, planificações e volumes',
        topics: ['Geometria espacial', 'Volumes'],
      },
      {
        title: 'Contagem e chance',
        why: 'Contar possibilidades e calcular probabilidades',
        topics: ['Análise combinatória', 'Probabilidade'],
      },
      {
        title: 'Funções',
        why: 'Ler e montar a relação entre duas grandezas',
        topics: ['Funções', 'Função afim', 'Função quadrática'],
      },
      {
        title: 'Juros e crescimento',
        why: 'Dinheiro no tempo e grandezas que crescem cada vez mais rápido',
        topics: [
          'Juros simples e compostos',
          'Função exponencial',
          'Função logarítmica',
        ],
      },
      {
        title: 'Sequências',
        why: 'Padrões que crescem de forma regular',
        topics: ['Progressão aritmética', 'Progressão geométrica'],
      },
      {
        title: 'Plano cartesiano',
        why: 'Pontos, retas e distâncias no plano',
        topics: ['Geometria analítica'],
      },
    ],
    extras: ['Matrizes e determinantes', 'Polinômios', 'Números complexos'],
  },
  {
    subject: 'Língua Portuguesa',
    stages: [
      {
        title: 'Leitura e interpretação',
        why: 'A base de quase toda questão de Linguagens',
        topics: ['Interpretação de texto'],
      },
      {
        title: 'Gêneros e tipos de texto',
        why: 'Reconhecer para que serve cada texto e como ele se organiza',
        topics: ['Gêneros textuais', 'Tipologia textual'],
      },
      {
        title: 'Variação linguística',
        why: 'Os jeitos de falar português e quando cada um é adequado',
        topics: ['Variação linguística'],
      },
      {
        title: 'Funções da linguagem',
        why: 'O objetivo de quem escreve e o diálogo entre textos',
        topics: ['Funções da linguagem', 'Intertextualidade'],
      },
      {
        title: 'Sentido e estilo',
        why: 'Como a escolha das palavras muda o sentido',
        topics: ['Figuras de linguagem', 'Semântica'],
      },
      {
        title: 'Coesão e pontuação',
        why: 'O que liga as partes do texto e dá ritmo à frase',
        topics: ['Coesão e coerência', 'Pontuação'],
      },
    ],
    extras: ['Morfologia', 'Concordância', 'Sintaxe', 'Ortografia', 'Regência'],
  },
  {
    subject: 'Literatura',
    stages: [
      {
        title: 'Literatura de hoje',
        why: 'Textos recentes, a leitura literária que mais aparece',
        topics: ['Literatura contemporânea'],
      },
      {
        title: 'Modernismo',
        why: 'A Semana de 22 e a ruptura com a tradição',
        topics: ['Modernismo'],
      },
      {
        title: 'Realismo e Naturalismo',
        why: 'Machado de Assis, Aluísio Azevedo e o retrato da sociedade',
        topics: ['Realismo e Naturalismo'],
      },
      {
        title: 'Do Romantismo ao Simbolismo',
        why: 'O século XIX entre emoção, forma e mistério',
        topics: ['Romantismo', 'Parnasianismo e Simbolismo'],
      },
    ],
    extras: ['Quinhentismo', 'Barroco', 'Arcadismo'],
  },
  {
    subject: 'Língua Estrangeira',
    stages: [
      {
        title: 'Leitura no seu idioma',
        why: 'Entender a ideia central do texto sem traduzir palavra por palavra',
        topics: [
          'Interpretação de texto em inglês',
          'Interpretação de texto em espanhol',
        ],
      },
    ],
    extras: [
      'Leitura e compreensão',
      'Gêneros textuais estrangeiros',
      'Vocabulário e expressões',
    ],
  },
  {
    subject: 'Artes',
    stages: [
      {
        title: 'História da arte',
        why: 'As grandes fases da arte e as vanguardas',
        topics: ['História da arte', 'Movimentos artísticos'],
      },
      {
        title: 'Arte brasileira',
        why: 'Do barroco mineiro à arte contemporânea no Brasil',
        topics: ['Arte brasileira'],
      },
      {
        title: 'Música e dança',
        why: 'Ritmos, manifestações populares e o corpo em movimento',
        topics: ['Música e dança'],
      },
      {
        title: 'Teatro e cinema',
        why: 'A linguagem do palco e da tela',
        topics: ['Teatro e cinema'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Educação Física',
    stages: [
      {
        title: 'Esportes',
        why: 'Regras, mídia e o esporte como fenômeno social',
        topics: ['Esportes'],
      },
      {
        title: 'Corpo e saúde',
        why: 'Exercício, saúde e os padrões de corpo',
        topics: ['Atividade física e qualidade de vida', 'Corpo e saúde'],
      },
      {
        title: 'Práticas corporais',
        why: 'Lutas, danças e jogos da cultura brasileira',
        topics: ['Lutas e danças', 'Jogos e brincadeiras'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Biologia',
    stages: [
      {
        title: 'A célula',
        why: 'Do que a vida é feita e como a célula usa energia',
        topics: ['Citologia', 'Bioquímica celular', 'Metabolismo energético'],
      },
      {
        title: 'Ecologia',
        why: 'Seres vivos, ambiente e o caminho da matéria na natureza',
        topics: ['Ecologia', 'Ciclos biogeoquímicos'],
      },
      {
        title: 'Genética e evolução',
        why: 'Herança, DNA, seleção natural e suas aplicações',
        topics: ['Genética', 'Evolução', 'Biotecnologia'],
      },
      {
        title: 'Saúde',
        why: 'Vírus, bactérias, vacinas e a defesa do corpo',
        topics: ['Saúde e doenças', 'Microbiologia', 'Imunologia'],
      },
      {
        title: 'Corpo humano',
        why: 'Como os órgãos trabalham juntos',
        topics: [
          'Fisiologia humana',
          'Sistema circulatório',
          'Sistema digestório',
          'Sistema respiratório',
        ],
      },
      {
        title: 'Controle do corpo',
        why: 'Nervos, hormônios e reprodução',
        topics: ['Sistema nervoso', 'Sistema endócrino', 'Reprodução'],
      },
      {
        title: 'Plantas e animais',
        why: 'A diversidade dos seres vivos e suas adaptações',
        topics: ['Botânica', 'Zoologia'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Física',
    stages: [
      {
        title: 'Movimento',
        why: 'Velocidade, aceleração e gráficos de movimento',
        topics: ['Cinemática'],
      },
      {
        title: 'Forças',
        why: 'Por que as coisas se movem, caem, flutuam ou afundam',
        topics: ['Leis de Newton', 'Gravitação', 'Hidrostática'],
      },
      {
        title: 'Energia',
        why: 'Conservação da energia, potência e colisões',
        topics: [
          'Trabalho e energia',
          'Energia e potência',
          'Impulso e quantidade de movimento',
        ],
      },
      {
        title: 'Calor',
        why: 'Temperatura, trocas de calor e máquinas térmicas',
        topics: ['Termologia', 'Calorimetria', 'Termodinâmica'],
      },
      {
        title: 'Eletricidade',
        why: 'Carga, corrente, resistência e consumo de energia',
        topics: ['Eletrostática', 'Eletrodinâmica', 'Circuitos elétricos'],
      },
      {
        title: 'Ondas e som',
        why: 'Frequência, som e as ondas do dia a dia',
        topics: ['Ondas', 'Acústica'],
      },
      {
        title: 'Luz',
        why: 'Espelhos, lentes e a formação de imagens',
        topics: ['Óptica geométrica'],
      },
      {
        title: 'Magnetismo',
        why: 'Ímãs, campo magnético e geração de energia elétrica',
        topics: ['Magnetismo', 'Eletromagnetismo'],
      },
      {
        title: 'Radiação e física moderna',
        why: 'O núcleo atômico, a radiação e suas aplicações',
        topics: ['Radioatividade', 'Física moderna'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Química',
    stages: [
      {
        title: 'Matéria e misturas',
        why: 'Estados físicos e como separar o que está misturado',
        topics: ['Propriedades da matéria', 'Separação de misturas'],
      },
      {
        title: 'Átomo e tabela periódica',
        why: 'Do que o átomo é feito e como ele se liga a outros',
        topics: ['Estrutura atômica', 'Tabela periódica', 'Ligações químicas'],
      },
      {
        title: 'Funções e reações',
        why: 'Ácidos, bases, sais e óxidos em reação',
        topics: ['Funções inorgânicas', 'Reações químicas'],
      },
      {
        title: 'Cálculos químicos',
        why: 'Quantidades nas reações e concentração das soluções',
        topics: ['Estequiometria', 'Soluções'],
      },
      {
        title: 'Energia e velocidade',
        why: 'O calor das reações e o que as acelera',
        topics: ['Termoquímica', 'Cinética química'],
      },
      {
        title: 'Equilíbrio químico',
        why: 'Reações reversíveis, pH e deslocamento do equilíbrio',
        topics: ['Equilíbrio químico'],
      },
      {
        title: 'Eletroquímica e radioatividade',
        why: 'Pilhas, eletrólise e reações nucleares',
        topics: ['Eletroquímica', 'Radioatividade'],
      },
      {
        title: 'Química orgânica',
        why: 'Cadeias de carbono, funções e isômeros',
        topics: [
          'Química orgânica',
          'Hidrocarbonetos',
          'Funções orgânicas',
          'Isomeria',
        ],
      },
      {
        title: 'Orgânica aplicada',
        why: 'Plásticos, alimentos e as moléculas da vida',
        topics: ['Polímeros', 'Bioquímica'],
      },
    ],
    extras: [],
  },
  {
    subject: 'História',
    stages: [
      {
        title: 'Antiguidade',
        why: 'Grécia, Roma e as ideias de cidadania e democracia',
        topics: ['Antiguidade'],
      },
      {
        title: 'Idade Média',
        why: 'Feudalismo, Igreja e a vida na Europa medieval',
        topics: ['Idade Média'],
      },
      {
        title: 'Mundo moderno e revoluções',
        why: 'Do absolutismo às revoluções que formaram o mundo contemporâneo',
        topics: [
          'Idade Moderna',
          'Iluminismo',
          'Revolução Francesa',
          'Revolução Industrial',
        ],
      },
      {
        title: 'Brasil Colônia e escravidão',
        why: 'A colonização, o tráfico de africanos e a África antes dele',
        topics: [
          'História da África',
          'Brasil Colônia',
          'Escravidão no Brasil',
        ],
      },
      {
        title: 'Independência e Império',
        why: 'Como o Brasil se separou de Portugal e se organizou',
        topics: ['Independência do Brasil', 'Brasil Império'],
      },
      {
        title: 'República Velha',
        why: 'Coronelismo, política do café com leite e revoltas do período',
        topics: ['República Velha'],
      },
      {
        title: 'Era Vargas',
        why: 'Trabalho, indústria e Estado de 1930 a 1945',
        topics: ['Era Vargas'],
      },
      {
        title: 'O século XX no mundo',
        why: 'Guerras mundiais, Guerra Fria e as mudanças do século',
        topics: ['Guerras mundiais', 'Guerra Fria', 'Século XX'],
      },
      {
        title: 'Ditadura e redemocratização',
        why: 'De 1964 à Constituição de 1988 e os movimentos sociais',
        topics: ['Ditadura militar', 'Redemocratização', 'Movimentos sociais'],
      },
    ],
    extras: ['Pré-história'],
  },
  {
    subject: 'Geografia',
    stages: [
      {
        title: 'Cartografia',
        why: 'Mapas, escalas e coordenadas para ler o resto da matéria',
        topics: ['Cartografia'],
      },
      {
        title: 'Natureza',
        why: 'Relevo, clima e águas: a base física do espaço',
        topics: ['Relevo', 'Clima', 'Hidrografia'],
      },
      {
        title: 'Meio ambiente',
        why: 'Impactos ambientais e os biomas brasileiros',
        topics: ['Meio ambiente', 'Biomas'],
      },
      {
        title: 'Campo e energia',
        why: 'A produção no campo e as fontes de energia',
        topics: ['Agricultura', 'Energia'],
      },
      {
        title: 'Cidade e indústria',
        why: 'O crescimento das cidades e da produção industrial',
        topics: ['Urbanização', 'Indústria'],
      },
      {
        title: 'População',
        why: 'Onde as pessoas vivem, como se deslocam e as regiões do Brasil',
        topics: ['População', 'Migrações', 'Regionalização do Brasil'],
      },
      {
        title: 'O mundo conectado',
        why: 'Fluxos globais, conflitos e a ordem mundial',
        topics: ['Globalização', 'Geopolítica'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Sociologia',
    stages: [
      {
        title: 'Cultura',
        why: 'Conceitos de cultura, identidade e cultura de massa',
        topics: ['Cultura', 'Indústria cultural'],
      },
      {
        title: 'Cidadania e Estado',
        why: 'Direitos, deveres e como o poder se organiza',
        topics: ['Cidadania', 'Estado e poder'],
      },
      {
        title: 'Desigualdade e trabalho',
        why: 'Como os sociólogos explicam classes, trabalho e desigualdade',
        topics: ['Desigualdade social', 'Trabalho'],
      },
      {
        title: 'Sociedade em movimento',
        why: 'Movimentos sociais e as mudanças trazidas pela globalização',
        topics: ['Movimentos sociais', 'Globalização e sociedade'],
      },
    ],
    extras: [],
  },
  {
    subject: 'Filosofia',
    stages: [
      {
        title: 'Filosofia antiga',
        why: 'Pré-socráticos, Sócrates, Platão e Aristóteles',
        topics: ['Filosofia antiga'],
      },
      {
        title: 'Medieval e moderna',
        why: 'Fé e razão, Descartes, os empiristas e Kant',
        topics: ['Filosofia medieval', 'Filosofia moderna'],
      },
      {
        title: 'Conhecimento',
        why: 'Como sabemos o que sabemos',
        topics: ['Epistemologia'],
      },
      {
        title: 'Ética',
        why: 'O que é agir bem segundo cada filósofo',
        topics: ['Ética'],
      },
      {
        title: 'Política',
        why: 'Poder, Estado e contrato social nos clássicos',
        topics: ['Política'],
      },
      {
        title: 'Filosofia contemporânea',
        why: 'Nietzsche, existencialismo, Escola de Frankfurt e o belo',
        topics: ['Filosofia contemporânea', 'Estética'],
      },
    ],
    extras: [],
  },
];

/** Matérias sem trilha de assuntos: a Redação é um texto, não questões. */
export const SUBJECTS_WITHOUT_TRACK = ['Redação'];
