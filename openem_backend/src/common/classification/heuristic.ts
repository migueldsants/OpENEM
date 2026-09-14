/**
 * Classificação de matéria/assunto por palavra-chave — sem IA, sem rede.
 *
 * O banco oficial entra com a ÁREA resolvida pela numeração do caderno e o
 * assunto vazio (ver `enem-import/mapping.ts`). Sem assunto, "simulado por
 * tema", revisão espaçada e mapa de calor não têm o que filtrar: das 4 mil
 * questões importadas, só as ~200 de língua estrangeira chegam classificadas.
 *
 * A classificação por IA (`prisma/classify-questions.ts`) resolve isso melhor,
 * mas exige chave de provedor e custa uma chamada por lote. Este módulo é o
 * passe barato e determinístico que roda antes dela: decide o que é óbvio pelo
 * vocabulário e se CALA no resto, deixando `topicId` nulo para a IA.
 *
 * Três regras de projeto, nesta ordem de importância:
 *
 * 1. A busca é restrita à área da questão. Matemática nunca disputa um assunto
 *    com Geografia, o que elimina de saída a maior parte das confusões.
 * 2. Assunto errado é pior que assunto nenhum (contamina revisão, recomendação
 *    e desempenho), então exige-se MARGEM sobre o segundo colocado: empate
 *    entre "Ondas" e "Óptica geométrica" devolve null, não um palpite.
 * 3. Puro e testável: nada de I/O aqui. O runner vive em `prisma/`.
 */

/** Pontos de um termo decisivo — um só já basta para liderar. */
const PESO_FORTE = 3;
/** Pontos de um termo de apoio: dois ou três juntos valem um forte. */
const PESO_APOIO = 1;

/** Pontuação mínima do vencedor para a decisão ser considerada. */
export const MIN_SCORE = 3;
/** Vantagem mínima sobre o 2º colocado de OUTRO assunto. */
export const MIN_MARGIN = 2;

export interface TopicRule {
  /** Área do conhecimento (nome exato da TAXONOMY do seed). */
  area: string;
  subject: string;
  topic: string;
  /** Termos decisivos do assunto. `*` no fim casa por prefixo. */
  strong?: string[];
  /** Termos que só contam em conjunto. */
  weak?: string[];
}

export interface HeuristicDecision {
  subject: string;
  topic: string;
  /** Soma dos pesos dos termos encontrados. */
  score: number;
  /** Vantagem sobre o melhor assunto concorrente. */
  margin: number;
  /** 0.6..0.9 — cresce com a margem. Nunca chega a 1: é heurística. */
  confidence: number;
  /** Termos que decidiram, para auditar a regra no log do runner. */
  matched: string[];
}

const HUMANAS = 'Ciências Humanas e suas Tecnologias';
const NATUREZA = 'Ciências da Natureza e suas Tecnologias';
const LINGUAGENS = 'Linguagens, Códigos e suas Tecnologias';
const MATEMATICA = 'Matemática e suas Tecnologias';

/**
 * Catálogo de regras. Todo `topic` precisa existir na TAXONOMY do seed com a
 * mesma grafia — o runner resolve por (matéria, assunto) e reporta o que não
 * encontrar.
 */
