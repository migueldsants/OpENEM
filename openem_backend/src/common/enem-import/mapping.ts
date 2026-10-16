/**
 * Mapeamento puro do dataset de provas do ENEM para o modelo do OpENEM.
 *
 * A origem é o JSON estático do projeto enem-api (enem.dev), um diretório por
 * prova com um `details.json` por questão. Aqui não há I/O nem Prisma: só a
 * tradução de um formato para o outro, para poder ser testada sozinha.
 *
 * O que o dataset NÃO traz, e por isso não é inventado aqui: comentário da
 * questão, nível de dificuldade e parâmetros de TRI.
 */

/** Uma alternativa como vem do dataset. */
export interface RawAlternative {
  letter: string;
  text: string | null;
  file: string | null;
  isCorrect: boolean;
}

/** Uma questão como vem do `details.json`. */
export interface RawQuestion {
  title?: string;
  index: number;
  year: number;
  language: string | null;
  discipline: string;
  context: string | null;
  files?: string[];
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: RawAlternative[];
}

/** Metadados da prova, do `details.json` da pasta do ano. */
export interface RawExam {
  title: string;
  year: number;
}

/** Prova pronta para virar um `ExamYear`. */
export interface MappedExam {
  slug: string;
  year: number;
  label: string;
  /** Só a reaplicação/PPL; as outras aplicações extras têm o `kind` próprio. */
  isReapplication: boolean;
  kind: ExamKind;
}

/**
 * Aplicação da prova. O INEP aplica, além da regular, a reaplicação/PPL (todo
 * ano), uma 2ª ou 3ª aplicação quando algo dá errado (2014, 2016), a versão
 * digital (2020–2022) e, em 2025, uma aplicação separada em Belém, Ananindeua
 * e Marituba. Cada uma é uma prova diferente, com questões próprias.
 */
export type ExamKind =
  | 'REGULAR'
  | 'REAPLICACAO'
  | 'SEGUNDA_APLICACAO'
  | 'TERCEIRA_APLICACAO'
  | 'DIGITAL'
  | 'REGIONAL';

/**
 * Sufixo do diretório do dataset → aplicação. `code` é a letra que entra no
 * ano do código da questão ("ENEM-2014T-136"); a ordem da lista é a ordem em
 * que as aplicações de um mesmo ano aparecem (`EXAM_KIND_ORDER`).
 */
const KINDS: { suffix: string; kind: ExamKind; label: string; code: string }[] =
  [
    {
      suffix: '-reaplicacao',
      kind: 'REAPLICACAO',
      label: 'reaplicação',
      code: 'R',
    },
    {
      suffix: '-segunda-aplicacao',
      kind: 'SEGUNDA_APLICACAO',
      label: '2ª aplicação',
      code: 'S',
    },
    {
      suffix: '-terceira-aplicacao',
      kind: 'TERCEIRA_APLICACAO',
      label: '3ª aplicação',
      code: 'T',
    },
    { suffix: '-digital', kind: 'DIGITAL', label: 'digital', code: 'D' },
    {
      suffix: '-belem',
      kind: 'REGIONAL',
      label: 'Belém, Ananindeua e Marituba',
      code: 'B',
    },
  ];

export const EXAM_KIND_ORDER: ExamKind[] = [
  'REGULAR',
  ...KINDS.map((k) => k.kind),
];

/** Aplicação de uma prova pelo nome do diretório ("2014-terceira-aplicacao"). */
export function examKind(slug: string): ExamKind {
  return KINDS.find((k) => slug.endsWith(k.suffix))?.kind ?? 'REGULAR';
}

function kindInfo(slug: string) {
  return KINDS.find((k) => slug.endsWith(k.suffix)) ?? null;
}

