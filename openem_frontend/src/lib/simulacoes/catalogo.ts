/**
 * Catálogo das simulações (tela /simulacoes). Só dados: o componente de cada
 * uma fica no registro em `components/simulacoes/registro.ts`, carregado sob
 * demanda, e um teste cobra que os dois tenham as mesmas chaves.
 */
import { semAcento } from './texto';

export type MateriaSim = 'Física' | 'Química' | 'Biologia' | 'Matemática' | 'Geografia';

export interface SimulacaoInfo {
  slug: string;
  titulo: string;
  materia: MateriaSim;
  dimensao: '2D' | '3D';
  resumo: string;
  /** Assuntos do ENEM que a simulação cobre (também entram na busca). */
  conceitos: string[];
}

export const MATERIAS_SIM: MateriaSim[] = ['Física', 'Química', 'Biologia', 'Matemática', 'Geografia'];

/** Cor de área de cada matéria (os tokens --nat, --mat, --hum do app). */
export const AREA_DA_MATERIA: Record<MateriaSim, 'nat' | 'mat' | 'hum'> = {
  Física: 'nat',
  Química: 'nat',
  Biologia: 'nat',
  Matemática: 'mat',
  Geografia: 'hum',
};

/**
 * Endereço de cada matéria (`/simulacoes/fisica`…). Divide o caminho com as
 * simulações (`/simulacoes/pendulo`): um teste cobra que nenhum slug de
 * simulação seja igual ao de uma matéria e que o App.tsx tenha as rotas.
 */
export const SLUG_DA_MATERIA: Record<MateriaSim, string> = {
  Física: 'fisica',
  Química: 'quimica',
  Biologia: 'biologia',
  Matemática: 'matematica',
  Geografia: 'geografia',
};

export function materiaPorSlug(slug: string | undefined): MateriaSim | undefined {
  return MATERIAS_SIM.find((m) => SLUG_DA_MATERIA[m] === slug);
}

/** Simulações de uma matéria, com as cenas 3D na frente (as mais vistosas). */
export function simulacoesDaMateria(materia: MateriaSim, lista: SimulacaoInfo[] = SIMULACOES) {
  const daMateria = lista.filter((s) => s.materia === materia);
  return [...daMateria.filter((s) => s.dimensao === '3D'), ...daMateria.filter((s) => s.dimensao === '2D')];
}