export const RULES: TopicRule[] = [
  // ---------------- Matemática ----------------
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Probabilidade',
    strong: ['probabilidade', 'chance de', 'ao acaso', 'aleatoriamente'],
    weak: ['sorteio', 'sorteado', 'sorteada', 'dado honesto', 'moeda'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Análise combinatória',
    strong: [
      'analise combinatoria',
      'permutac*',
      'anagrama*',
      'de quantas maneiras',
      'de quantas formas',
      'quantos codigos',
    ],
    weak: ['combinac*', 'arranjo*', 'fatorial', 'possibilidades distintas'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Porcentagem',
    strong: ['porcentagem', 'por cento', 'percentual'],
    weak: ['desconto', 'aumento de', 'reajuste', 'acrescimo'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Juros simples e compostos',
    strong: [
      'juros',
      'juro',
      'montante',
      'taxa mensal',
      'financiamento',
      'capital inicial',
    ],
    weak: ['parcela*', 'emprestimo', 'aplicacao financeira', 'rendimento'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Média, mediana e moda',
    strong: ['mediana', 'media aritmetica', 'media ponderada', 'moda dos'],
    weak: ['media', 'desvio padrao', 'amostra'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Estatística',
    strong: ['desvio padrao', 'frequencia relativa', 'histograma', 'amostral'],
    weak: ['pesquisa', 'amostra', 'dados coletados', 'censo', 'estatistic*'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Interpretação de gráficos',
    strong: [
      'grafico de barras',
      'grafico de setores',
      'grafico de linhas',
      'no grafico',
    ],
    weak: ['grafico', 'eixo', 'tabela', 'infografico'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Geometria plana',
    strong: [
      'teorema de pitagoras',
      'perimetro',
      'circunferencia',
      'poligono*',
      'angulo interno',
    ],
    weak: [
      'triangulo',
      'quadrado',
      'retangulo',
      'hipotenusa',
      'diagonal',
      'area',
    ],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Geometria espacial',
    strong: [
      'geometria espacial',
      'paralelepipedo',
      'cilindro',
      'tronco de cone',
      'piramide',
      'prisma',
      'esfera',
    ],
    weak: ['volume', 'aresta', 'base do solido', 'altura do solido', 'cone'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Volumes',
    strong: ['capacidade do reservatorio', 'volume em litros'],
    weak: ['litro*', 'mililitro*', 'metros cubicos', 'reservatorio', 'tanque'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Áreas e perímetros',
    strong: ['area a ser', 'area total da', 'metros quadrados'],
    weak: ['area', 'terreno', 'piso', 'revestimento', 'cerca'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Trigonometria',
    strong: [
      'trigonometri*',
      'seno',
      'cosseno',
      'tangente do angulo',
      'radiano*',
    ],
    weak: ['angulo de elevacao', 'cateto', 'hipotenusa'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Funções',
    strong: ['funcao f', 'f(x)', 'lei de formacao', 'dominio da funcao'],
    weak: ['funcao', 'variavel', 'grandeza'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Função afim',
    strong: ['funcao afim', 'funcao do primeiro grau', 'funcao do 1º grau'],
    weak: ['reta', 'coeficiente angular', 'taxa constante'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Função quadrática',
    strong: [
      'funcao quadratica',
      'funcao do segundo grau',
      'parabola',
      'vertice da parabola',
    ],
    weak: ['valor maximo', 'valor minimo', 'concavidade'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Função exponencial',
    strong: ['funcao exponencial', 'crescimento exponencial', 'decaimento'],
    weak: ['dobra a cada', 'potencia de 2', 'meia-vida'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Função logarítmica',
    strong: ['logaritmo', 'log10', 'escala logaritmica', 'funcao logaritmica'],
    weak: ['decibel', 'ph da', 'richter'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Progressão aritmética',
    strong: ['progressao aritmetica', 'razao da progressao'],
    weak: ['sequencia', 'termo geral', 'primeiro termo'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Progressão geométrica',
    strong: ['progressao geometrica'],
    weak: ['sequencia', 'razao', 'termo geral', 'soma dos termos'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Regra de três',
    strong: ['regra de tres', 'diretamente proporcional'],
    weak: ['proporcional', 'para cada', 'rendimento por'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Razão e proporção',
    strong: ['razao entre', 'proporcao entre', 'escala de 1:'],
    weak: ['proporc*', 'razao', 'escala'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Geometria analítica',
    strong: [
      'plano cartesiano',
      'geometria analitica',
      'equacao da reta',
      'coordenadas do ponto',
    ],
    weak: ['abscissa', 'ordenada', 'distancia entre os pontos'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Matrizes e determinantes',
    strong: ['matriz', 'determinante da'],
    weak: ['linhas e colunas', 'elemento aij'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Polinômios',
    strong: ['polinomio*'],
    weak: ['raizes', 'grau do polinomio'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Números complexos',
    strong: ['numero complexo', 'numeros complexos', 'unidade imaginaria'],
    weak: ['parte real', 'parte imaginaria'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Sistemas de equações',
    strong: ['sistema de equacoes', 'sistema linear'],
    weak: ['duas incognitas', 'substituicao', 'escalonamento'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Equações do 2º grau',
    strong: ['equacao do segundo grau', 'equacao do 2º grau', 'discriminante'],
    weak: ['delta', 'duas raizes', 'bhaskara'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Equações do 1º grau',
    strong: ['equacao do primeiro grau', 'equacao do 1º grau'],
    weak: ['incognita', 'valor de x'],
  },
  {
    area: MATEMATICA,
    subject: 'Matemática',
    topic: 'Conjuntos numéricos',
    strong: ['conjunto dos numeros', 'numeros irracionais', 'diagrama de venn'],
    weak: ['conjunto', 'interseccao', 'uniao dos conjuntos'],
  },

  // ---------------- Biologia ----------------
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Genética',
    strong: [
      'dna',
      'gene*',
      'alelo*',
      'cromossom*',
      'genotipo',
      'fenotipo',
      'mendel',
      'hereditari*',
    ],
    weak: ['mutacao', 'heredograma', 'dominante', 'recessiv*', 'rna'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Ecologia',
    strong: [
      'ecossistema*',
      'cadeia alimentar',
      'teia alimentar',
      'biodiversidade',
      'nicho ecologico',
      'sucessao ecologica',
    ],
    weak: ['especie*', 'habitat', 'populacoes', 'predador', 'ambiente'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Ciclos biogeoquímicos',
    strong: [
      'ciclo do carbono',
      'ciclo do nitrogenio',
      'ciclo da agua',
      'ciclo biogeoquimico',
    ],
    weak: ['decompositores', 'fixacao', 'nitrificacao'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Citologia',
    strong: [
      'membrana plasmatica',
      'organela*',
      'mitocondria*',
      'ribossomo*',
      'citoplasma',
      'nucleo da celula',
    ],
    weak: ['celula*', 'mitose', 'meiose', 'parede celular'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Evolução',
    strong: [
      'selecao natural',
      'darwin',
      'evolucao das especies',
      'especiacao',
      'lamarck',
    ],
    weak: ['adaptacao', 'ancestral comum', 'fossil*'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Metabolismo energético',
    strong: ['respiracao celular', 'fermentacao', 'glicolise', 'atp'],
    weak: ['glicose', 'energia da celula', 'mitocondria'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Botânica',
    strong: [
      'fotossintese',
      'angiosperma*',
      'gimnosperma*',
      'xilema',
      'floema',
    ],
    weak: ['planta*', 'raiz', 'folha*', 'caule', 'semente*', 'vegetal'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Zoologia',
    strong: ['vertebrado*', 'invertebrado*', 'artropode*', 'anfibio*'],
    weak: ['animal', 'animais', 'inseto*', 'mamifero*', 'ave*', 'reptil'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Microbiologia',
    strong: ['bacteria*', 'virus', 'fungo*', 'protozoario*', 'microrganismo*'],
    weak: ['antibiotico', 'infeccao', 'cultura de'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Imunologia',
    strong: ['anticorpo*', 'antigeno*', 'linfocito*', 'vacina*', 'imunidade'],
    weak: ['sistema imune', 'soro', 'defesa do organismo'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Saúde e doenças',
    strong: ['epidemia', 'pandemia', 'transmissao da doenca', 'sintoma*'],
    weak: ['doenca*', 'saude', 'tratamento', 'contagio', 'mosquito'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Sistema circulatório',
    strong: ['sangue', 'coracao', 'arteria*', 'veia*', 'hemoglobina'],
    weak: ['circulacao', 'pressao arterial', 'plaqueta*'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Sistema digestório',
    strong: ['estomago', 'intestino', 'digestao', 'enzima digestiva', 'bile'],
    weak: ['alimento*', 'absorcao de nutrientes', 'figado'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Sistema nervoso',
    strong: ['neuronio*', 'sinapse*', 'sistema nervoso', 'cerebro'],
    weak: ['impulso nervoso', 'medula', 'neurotransmissor'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Sistema respiratório',
    strong: ['pulmao', 'pulmoes', 'alveolo*', 'sistema respiratorio'],
    weak: ['respiracao', 'oxigenio', 'diafragma'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Sistema endócrino',
    strong: ['hormonio*', 'glandula*', 'insulina', 'tireoide'],
    weak: ['hipofise', 'adrenalina', 'metabolismo basal'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Reprodução',
    strong: [
      'reproducao',
      'gameta*',
      'fecundacao',
      'espermatozoide*',
      'ovulo*',
    ],
    weak: ['gravidez', 'embriao', 'gestacao'],
  },
  {
    area: NATUREZA,
    subject: 'Biologia',
    topic: 'Biotecnologia',
    strong: [
      'transgenic*',
      'clonagem',
      'engenharia genetica',
      'organismo geneticamente modificado',
      'pcr',
    ],
    weak: ['biotecnologia', 'celula-tronco', 'crispr'],
  },

  // ---------------- Física ----------------
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Cinemática',
    strong: [
      'velocidade media',
      'movimento uniforme',
      'aceleracao',
      'km/h',
      'm/s',
    ],
    weak: ['velocidade', 'deslocamento', 'trajetoria', 'tempo de percurso'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Leis de Newton',
    strong: ['forca resultante', 'leis de newton', 'inercia', 'atrito'],
    weak: ['forca', 'massa do corpo', 'newton', 'plano inclinado'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Trabalho e energia',
    strong: [
      'energia cinetica',
      'energia potencial',
      'trabalho realizado',
      'conservacao da energia',
    ],
    weak: ['joule*', 'energia mecanica', 'altura'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Energia e potência',
    strong: ['potencia eletrica', 'quilowatt', 'kwh', 'rendimento'],
    weak: ['potencia', 'watt*', 'consumo de energia', 'eficiencia'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Eletrodinâmica',
    strong: ['corrente eletrica', 'lei de ohm', 'diferenca de potencial'],
    weak: ['volt*', 'ampere*', 'resistencia eletrica', 'tensao'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Circuitos elétricos',
    strong: [
      'circuito eletrico',
      'resistor*',
      'associacao em serie',
      'associacao em paralelo',
    ],
    weak: ['lampada*', 'interruptor', 'fusivel', 'bateria'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Eletrostática',
    strong: [
      'carga eletrica',
      'campo eletrico',
      'eletrizacao',
      'lei de coulomb',
    ],
    weak: ['eletron*', 'atrito eletrico', 'isolante', 'condutor'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Magnetismo',
    strong: ['campo magnetico', 'ima*', 'polo magnetico'],
    weak: ['bussola', 'magnetismo', 'ferro'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Eletromagnetismo',
    strong: [
      'inducao eletromagnetica',
      'transformador',
      'bobina',
      'lei de faraday',
    ],
    weak: ['espira', 'fluxo magnetico', 'gerador'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Ondas',
    strong: [
      'comprimento de onda',
      'frequencia da onda',
      'onda eletromagnetica',
      'hertz',
    ],
    weak: ['onda*', 'amplitude', 'periodo', 'propagacao'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Acústica',
    strong: ['onda sonora', 'decibel*', 'ultrassom', 'intensidade sonora'],
    weak: ['som', 'ruido', 'eco', 'timbre'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Óptica geométrica',
    strong: ['espelho*', 'lente*', 'indice de refracao', 'raio de luz'],
    weak: ['luz', 'reflexao', 'refracao', 'imagem formada', 'foco'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Calorimetria',
    strong: ['calor especifico', 'quantidade de calor', 'equilibrio termico'],
    weak: ['caloria*', 'temperatura', 'aquecimento', 'calor'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Termologia',
    strong: ['dilatacao termica', 'escala celsius', 'escala kelvin'],
    weak: ['temperatura', 'termometro', 'condutividade termica'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Termodinâmica',
    strong: [
      'maquina termica',
      'primeira lei da termodinamica',
      'ciclo de carnot',
      'entropia',
      'gas ideal',
    ],
    weak: ['trabalho do gas', 'pressao e volume', 'motor'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Hidrostática',
    strong: ['empuxo', 'principio de arquimedes', 'pressao hidrostatica'],
    weak: ['densidade', 'fluido', 'flutua', 'submerso'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Gravitação',
    strong: [
      'campo gravitacional',
      'leis de kepler',
      'orbita',
      'satelite',
      'gravitacao',
    ],
    weak: ['planeta*', 'lua', 'forca gravitacional'],
  },
  {
    area: NATUREZA,
    subject: 'Física',
    topic: 'Física moderna',
    strong: [
      'efeito fotoeletrico',
      'fisica quantica',
      'relatividade',
      'foton*',
    ],
    weak: ['quantum', 'dualidade', 'planck'],
  },

  // ---------------- Química ----------------
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Estequiometria',
    strong: ['mol', 'mols', 'massa molar', 'g/mol', 'estequiometri*'],
    weak: ['rendimento da reacao', 'reagente limitante', 'numero de avogadro'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Reações químicas',
    strong: ['reacao quimica', 'equacao quimica', 'balanceamento'],
    weak: ['reagente*', 'produto da reacao', 'sintese', 'decomposicao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Química orgânica',
    strong: ['cadeia carbonica', 'composto organico', 'quimica organica'],
    weak: ['carbono', 'molecula organica', 'radical'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Funções orgânicas',
    strong: [
      'alcool',
      'aldeido*',
      'cetona*',
      'acido carboxilico',
      'ester*',
      'amina*',
      'amida*',
    ],
    weak: ['grupo funcional', 'hidroxila', 'carbonila'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Hidrocarbonetos',
    strong: ['hidrocarboneto*', 'alcano*', 'alceno*', 'alcino*', 'benzeno'],
    weak: ['petroleo', 'gasolina', 'metano', 'etano'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Isomeria',
    strong: ['isomeri*', 'isomero*', 'enantiomero*'],
    weak: ['cis', 'trans', 'quiral'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Polímeros',
    strong: ['polimero*', 'monomero*', 'polimerizacao', 'polietileno', 'pvc'],
    weak: ['plastico*', 'borracha', 'nylon'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Soluções',
    strong: ['concentracao da solucao', 'soluto', 'solvente', 'molaridade'],
    weak: ['solucao', 'diluicao', 'solubilidade', 'mol/l'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Equilíbrio químico',
    strong: [
      'equilibrio quimico',
      'constante de equilibrio',
      'principio de le chatelier',
    ],
    weak: ['deslocamento do equilibrio', 'reacao reversivel', 'kc'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Cinética química',
    strong: ['velocidade da reacao', 'catalisador', 'energia de ativacao'],
    weak: ['cinetica', 'colisao eficaz', 'taxa de reacao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Eletroquímica',
    strong: ['pilha', 'eletrolise', 'potencial de reducao', 'nox'],
    weak: ['oxidacao', 'reducao', 'anodo', 'catodo', 'corrosao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Termoquímica',
    strong: ['entalpia', 'exotermic*', 'endotermic*', 'termoquimic*'],
    weak: ['variacao de energia', 'calor liberado', 'combustao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Tabela periódica',
    strong: ['tabela periodica', 'metais alcalinos', 'gases nobres'],
    weak: ['elemento quimico', 'grupo', 'periodo', 'eletronegatividade'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Estrutura atômica',
    strong: [
      'numero atomico',
      'proton*',
      'neutron*',
      'modelo atomico',
      'isotopo*',
    ],
    weak: ['atomo*', 'eletron*', 'camada de valencia', 'nucleo'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Ligações químicas',
    strong: [
      'ligacao ionica',
      'ligacao covalente',
      'ligacao metalica',
      'ligacao de hidrogenio',
    ],
    weak: ['polaridade', 'geometria molecular', 'forcas intermoleculares'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Funções inorgânicas',
    strong: ['acido cloridrico', 'hidroxido', 'oxido*', 'sal de cozinha'],
    weak: ['acido', 'base', 'sal', 'ph', 'neutralizacao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Separação de misturas',
    strong: [
      'destilacao',
      'filtracao',
      'decantacao',
      'centrifugacao',
      'cromatografia',
    ],
    weak: ['mistura heterogenea', 'mistura homogenea', 'peneiracao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Propriedades da matéria',
    strong: ['ponto de fusao', 'ponto de ebulicao', 'estados fisicos'],
    weak: ['densidade', 'solido', 'liquido', 'gasoso', 'sublimacao'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Radioatividade',
    strong: ['radioativ*', 'meia-vida', 'decaimento radioativo', 'radiacao'],
    weak: ['isotopo*', 'urani*', 'cesio', 'fissao nuclear'],
  },
  {
    area: NATUREZA,
    subject: 'Química',
    topic: 'Bioquímica',
    strong: ['aminoacido*', 'proteina*', 'carboidrato*', 'lipidio*', 'enzima*'],
    weak: ['glicose', 'metabolismo', 'vitamina*'],
  },

  // ---------------- História ----------------
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Brasil Colônia',
    strong: [
      'periodo colonial',
      'capitania*',
      'sesmaria*',
      'brasil colonia',
      'pau-brasil',
      'bandeirante*',
    ],
    weak: ['jesuita*', 'engenho', 'metropole portuguesa', 'colonizacao'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Escravidão no Brasil',
    strong: [
      'escravidao',
      'escraviza*',
      'trafico negreiro',
      'quilombo*',
      'lei aurea',
      'abolicao',
    ],
    weak: ['senzala', 'cativeiro', 'africanos', 'liberto*'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Independência do Brasil',
    strong: ['independencia do brasil', 'grito do ipiranga', '1822'],
    weak: ['d. pedro i', 'corte portuguesa', 'emancipacao politica'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Brasil Império',
    strong: ['brasil imperio', 'periodo regencial', 'segundo reinado'],
    weak: ['d. pedro ii', 'imperio', 'monarquia brasileira'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'República Velha',
    strong: [
      'republica velha',
      'coronelismo',
      'politica do cafe com leite',
      'canudos',
      'revolta da vacina',
    ],
    weak: ['primeira republica', 'voto de cabresto', 'oligarqui*'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Era Vargas',
    strong: ['getulio vargas', 'estado novo', 'era vargas'],
    weak: ['1930', 'clt', 'trabalhismo', 'queremismo'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Ditadura militar',
    strong: [
      'ditadura militar',
      'regime militar',
      'ai-5',
      'golpe de 1964',
      'anos de chumbo',
    ],
    weak: ['censura', 'tortura', 'exilio', 'milico'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Redemocratização',
    strong: [
      'diretas ja',
      'constituicao de 1988',
      'redemocratizacao',
      'lei da anistia',
    ],
    weak: ['nova republica', 'constituinte', 'eleicoes livres'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Revolução Francesa',
    strong: ['revolucao francesa', 'queda da bastilha', 'jacobino*'],
    weak: ['1789', 'robespierre', 'terceiro estado'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Revolução Industrial',
    strong: ['revolucao industrial', 'maquina a vapor', 'ludita*'],
    weak: ['fabrica*', 'operari*', 'manufatura', 'taylorismo'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Guerra Fria',
    strong: ['guerra fria', 'uniao sovietica', 'muro de berlim', 'urss'],
    weak: ['otan', 'socialismo real', 'corrida armamentista', 'capitalismo'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Guerras mundiais',
    strong: [
      'primeira guerra mundial',
      'segunda guerra mundial',
      'nazismo',
      'holocausto',
    ],
    weak: ['hitler', 'trincheira*', 'tratado de versalhes', 'fascismo'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Antiguidade',
    strong: [
      'roma antiga',
      'grecia antiga',
      'antigo egito',
      'mesopotamia',
      'polis',
    ],
    weak: ['imperio romano', 'faraó', 'hierogl*', 'cidade-estado'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Idade Média',
    strong: ['idade media', 'feudalismo', 'feudal', 'cruzada*'],
    weak: ['servo*', 'senhor feudal', 'igreja medieval', 'vassalagem'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Idade Moderna',
    strong: [
      'absolutismo',
      'mercantilismo',
      'grandes navegacoes',
      'reforma protestante',
      'renascimento',
    ],
    weak: ['contrarreforma', 'luis xiv', 'expansao maritima'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'Iluminismo',
    strong: ['iluminismo', 'iluminista*'],
    weak: ['voltaire', 'montesquieu', 'enciclopedia', 'razao'],
  },
  {
    area: HUMANAS,
    subject: 'História',
    topic: 'História da África',
    strong: [
      'historia da africa',
      'reino do congo',
      'apartheid',
      'descolonizacao da africa',
    ],
    weak: ['africa', 'mali', 'etiopia', 'suazi'],
  },

  // ---------------- Geografia ----------------
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Meio ambiente',
    strong: [
      'desmatamento',
      'aquecimento global',
      'efeito estufa',
      'sustentabilidade',
      'licenciamento ambiental',
    ],
    weak: ['poluicao', 'residuo*', 'impacto ambiental', 'preservacao'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Urbanização',
    strong: [
      'urbanizacao',
      'metropole*',
      'favela*',
      'mobilidade urbana',
      'periferia',
      'conurbacao',
    ],
    weak: ['cidade*', 'urbano', 'especulacao imobiliaria', 'saneamento'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Agricultura',
    strong: [
      'agronegocio',
      'agricultura familiar',
      'monocultura',
      'reforma agraria',
      'agropecuaria',
    ],
    weak: ['agricultura', 'plantio', 'safra', 'latifundio', 'agrotoxico*'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Biomas',
    strong: [
      'bioma*',
      'cerrado',
      'caatinga',
      'mata atlantica',
      'pantanal',
      'amazonia',
      'pampa*',
    ],
    weak: ['vegetacao', 'fitofisionomia', 'savana'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Clima',
    strong: [
      'el nino',
      'massas de ar',
      'zona climatica',
      'climograma',
      'precipitacao pluviometrica',
    ],
    weak: ['clima', 'chuva*', 'temperatura media', 'umidade'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Energia',
    strong: [
      'matriz energetica',
      'usina hidreletrica',
      'energia eolica',
      'energia solar',
      'biocombustivel',
    ],
    weak: ['petroleo', 'energia', 'termeletrica', 'etanol'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Geopolítica',
    strong: [
      'geopolitica',
      'bloco economico',
      'mercosul',
      'uniao europeia',
      'oriente medio',
      'conflito territorial',
    ],
    weak: ['fronteira*', 'onu', 'soberania', 'territorio disputado'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Globalização',
    strong: ['globalizacao', 'empresas multinacionais', 'divisao do trabalho'],
    weak: ['fluxo*', 'mercado mundial', 'capital financeiro'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Indústria',
    strong: [
      'industrializacao',
      'parque industrial',
      'desconcentracao industrial',
    ],
    weak: ['industria*', 'fabrica*', 'polo industrial'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'População',
    strong: [
      'piramide etaria',
      'taxa de natalidade',
      'transicao demografica',
      'censo demografico',
      'envelhecimento da populacao',
    ],
    weak: ['populacao', 'demografi*', 'mortalidade', 'ibge'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Regionalização do Brasil',
    strong: [
      'regiao nordeste',
      'regiao sudeste',
      'regiao centro-oeste',
      'regiao norte do brasil',
      'complexo regional',
    ],
    weak: ['regiao', 'sertao', 'semiarido', 'regionalizacao'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Cartografia',
    strong: [
      'cartografi*',
      'projecao cartografica',
      'escala do mapa',
      'coordenadas geograficas',
      'fuso horario',
    ],
    weak: ['mapa', 'latitude', 'longitude', 'legenda do mapa'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Hidrografia',
    strong: ['bacia hidrografica', 'aquifero', 'recursos hidricos'],
    weak: ['rio*', 'agua', 'nascente', 'foz'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Migrações',
    strong: ['migracao', 'migrante*', 'refugiado*', 'exodo rural', 'imigra*'],
    weak: ['deslocamento populacional', 'emigra*', 'diaspora'],
  },
  {
    area: HUMANAS,
    subject: 'Geografia',
    topic: 'Relevo',
    strong: ['relevo', 'planalto*', 'planicie*', 'depressao relativa'],
    weak: ['erosao', 'intemperismo', 'solo', 'serra'],
  },

  // ---------------- Sociologia ----------------
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Desigualdade social',
    strong: [
      'desigualdade social',
      'concentracao de renda',
      'exclusao social',
      'pobreza',
    ],
    weak: ['classe social', 'renda', 'vulnerabilidade'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Cidadania',
    strong: ['cidadania', 'direitos civis', 'direitos humanos', 'democracia'],
    weak: ['cidadao*', 'participacao politica', 'voto'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Cultura',
    strong: ['identidade cultural', 'diversidade cultural', 'etnocentrismo'],
    weak: ['cultura', 'tradicao', 'costume*', 'etnia'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Trabalho',
    strong: [
      'mundo do trabalho',
      'precarizacao',
      'sindicato*',
      'divisao social do trabalho',
      'desemprego',
    ],
    weak: ['trabalhador*', 'emprego', 'salario', 'jornada'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Movimentos sociais',
    strong: [
      'movimento social',
      'movimentos sociais',
      'feminismo',
      'movimento negro',
      'mst',
    ],
    weak: ['mobilizacao', 'protesto*', 'reivindicacao', 'militancia'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Estado e poder',
    strong: [
      'weber',
      'burocracia',
      'monopolio da violencia',
      'aparelho estatal',
    ],
    weak: ['estado', 'poder', 'autoridade', 'dominacao'],
  },
  {
    area: HUMANAS,
    subject: 'Sociologia',
    topic: 'Indústria cultural',
    strong: ['industria cultural', 'cultura de massa', 'adorno'],
    weak: ['midia', 'consumo', 'publicidade', 'entretenimento'],
  },

  // ---------------- Filosofia ----------------
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Política',
    strong: [
      'contrato social',
      'hobbes',
      'locke',
      'rousseau',
      'maquiavel',
      'estado de natureza',
    ],
    weak: ['soberania', 'poder politico', 'legitimidade'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Ética',
    strong: ['imperativo categorico', 'etica', 'virtude', 'eudaimonia'],
    weak: ['moral', 'dever', 'bem', 'liberdade'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Epistemologia',
    strong: [
      'teoria do conhecimento',
      'empirismo',
      'racionalismo',
      'metodo cientifico',
      'ceticismo',
    ],
    weak: ['conhecimento', 'verdade', 'razao', 'experiencia'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Filosofia antiga',
    strong: ['socrates', 'platao', 'aristoteles', 'sofista*', 'maieutica'],
    weak: ['caverna', 'filosofia grega', 'logos'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Filosofia moderna',
    strong: ['descartes', 'kant', 'hume', 'spinoza', 'cogito'],
    weak: ['sujeito', 'duvida metodica', 'criticismo'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Filosofia contemporânea',
    strong: [
      'nietzsche',
      'sartre',
      'foucault',
      'escola de frankfurt',
      'existencialismo',
    ],
    weak: ['alienacao', 'niilismo', 'biopoder', 'pos-moderno'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Filosofia medieval',
    strong: ['santo agostinho', 'tomas de aquino', 'escolastica', 'patristica'],
    weak: ['fe e razao', 'deus', 'teologia'],
  },
  {
    area: HUMANAS,
    subject: 'Filosofia',
    topic: 'Estética',
    strong: ['estetica', 'juizo de gosto', 'belo'],
    weak: ['arte', 'beleza', 'sublime'],
  },

  // ---------------- Língua Portuguesa ----------------
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Variação linguística',
    strong: [
      'variacao linguistica',
      'norma culta',
      'norma-padrao',
      'dialeto*',
      'regionalismo',
      'preconceito linguistico',
    ],
    weak: ['giria*', 'fala', 'oralidade', 'sotaque'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Figuras de linguagem',
    strong: [
      'figura de linguagem',
      'metafora',
      'metonimia',
      'hiperbole',
      'personificacao',
      'antitese',
      'eufemismo',
    ],
    weak: ['ironia', 'sentido figurado', 'comparacao'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Funções da linguagem',
    strong: [
      'funcao referencial',
      'funcao emotiva',
      'funcao apelativa',
      'funcao metalinguistica',
      'funcao fatica',
      'funcao poetica',
      'metalinguagem',
    ],
    weak: ['funcao da linguagem', 'emissor', 'destinatario'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Coesão e coerência',
    strong: ['coesao', 'coerencia', 'elemento coesivo', 'anafora'],
    weak: ['conectivo*', 'referente', 'retomada', 'pronome'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Sintaxe',
    strong: [
      'oracao subordinada',
      'oracao coordenada',
      'sujeito e predicado',
      'verbo transitivo',
      'adjunto adverbial',
    ],
    weak: ['oracao', 'sujeito', 'predicado', 'complemento'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Morfologia',
    strong: [
      'classe gramatical',
      'prefixo',
      'sufixo',
      'derivacao',
      'substantivo',
      'adjetivo',
    ],
    weak: ['morfologi*', 'radical', 'flexao'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Semântica',
    strong: ['polissemia', 'sinonimo*', 'antonimo*', 'ambiguidade'],
    weak: ['sentido', 'significado', 'conotacao', 'denotacao'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Intertextualidade',
    strong: ['intertextualidade', 'parodia', 'parafrase', 'intertextual'],
    weak: ['citacao', 'alusao', 'dialogo entre textos'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Gêneros textuais',
    strong: [
      'genero textual',
      'cronica',
      'reportagem',
      'charge',
      'tirinha',
      'anuncio publicitario',
      'carta do leitor',
    ],
    weak: ['texto publicitario', 'manchete', 'editorial', 'cartaz'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Tipologia textual',
    strong: [
      'texto dissertativo',
      'texto narrativo',
      'texto descritivo',
      'texto injuntivo',
      'tipologia textual',
    ],
    weak: ['narrador', 'argumentacao', 'descricao'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Concordância',
    strong: ['concordancia verbal', 'concordancia nominal'],
    weak: ['concordancia', 'plural', 'sujeito composto'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Regência',
    strong: ['regencia verbal', 'regencia nominal'],
    weak: ['preposicao', 'complemento verbal'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Pontuação',
    strong: ['pontuacao', 'virgula', 'ponto e virgula', 'dois-pontos'],
    weak: ['travessao', 'reticencias', 'aspas'],
  },
  {
    area: LINGUAGENS,
    subject: 'Língua Portuguesa',
    topic: 'Ortografia',
    strong: ['ortografi*', 'acentuacao', 'grafia correta'],
    weak: ['acento', 'hifen', 'escrita das palavras'],
  },

  // ---------------- Literatura ----------------
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Modernismo',
    strong: [
      'modernismo',
      'semana de arte moderna',
      'mario de andrade',
      'oswald de andrade',
      'macunaima',
      'antropofagi*',
      'drummond',
    ],
    weak: ['vanguarda*', 'manifesto', 'geracao de 30'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Realismo e Naturalismo',
    strong: [
      'machado de assis',
      'aluisio azevedo',
      'realismo',
      'naturalismo',
      'dom casmurro',
      'o cortico',
    ],
    weak: ['determinismo', 'critica social', 'narrador ironico'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Romantismo',
    strong: [
      'romantismo',
      'jose de alencar',
      'castro alves',
      'goncalves dias',
      'iracema',
      'indianismo',
    ],
    weak: ['idealizacao', 'nacionalismo literario', 'sentimentalismo'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Arcadismo',
    strong: ['arcadismo', 'marilia de dirceu', 'tomas antonio gonzaga'],
    weak: ['bucolismo', 'pastoril', 'arcade'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Barroco',
    strong: ['barroco', 'gregorio de matos', 'padre antonio vieira'],
    weak: ['cultismo', 'conceptismo', 'antitese religiosa'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Parnasianismo e Simbolismo',
    strong: ['parnasianismo', 'simbolismo', 'olavo bilac', 'cruz e sousa'],
    weak: ['soneto', 'arte pela arte', 'sinestesia'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Literatura contemporânea',
    strong: [
      'literatura contemporanea',
      'ferreira gullar',
      'manoel de barros',
      'conceicao evaristo',
    ],
    weak: ['poesia marginal', 'autor contemporaneo'],
  },
  {
    area: LINGUAGENS,
    subject: 'Literatura',
    topic: 'Quinhentismo',
    strong: ['quinhentismo', 'pero vaz de caminha', 'jose de anchieta'],
    weak: ['literatura de informacao', 'carta ao rei'],
  },

  // ---------------- Artes ----------------
  {
    area: LINGUAGENS,
    subject: 'Artes',
    topic: 'Movimentos artísticos',
    strong: [
      'cubismo',
      'impressionismo',
      'surrealismo',
      'expressionismo',
      'dadaismo',
      'arte abstrata',
    ],
    weak: ['vanguarda*', 'movimento artistico', 'estilo'],
  },
  {
    area: LINGUAGENS,
    subject: 'Artes',
    topic: 'Arte brasileira',
    strong: [
      'tarsila do amaral',
      'portinari',
      'arte indigena',
      'aleijadinho',
      'grafite brasileiro',
    ],
    weak: ['arte brasileira', 'artesanato', 'arte popular'],
  },
  {
    area: LINGUAGENS,
    subject: 'Artes',
    topic: 'História da arte',
    strong: ['historia da arte', 'renascimento artistico', 'arte classica'],
    weak: ['pintura', 'escultura', 'obra de arte', 'museu'],
  },
  {
    area: LINGUAGENS,
    subject: 'Artes',
    topic: 'Música e dança',
    // "cancao" fica no apoio: letra de música aparece muito em questão de
    // interpretação de texto, que é Língua Portuguesa e não Artes.
    strong: ['ritmo musical', 'maracatu', 'coreografia', 'partitura'],
    weak: [
      'musica',
      'danca',
      'instrumento musical',
      'melodia',
      'cancao',
      'samba',
    ],
  },
  {
    area: LINGUAGENS,
    subject: 'Artes',
    topic: 'Teatro e cinema',
    strong: ['teatro', 'dramaturgia', 'cinema', 'cinematografi*'],
    weak: ['peca', 'palco', 'filme', 'ator', 'cena'],
  },

  // ---------------- Educação Física ----------------
  {
    area: LINGUAGENS,
    subject: 'Educação Física',
    topic: 'Esportes',
    strong: [
      'futebol',
      'voleibol',
      'basquete',
      'atletismo',
      'jogos olimpicos',
      'handebol',
    ],
    weak: ['esporte*', 'atleta*', 'competicao', 'treinamento'],
  },
  {
    area: LINGUAGENS,
    subject: 'Educação Física',
    topic: 'Atividade física e qualidade de vida',
    strong: ['atividade fisica', 'sedentarismo', 'qualidade de vida'],
    weak: ['exercicio*', 'saude', 'bem-estar', 'caminhada'],
  },
  {
    area: LINGUAGENS,
    subject: 'Educação Física',
    topic: 'Corpo e saúde',
    strong: ['imc', 'indice de massa corporal', 'obesidade'],
    weak: ['corpo', 'alimentacao', 'postura', 'padrao de beleza'],
  },
  {
    area: LINGUAGENS,
    subject: 'Educação Física',
    topic: 'Lutas e danças',
    strong: ['capoeira', 'judo', 'karate', 'luta olimpica'],
    weak: ['luta*', 'danca*', 'roda'],
  },
  {
    area: LINGUAGENS,
    subject: 'Educação Física',
    topic: 'Jogos e brincadeiras',
    strong: ['brincadeira*', 'jogos populares', 'recreacao'],
    weak: ['jogo*', 'brincar', 'ludico'],
  },
];

/**
 * Texto comparável: minúsculo, sem acento e com pontuação virada em espaço.
 * Sem isso "função" não casa com "funcao" e "m/s," não casa com "m/s".
 */
export function normalizeText(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      // \p{M} são as marcas de acento que o NFD separou da letra.
      .replace(/\p{M}+/gu, '')
      .replace(/[^a-z0-9º()/%-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Escapa para uso dentro de regex. */
function escapeRegex(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const cache = new Map<string, RegExp>();

/**
 * Regex de um termo. Espaço casa qualquer espaçamento; `*` no fim libera
 * sufixo ("urbaniza*" pega urbanização e urbanizado). As bordas impedem que
 * "mol" case dentro de "molecula" ou "area" dentro de "areia".
 */
function termRegex(term: string): RegExp {
  const cached = cache.get(term);
  if (cached) return cached;
  const prefixo = term.endsWith('*');
  const base = escapeRegex(prefixo ? term.slice(0, -1) : term).replace(
    /\\?\s+/g,
    '\\s+',
  );
  const fim = prefixo ? '' : '(?![a-z0-9])';
  const re = new RegExp(`(?<![a-z0-9])${base}${fim}`);
  cache.set(term, re);
  return re;
}

interface Pontuacao {
  rule: TopicRule;
  score: number;
  matched: string[];
}

/** Pontua uma regra contra o texto já normalizado. */
function scoreRule(rule: TopicRule, texto: string): Pontuacao {
  const matched: string[] = [];
  let score = 0;
  for (const termo of rule.strong ?? []) {
    if (termRegex(termo).test(texto)) {
      score += PESO_FORTE;
      matched.push(termo);
    }
  }
  for (const termo of rule.weak ?? []) {
    if (termRegex(termo).test(texto)) {
      score += PESO_APOIO;
      matched.push(termo);
    }
  }
  return { rule, score, matched };
}

/**
 * Decide matéria/assunto de uma questão pelo vocabulário, dentro da área dada.
 *
 * Devolve `null` quando ninguém atinge a pontuação mínima OU quando o segundo
 * colocado de outro assunto está perto demais — é o caso em que a questão
 * segue para a classificação por IA em vez de receber um palpite.
 */
export function classifyByKeywords(
  text: string,
  areaName: string,
): HeuristicDecision | null {
  const texto = normalizeText(text);
  if (!texto) return null;

  const candidatas = RULES.filter((r) => r.area === areaName)
    .map((r) => scoreRule(r, texto))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const melhor = candidatas[0];
  if (!melhor || melhor.score < MIN_SCORE) return null;

  // Concorrente = primeiro candidato de OUTRO assunto. Duas regras do mesmo
  // assunto não competem entre si (não há como errar escolhendo qualquer uma).
  const concorrente = candidatas.find(
    (p) =>
      p.rule.topic !== melhor.rule.topic ||
      p.rule.subject !== melhor.rule.subject,
  );
  const margin = melhor.score - (concorrente?.score ?? 0);
  if (margin < MIN_MARGIN) return null;

  return {
    subject: melhor.rule.subject,
    topic: melhor.rule.topic,
    score: melhor.score,
    margin,
    // 0.6 na margem mínima, 0.9 quando o assunto é isolado com folga.
    confidence: Math.min(0.9, 0.55 + 0.025 * margin),
    matched: melhor.matched,
  };
}