/** Questão pronta para virar um `Question` + `Alternative[]`. */
export interface MappedQuestion {
  externalId: string;
  /** Código legível e único da questão, ex.: "ENEM-2023-136". */
  code: string;
  /** Número da questão no caderno oficial (1..180). */
  number: number;
  source: 'ENEM_DEV';
  statement: string;
  questionPrompt: string | null;
  language: string | null;
  /** Nome da área do conhecimento, resolvido para id na hora da escrita. */
  areaName: string;
  /** true quando a área veio da numeração e divergiu do rótulo do dataset. */
  areaCorrected: boolean;
  /** Matéria e assunto quando o próprio dataset já os determina (só LE). */
  subjectName: string | null;
  topicName: string | null;
  alternatives: {
    letter: string;
    text: string;
    imageUrl: string | null;
    isCorrect: boolean;
    position: number;
  }[];
  /** Arquivos de imagem citados, para a cópia dos assets. */
  imageUrls: string[];
}

/** Falha de validação de uma questão: ela é pulada e reportada, nunca abortada. */
export class QuestionValidationError extends Error {}

/**
 * `discipline` do dataset -> área do conhecimento. Os nomes são exatamente os
 * da TAXONOMY em `prisma/seed.ts`; divergir daqui cria área duplicada.
 */
export const DISCIPLINE_TO_AREA: Record<string, string> = {
  'ciencias-humanas': 'Ciências Humanas e suas Tecnologias',
  'ciencias-natureza': 'Ciências da Natureza e suas Tecnologias',
  linguagens: 'Linguagens, Códigos e suas Tecnologias',
  matematica: 'Matemática e suas Tecnologias',
};

/**
 * Idioma -> matéria/assunto. São as únicas questões que o dataset já classifica
 * sozinho: o campo `language` diz exatamente qual é o assunto. Ambos já existem
 * na TAXONOMY.
 */
export const LANGUAGE_TO_TOPIC: Record<
  string,
  { subject: string; topic: string }
> = {
  ingles: {
    subject: 'Língua Estrangeira',
    topic: 'Interpretação de texto em inglês',
  },
  espanhol: {
    subject: 'Língua Estrangeira',
    topic: 'Interpretação de texto em espanhol',
  },
};

/**
 * Ordem oficial das áreas nos quatro blocos de 45 questões do caderno.
 *
 * A posição da questão define a área: o dataset de origem rotula errado
 * centenas de questões (em 2010, 33 questões de Linguagens vêm marcadas como
 * Humanas), mas a numeração do ENEM não mente. A ordem mudou duas vezes:
 * - 2009: Natureza, Humanas | Linguagens, Matemática
 * - 2010–2016: Humanas, Natureza | Linguagens, Matemática
 * - 2017 em diante: Linguagens, Humanas | Natureza, Matemática
 */
export function areaBlocks(year: number): string[] {
  if (year >= 2017) {
    return [
      'linguagens',
      'ciencias-humanas',
      'ciencias-natureza',
      'matematica',
    ];
  }
  if (year === 2009) {
    return [
      'ciencias-natureza',
      'ciencias-humanas',
      'linguagens',
      'matematica',
    ];
  }
  return ['ciencias-humanas', 'ciencias-natureza', 'linguagens', 'matematica'];
}

/** Disciplina oficial de uma questão pela sua posição; null fora de 1..180. */
export function disciplineFromNumber(
  year: number,
  number: number,
): string | null {
  if (!Number.isInteger(number) || number < 1 || number > 180) return null;
  return areaBlocks(year)[Math.floor((number - 1) / 45)];
}

/** Dia da prova: as questões 1–90 caem no 1º dia, 91–180 no 2º. */
export function examDay(number: number): 1 | 2 {
  return number <= 90 ? 1 : 2;
}

/** Faixa de números de cada dia da prova. */
export function dayRange(day: 1 | 2): { gte: number; lte: number } {
  return day === 1 ? { gte: 1, lte: 90 } : { gte: 91, lte: 180 };
}