export const SIMULACOES: SimulacaoInfo[] = [
  {
    slug: 'lancamento-obliquo',
    titulo: 'Lançamento oblíquo',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Chute uma bola com a velocidade e o ângulo que quiser, com ou sem a resistência do ar, na Terra, na Lua ou em Marte.',
    conceitos: ['Cinemática', 'Movimento parabólico', 'Resistência do ar', 'Gravidade'],
  },
  {
    slug: 'pendulo',
    titulo: 'Pêndulo simples',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'O período do pêndulo, a troca entre energia cinética e potencial e o que muda quando o ângulo deixa de ser pequeno.',
    conceitos: ['MHS', 'Período', 'Conservação da energia', 'Amortecimento'],
  },
  {
    slug: 'massa-mola',
    titulo: 'Massa-mola e ressonância',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Oscilador com atrito e força externa: veja a amplitude explodir quando a frequência bate com a natural.',
    conceitos: ['MHS', 'Lei de Hooke', 'Amortecimento', 'Ressonância'],
  },
  {
    slug: 'plano-inclinado',
    titulo: 'Plano inclinado com atrito',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Decomponha o peso, compare o atrito estático com o cinético e descubra o ângulo em que o bloco escorrega.',
    conceitos: ['Leis de Newton', 'Força de atrito', 'Força normal', 'Decomposição de forças'],
  },
  {
    slug: 'empuxo',
    titulo: 'Empuxo e flutuação',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Solte blocos de materiais diferentes em líquidos diferentes e meça o empuxo e o peso aparente.',
    conceitos: ['Hidrostática', 'Princípio de Arquimedes', 'Densidade', 'Peso aparente'],
  },
  {
    slug: 'circuitos',
    titulo: 'Circuitos com lâmpadas',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Lâmpadas em série, em paralelo e mistas. Queime uma e veja o que acontece com o brilho das outras.',
    conceitos: ['Lei de Ohm', 'Associação de resistores', 'Potência elétrica', 'Leis de Kirchhoff'],
  },
  {
    slug: 'laboratorio-circuitos',
    titulo: 'Laboratório de circuitos',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Monte o seu circuito numa bancada: bateria, lâmpadas, resistores, chaves, amperímetro e voltímetro. Ponha, tire, queime e meça.',
    conceitos: ['Leis de Kirchhoff', 'Associação de resistores', 'Amperímetro e voltímetro', 'Curto-circuito', 'Potência elétrica'],
  },
  {
    slug: 'refracao',
    titulo: 'Refração e reflexão total',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Um laser atravessa ar, água, vidro e diamante: lei de Snell, ângulo limite e quanto da luz é refletido.',
    conceitos: ['Óptica', 'Lei de Snell', 'Índice de refração', 'Reflexão total', 'Fibra óptica'],
  },
  {
    slug: 'lentes-espelhos',
    titulo: 'Lentes e espelhos',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Mova o objeto e acompanhe os raios principais formando a imagem em lentes e espelhos esféricos.',
    conceitos: ['Óptica', 'Equação de Gauss', 'Aumento linear', 'Formação de imagens'],
  },
  {
    slug: 'doppler',
    titulo: 'Efeito Doppler',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Uma ambulância passa: as frentes de onda se apertam na frente e se abrem atrás. Passe da velocidade do som.',
    conceitos: ['Ondulatória', 'Som', 'Frequência', 'Efeito Doppler', 'Cone de Mach'],
  },
  {
    slug: 'interferencia',
    titulo: 'Interferência na cuba de ondas',
    materia: 'Física',
    dimensao: '3D',
    resumo: 'Duas fontes batem na água e as ondas se somam ou se cancelam. Mude a frequência, a distância e a profundidade e veja as linhas nodais.',
    conceitos: ['Ondulatória', 'Interferência', 'Equação fundamental', 'Diferença de caminho'],
  },
  {
    slug: 'orbitas',
    titulo: 'Órbitas e leis de Kepler',
    materia: 'Física',
    dimensao: '3D',
    resumo: 'O Sistema Solar com as órbitas reais e uma sonda que você lança: elipses, áreas iguais e velocidade de escape.',
    conceitos: ['Gravitação universal', 'Leis de Kepler', 'Velocidade de escape', 'Órbitas'],
  },
  {
    slug: 'campo-magnetico',
    titulo: 'Carga em campo magnético',
    materia: 'Física',
    dimensao: '3D',
    resumo: 'Prótons e elétrons em um campo uniforme: circunferências, hélices e a regra da mão direita.',
    conceitos: ['Eletromagnetismo', 'Força magnética', 'Força de Lorentz', 'Regra da mão direita'],
  },
  {
    slug: 'vetores',
    titulo: 'Soma de vetores',
    materia: 'Física',
    dimensao: '2D',
    resumo: 'Arraste as pontas dos vetores e veja a resultante pela regra do paralelogramo ou do polígono, com as componentes e a lei dos cossenos.',
    conceitos: ['Vetores', 'Força resultante', 'Componentes', 'Lei dos cossenos'],
  },
  {
    slug: 'gases',
    titulo: 'Gás ideal: pressão, volume e temperatura',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Centenas de moléculas colidindo. A pressão é medida nas paredes, e as leis de Boyle e Gay-Lussac aparecem sozinhas.',
    conceitos: ['Gases', 'Teoria cinética', 'Transformações gasosas', 'Termodinâmica'],
  },
  {
    slug: 'titulacao',
    titulo: 'Titulação ácido-base',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Pingue a base da bureta, acompanhe a curva de pH e veja o indicador mudar de cor no ponto de viragem.',
    conceitos: ['Ácidos e bases', 'pH', 'Indicadores', 'Neutralização', 'Solução-tampão'],
  },
  {
    slug: 'equilibrio-quimico',
    titulo: 'Equilíbrio químico e Le Chatelier',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'N₂O₄ incolor e NO₂ castanho: aqueça, esfrie, comprima e adicione reagente para deslocar o equilíbrio.',
    conceitos: ['Equilíbrio químico', 'Constante de equilíbrio', 'Le Chatelier', 'Cinética química'],
  },
  {
    slug: 'geometria-molecular',
    titulo: 'Geometria molecular',
    materia: 'Química',
    dimensao: '3D',
    resumo: 'Gire 17 moléculas em 3D com os ângulos medidos, os pares isolados e o vetor do momento de dipolo.',
    conceitos: ['Ligações químicas', 'VSEPR', 'Polaridade', 'Geometria molecular'],
  },
  {
    slug: 'cristais',
    titulo: 'Estruturas cristalinas',
    materia: 'Química',
    dimensao: '3D',
    resumo: 'O sal, o cobre, o ferro e o diamante por dentro: conte os átomos da célula unitária, veja o empacotamento e calcule a densidade.',
    conceitos: ['Ligação iônica', 'Ligação metálica', 'Ligação covalente', 'Retículo cristalino', 'Densidade'],
  },
  {
    slug: 'isomeria',
    titulo: 'Isomeria',
    materia: 'Química',
    dimensao: '3D',
    resumo: 'Pares de isômeros lado a lado: cadeia, posição, função, cis-trans e óptica. Gire a ligação simples, tente girar a dupla e tente sobrepor os enantiômeros.',
    conceitos: ['Isomeria plana', 'Isomeria geométrica', 'Isomeria óptica', 'Carbono quiral'],
  },
  {
    slug: 'atomo',
    titulo: 'Monte um átomo',
    materia: 'Química',
    dimensao: '3D',
    resumo: 'Qualquer átomo da tabela periódica, com os isótopos e íons que existem, nos modelos de Dalton, Thomson, Rutherford, Bohr, Sommerfeld e quântico, em 2D ou 3D.',
    conceitos: ['Modelos atômicos', 'Isótopos', 'Íons', 'Distribuição eletrônica', 'Orbitais'],
  },
  {
    slug: 'ligacoes',
    titulo: 'Ligações químicas',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Escolha dois elementos da tabela periódica e veja a ligação se formar: iônica, covalente polar ou apolar, metálica e dativa, com fórmula e estrutura de Lewis.',
    conceitos: ['Ligação iônica', 'Ligação covalente', 'Ligação metálica', 'Ligação dativa', 'Eletronegatividade', 'Polaridade'],
  },
  {
    slug: 'pilha',
    titulo: 'Pilhas e eletroquímica',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Monte uma pilha com dois metais, leia a ddp pela equação de Nernst e veja a pilha descarregar.',
    conceitos: ['Eletroquímica', 'Potencial de redução', 'Ânodo e cátodo', 'Pilha de Daniell'],
  },
  {
    slug: 'decaimento-radioativo',
    titulo: 'Decaimento radioativo',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Núcleos decaindo ao acaso seguem a curva da meia-vida. Inclui datação por carbono-14 e o césio de Goiânia.',
    conceitos: ['Radioatividade', 'Meia-vida', 'Datação por carbono-14', 'Energia nuclear'],
  },
  {
    slug: 'atomo-hidrogenio',
    titulo: 'Átomo de Bohr e espectro do hidrogênio',
    materia: 'Química',
    dimensao: '2D',
    resumo: 'Faça o elétron saltar entre níveis e veja a cor do fóton emitido. As linhas de Balmer são as que vemos.',
    conceitos: ['Modelos atômicos', 'Modelo de Bohr', 'Espectro', 'Fóton'],
  },
  {
    slug: 'predador-presa',
    titulo: 'Predador e presa',
    materia: 'Biologia',
    dimensao: '2D',
    resumo: 'Lebres e linces em ciclos defasados (modelo de Lotka-Volterra), com e sem limite de recursos do ambiente.',
    conceitos: ['Ecologia', 'Dinâmica de populações', 'Cadeia alimentar', 'Capacidade de suporte'],
  },
  {
    slug: 'genetica-populacoes',
    titulo: 'Seleção natural e deriva genética',
    materia: 'Biologia',
    dimensao: '2D',
    resumo: 'Acompanhe a frequência de um alelo por gerações. Populações pequenas perdem variabilidade por puro acaso.',
    conceitos: ['Evolução', 'Hardy-Weinberg', 'Seleção natural', 'Deriva genética'],
  },
  {
    slug: 'dna',
    titulo: 'DNA: do gene à proteína',
    materia: 'Biologia',
    dimensao: '3D',
    resumo: 'A dupla hélice montada com a sequência que você escrever: pareamento de bases, transcrição, tradução e o efeito de cada mutação.',
    conceitos: ['Ácidos nucleicos', 'Código genético', 'Transcrição e tradução', 'Mutação'],
  },
  {
    slug: 'punnett',
    titulo: 'Cruzamentos de Mendel',
    materia: 'Biologia',
    dimensao: '2D',
    resumo: 'Escolha os genótipos dos pais e veja o quadro de Punnett, as proporções e filhos sorteados: monoibridismo, diibridismo e dominância incompleta.',
    conceitos: ['Leis de Mendel', 'Quadro de Punnett', 'Probabilidade genética', 'Dominância'],
  },
  {
    slug: 'funcoes',
    titulo: 'Gráficos de funções',
    materia: 'Matemática',
    dimensao: '2D',
    resumo: 'Arraste os pontos e veja a reta, a parábola, a exponencial, o logaritmo e o seno mudarem, com a fórmula, as raízes e o estudo do sinal.',
    conceitos: ['Função afim', 'Função quadrática', 'Exponencial e logaritmo', 'Leitura de gráficos'],
  },
  {
    slug: 'ciclo-trigonometrico',
    titulo: 'Ciclo trigonométrico',
    materia: 'Matemática',
    dimensao: '2D',
    resumo: 'Gire o ponto no círculo e veja seno, cosseno e tangente no ciclo e no gráfico, com os ângulos notáveis e os sinais de cada quadrante.',
    conceitos: ['Trigonometria', 'Seno e cosseno', 'Ângulos notáveis', 'Funções periódicas'],
  },
  {
    slug: 'triangulos',
    titulo: 'Triângulos e pontos notáveis',
    materia: 'Matemática',
    dimensao: '2D',
    resumo: 'Arraste os vértices e acompanhe ângulos, área e classificação, com baricentro, circuncentro, incentro, ortocentro e Pitágoras.',
    conceitos: ['Geometria plana', 'Pontos notáveis', 'Teorema de Pitágoras', 'Área'],
  },
  {
    slug: 'probabilidade',
    titulo: 'Probabilidade com dados',
    materia: 'Matemática',
    dimensao: '2D',
    resumo: 'Lance um, dois ou três dados mil vezes e compare a frequência de cada soma com a probabilidade calculada.',
    conceitos: ['Probabilidade', 'Estatística', 'Lei dos grandes números', 'Valor esperado'],
  },
  {
    slug: 'projecoes-ortograficas',
    titulo: 'Projeções ortográficas',
    materia: 'Matemática',
    dimensao: '3D',
    resumo: 'Monte um sólido de cubos clicando e veja as vistas de frente, de cima e de lado. Nos desafios, monte o sólido a partir das vistas.',
    conceitos: ['Geometria espacial', 'Vistas ortogonais', 'Visualização espacial'],
  },
  {
    slug: 'planificacao',
    titulo: 'Sólidos e planificação',
    materia: 'Matemática',
    dimensao: '3D',
    resumo: 'Abra e feche cubo, paralelepípedo, prisma, pirâmide e tetraedro, com vértices, arestas, faces, área e volume.',
    conceitos: ['Geometria espacial', 'Planificação', 'Relação de Euler', 'Área e volume'],
  },
  {
    slug: 'estacoes-do-ano',
    titulo: 'Estações do ano e duração do dia',
    materia: 'Geografia',
    dimensao: '3D',
    resumo: 'A Terra na órbita real com o eixo inclinado: por que o verão no Sul é em dezembro e por que o dia muda de tamanho.',
    conceitos: ['Movimentos da Terra', 'Estações do ano', 'Solstício e equinócio', 'Zonas térmicas'],
  },
  {
    slug: 'fases-da-lua',
    titulo: 'Fases da Lua e eclipses',
    materia: 'Geografia',
    dimensao: '3D',
    resumo: 'A Lua em volta da Terra sob o céu estrelado: por que as fases mudam, como a Lua aparece no hemisfério sul e por que não há eclipse todo mês.',
    conceitos: ['Movimentos da Lua', 'Fases da Lua', 'Eclipses', 'Astronomia'],
  },
  {
    slug: 'fusos-horarios',
    titulo: 'Fusos horários',
    materia: 'Geografia',
    dimensao: '3D',
    resumo: 'Um globo com os 24 fusos e o lado do dia: mude a hora, compare duas cidades e veja por que cada 15° de longitude é uma hora.',
    conceitos: ['Fusos horários', 'Coordenadas geográficas', 'Movimento de rotação'],
  },
];

export const simulacaoPorSlug = (slug: string | undefined) => SIMULACOES.find((s) => s.slug === slug);

/** Busca sem acento no título, na matéria, no resumo e nos conceitos. */
export function filtrarSimulacoes(lista: SimulacaoInfo[], busca: string, materia: MateriaSim | null, dimensao: '2D' | '3D' | null) {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  return lista.filter((s) => {
    if (materia && s.materia !== materia) return false;
    if (dimensao && s.dimensao !== dimensao) return false;
    const alvo = semAcento([s.titulo, s.materia, s.resumo, ...s.conceitos].join(' '));
    return termos.every((t) => alvo.includes(t));
  });
}