/**
 * Duração oficial do dia, em minutos — o tempo de prova de verdade, que no dia
 * da redação inclui o tempo dela.
 * - Até 2016: 1º dia (Humanas + Natureza) 4h30; 2º dia (Linguagens, Matemática
 *   e redação) 5h30.
 * - 2017: 1º dia (Linguagens, Humanas e redação) 5h30; 2º dia 4h30.
 * - 2018 em diante: o 2º dia passou a 5h.
 */
export function officialDurationMin(year: number, day: 1 | 2): number {
  if (year <= 2016) return day === 1 ? 270 : 330;
  if (year === 2017) return day === 1 ? 330 : 270;
  return day === 1 ? 330 : 300;
}

/** Nomes das áreas de um dia da prova, na ordem do caderno. */
export function dayAreas(year: number, day: 1 | 2): string[] {
  const blocos = areaBlocks(year);
  return (day === 1 ? blocos.slice(0, 2) : blocos.slice(2)).map(
    (d) => DISCIPLINE_TO_AREA[d],
  );
}

const LANGUAGE_SUFFIX: Record<string, string> = {
  ingles: 'ING',
  espanhol: 'ESP',
};

/**
 * Código da questão, no formato ENEM-ANO-QUESTÃO: "ENEM-2023-136".
 *
 * - Reaplicação ganha um "R" no ano: "ENEM-2023R-136". A reaplicação tem o
 *   mesmo ano e os mesmos números da prova regular. As outras aplicações têm
 *   letra própria: S (2ª aplicação), T (3ª), D (digital), B (Belém).
 * - Língua estrangeira ganha o idioma: "ENEM-2023-001-ING". As questões 1–5
 *   existem em inglês e em espanhol com o mesmo número.
 * - O número tem três dígitos, para o código ordenar certo como texto.
 */
export function questionCode(
  examSlug: string,
  year: number,
  number: number,
  language: string | null,
): string {
  const ano = `${year}${kindInfo(examSlug)?.code ?? ''}`;
  const numero = String(number).padStart(3, '0');
  const idioma = language ? LANGUAGE_SUFFIX[language] : undefined;
  return ['ENEM', ano, numero, idioma].filter(Boolean).join('-');
}

/**
 * Normaliza o que o aluno digita na busca por código para o formato gravado,
 * para servir de prefixo: "2023 136" → "ENEM-2023-136", "enem 2023 7" →
 * "ENEM-2023-007", "2023r" → "ENEM-2023R". Aceita espaço, "_", "/" e "." como
 * separador. Número com menos de três dígitos ganha zeros à esquerda — sem
 * isso "ENEM-2023-7" não casaria com "ENEM-2023-007".
 */
export function normalizeCodeQuery(input: string): string {
  const partes = input
    .trim()
    .toUpperCase()
    .split(/[\s_/.-]+/)
    .filter(Boolean);
  if (partes[0] === 'ENEM') partes.shift();
  const [ano, numero, ...resto] = partes;
  const saida = ['ENEM'];
  if (ano) saida.push(ano);
  if (numero)
    saida.push(/^\d{1,2}$/.test(numero) ? numero.padStart(3, '0') : numero);
  saida.push(...resto);
  return saida.join('-');
}

/** Prefixo público das imagens servidas pelo próprio backend. */
export const MEDIA_PREFIX = '/media/enem';

const ENEM_DEV_IMAGE =
  /^https?:\/\/(?:www\.)?enem\.dev\/([^/]+)\/questions\/([^/]+)\/(.+)$/;

/**
 * Reescreve a URL de uma imagem do enem.dev para o caminho servido localmente.
 * URL fora do padrão volta inalterada — melhor uma imagem remota do que um
 * caminho quebrado, e o importador contabiliza esses casos no relatório.
 */
export function rewriteImageUrl(url: string): string {
  const m = ENEM_DEV_IMAGE.exec(url.trim());
  if (!m) return url;
  const [, slug, index, arquivo] = m;
  return `${MEDIA_PREFIX}/${slug}/${index}/${arquivo}`;
}

/** Reescreve todas as imagens citadas num texto Markdown. */
export function rewriteImageUrls(markdown: string): string {
  return markdown.replace(
    /(!\[[^\]]*\]\()([^)\s]+)/g,
    (_todo, prefixo: string, url: string) =>
      `${prefixo}${rewriteImageUrl(url)}`,
  );
}

/** Extrai o caminho relativo (slug/índice/arquivo) de uma imagem do enem.dev. */
export function imageRelativePath(url: string): string | null {
  const m = ENEM_DEV_IMAGE.exec(url.trim());
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
}

/** Metadados da prova a partir do nome do diretório e do `details.json`. */
export function mapExam(slug: string, raw: RawExam): MappedExam {
  const info = kindInfo(slug);
  return {
    slug,
    year: raw.year,
    label: info ? `ENEM ${raw.year} (${info.label})` : `ENEM ${raw.year}`,
    isReapplication: info?.kind === 'REAPLICACAO',
    kind: info?.kind ?? 'REGULAR',
  };
}

/**
 * Traduz uma questão do dataset.
 *
 * `questionDir` é o nome da pasta ("136", "1-ingles") e não o índice: é o único
 * identificador único por construção, e resolve de uma vez tanto a reaplicação
 * (mesmo ano, mesmos índices) quanto a duplicação por idioma.
 */
export function mapQuestion(
  raw: RawQuestion,
  examSlug: string,
  questionDir: string,
): MappedQuestion {
  // A área vem da posição da questão no caderno; o rótulo do dataset só é
  // usado quando o número está fora da faixa oficial.
  const pelaNumeracao = disciplineFromNumber(raw.year, raw.index);
  const disciplina = pelaNumeracao ?? raw.discipline;
  const areaName = DISCIPLINE_TO_AREA[disciplina];
  if (!areaName) {
    throw new QuestionValidationError(
      `disciplina desconhecida: "${raw.discipline}"`,
    );
  }

  // As alternativas vêm antes do enunciado: quando as imagens delas chegaram
  // no `files` da questão em vez de no `file` de cada uma (ver
  // mapAlternatives), essas imagens precisam sair do enunciado — senão as
  // alternativas apareceriam duas vezes, uma no apoio e uma na lista.
  const { alternatives, promotedFiles } = mapAlternatives(raw);

  const contexto = removeImages((raw.context ?? '').trim(), promotedFiles);
  const comando = (raw.alternativesIntroduction ?? '').trim();
  if (!contexto && !comando) {
    throw new QuestionValidationError('questão sem enunciado');
  }
  // Com contexto, ele é o texto de apoio e o comando fica à parte. Sem
  // contexto, o comando É o enunciado — e aí não se repete nos dois campos.
  const statement = rewriteImageUrls(contexto || comando);
  const questionPrompt = contexto && comando ? rewriteImageUrls(comando) : null;

  const classificacao = raw.language
    ? LANGUAGE_TO_TOPIC[raw.language]
    : undefined;

  const imageUrls = [
    ...(raw.files ?? []),
    ...raw.alternatives.map((a) => a.file).filter((f): f is string => !!f),
  ]
    .map((u) => u.trim())
    .filter((u, i, arr) => u && arr.indexOf(u) === i);

  return {
    externalId: `enem:${examSlug}:${questionDir}`,
    code: questionCode(examSlug, raw.year, raw.index, raw.language),
    number: raw.index,
    source: 'ENEM_DEV',
    statement,
    questionPrompt,
    language: raw.language,
    areaName,
    areaCorrected: disciplina !== raw.discipline,
    subjectName: classificacao?.subject ?? null,
    topicName: classificacao?.topic ?? null,
    alternatives,
    imageUrls,
  };
}

/**
 * Remove de um Markdown as imagens cujo endereço está na lista — usado nas
 * imagens do enunciado que viraram alternativas. Limpa também a linha vazia
 * que sobra, para o enunciado não ficar com buracos de parágrafo.
 */
export function removeImages(markdown: string, urls: string[]): string {
  if (urls.length === 0) return markdown;
  const alvo = new Set(urls.map((u) => u.trim()));
  return markdown
    .replace(/!\[[^\]]*\]\(([^)\s]+)\)/g, (todo, url: string) =>
      alvo.has(url.trim()) ? '' : todo,
    )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Imagens do `files` da questão que nenhuma alternativa reivindica.
 *
 * O dataset às vezes põe as imagens DAS alternativas no `files` da questão e
 * deixa o `file` de cada uma nulo (a prova de 2021 reaplicação faz isso nas
 * questões de quadrinho). Essas sobras são o que permite recuperar uma questão
 * que, lida ao pé da letra, teria alternativas vazias.
 */
function unusedFiles(raw: RawQuestion): string[] {
  const usadas = new Set(
    raw.alternatives
      .map((a) => (a.file ?? '').trim())
      .filter((f): f is string => !!f),
  );
  return (raw.files ?? [])
    .map((f) => f.trim())
    .filter((f, i, arr) => f && !usadas.has(f) && arr.indexOf(f) === i);
}

/**
 * Alternativas prontas para o banco, mais a lista de imagens que foram
 * promovidas do `files` da questão para uma alternativa.
 */
function mapAlternatives(raw: RawQuestion): {
  alternatives: MappedQuestion['alternatives'];
  promotedFiles: string[];
} {
  if (!Array.isArray(raw.alternatives) || raw.alternatives.length === 0) {
    throw new QuestionValidationError('questão sem alternativas');
  }

  const letras = raw.alternatives.map((a) => a.letter);
  if (new Set(letras).size !== letras.length) {
    throw new QuestionValidationError(`letras repetidas: ${letras.join('')}`);
  }

  // Alternativa sem texto e sem imagem própria recebe, na ordem, uma das
  // imagens sobrando no `files`. Só vale quando há sobra para TODAS as vazias:
  // preencher metade deixaria a questão com alternativas trocadas.
  const vazias = raw.alternatives.filter(
    (a) => !(a.text ?? '').trim() && !a.file,
  );
  const sobrando = unusedFiles(raw);
  const fila =
    vazias.length > 0 && sobrando.length >= vazias.length
      ? sobrando.slice(sobrando.length - vazias.length)
      : [];
  const promotedFiles: string[] = [];

  const alternatives = raw.alternatives.map((a, i) => {
    const texto = (a.text ?? '').trim();
    let arquivo = a.file;
    if (!texto && !arquivo && fila.length > 0) {
      arquivo = fila.shift()!;
      promotedFiles.push(arquivo);
    }
    const imagem = arquivo ? rewriteImageUrl(arquivo) : null;
    if (!texto && !imagem) {
      throw new QuestionValidationError(
        `alternativa ${a.letter} sem texto e sem imagem`,
      );
    }
    return {
      letter: a.letter,
      text: texto,
      imageUrl: imagem,
      isCorrect: a.letter === raw.correctAlternative,
      position: i,
    };
  });

  // O gabarito tem duas fontes no dataset (`correctAlternative` e o
  // `isCorrect` de cada alternativa) e elas discordam: em centenas de questões
  // nenhuma alternativa vem marcada. `correctAlternative` é a fonte confiável
  // — é ele que a prova oficial publica —, então ele manda; o `isCorrect` das
  // alternativas só serve para ACUSAR divergência, que aí é erro de verdade.
  const marcadas = raw.alternatives.filter((a) => a.isCorrect);
  const corretas = alternatives.filter((a) => a.isCorrect);
  const divergente =
    marcadas.length > 0 &&
    (marcadas.length > 1 || marcadas[0].letter !== raw.correctAlternative);
  if (corretas.length !== 1 || divergente) {
    throw new QuestionValidationError(
      `gabarito inconsistente: correctAlternative="${raw.correctAlternative}", ` +
        `marcadas=${marcadas.map((a) => a.letter).join(',') || 'nenhuma'}`,
    );
  }

  return { alternatives, promotedFiles };
}
