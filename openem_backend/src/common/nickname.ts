/**
 * Apelido do aluno: o nome público dele no fórum, no ranking, no perfil
 * público e nos temas publicados. É único, escolhido no cadastro, e passa por
 * um filtro de nomes ofensivos (palavrões, ofensas a grupos, nazismo, ódio
 * religioso, violência sexual) e de nomes que imitam a equipe.
 *
 * O filtro trabalha sobre um "esqueleto" do apelido: sem `.`/`_`, com os
 * números lidos como letras (h1tl3r → hitler) e k/y como c/i. Cada termo vira
 * uma expressão em que toda letra pode se repetir (hiiitler), mas letra dobrada
 * no termo continua exigindo duas (porra não casa com "corporação").
 *
 * Palavrão escondido dentro de palavra inocente ("disputa", "enviado") é o
 * problema clássico desse tipo de filtro: as palavras de `SAFE_WORDS` saem do
 * esqueleto antes da busca, e os termos curtos ou ambíguos (`TOKEN_TERMS`) só
 * valem como palavra inteira, separada por `.`, `_` ou número.
 */

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

/** Letras minúsculas sem acento, números, `.` e `_`; começa e termina sem ponto. */
const FORMAT = /^[a-z0-9_.]+$/;

export type NicknameCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'formato' | 'ofensivo' | 'reservado';
      message: string;
    };

/** Apelido como é gravado: sem espaços nas pontas, sem `@` na frente, minúsculo. */
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

// Termos que barram o apelido em qualquer posição. Escritos sem acento; o
// esqueleto cuida de números, k/y e repetição.
const ANYWHERE_TERMS = [
  // Palavrões e termos sexuais
  'caralho',
  'porra',
  'puta',
  'putinha',
  'fdp',
  'pqp',
  'vsf',
  'tnc',
  'foda',
  'fuder',
  'foder',
  'merda',
  'merdinha',
  'bosta',
  'buceta',
  'boceta',
  'xoxota',
  'xereca',
  'piroca',
  'caceta',
  'cacete',
  'punheta',
  'punheteiro',
  'siririca',
  'boquete',
  'cuzao',
  'cuzinho',
  'arrombado',
  'arrombada',
  'escroto',
  'vagabunda',
  'vagabundo',
  'vadia',
  'prostituta',
  'putaria',
  'porno',
  'sexo',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'whore',
  'slut',
  // Violência sexual
  'estupro',
  'estuprador',
  'estupra',
  'pedofilo',
  'pedofilia',
  'zoofilia',
  'incesto',
  // Ofensas a grupos (racismo, LGBTfobia, capacitismo)
  'viado',
  'sapatao',
  'traveco',
  'boiola',
  'baitola',
  'crioulo',
  'nigger',
  'nigga',
  'faggot',
  'retardado',
  'retardada',
  'mongoloide',
  // Ódio religioso: os apelidos pejorativos em si
  'macumbeiro',
  'macumbeira',
  'crentelho',
  'chutasanta',
  // Nazismo, supremacismo e genocidas
  'hitler',
  'nazi',
  'nazismo',
  'nazista',
  'fuhrer',
  'siegheil',
  'gestapo',
  'goebbels',
  'himmler',
  'mengele',
  'eichmann',
  'mussolini',
  'fascista',
  'stalin',
  'polpot',
  'binladen',
  'kukluxklan',
  'whitepower',
  'whitepride',
  'supremaciabranca',
  'racaariana',
];

// Curtos ou ambíguos: só barram como palavra inteira ("cu_123", "pica.pica"),
// nunca dentro de outra palavra (cumbuca, picanha).
const TOKEN_TERMS = ['cu', 'pica', 'bicha', 'fag'];

// Números de códigos nazistas, conferidos no apelido como foi digitado.
const NUMBER_CODES = ['1488'];

// Palavras inocentes que contêm um termo barrado ("disputa", "badminton",
// "matemática" + "trans"...): saem do esqueleto antes da busca.
const SAFE_WORDS = [
  'computa',
  'deputa',
  'disputa',
  'reputa',
  'imputa',
  'amputa',
  'enviad',
  'desviad',
  'aviad',
  'shiitake',
  'shitake',
  'antinazi',
  'antifascis',
  'badminton',
  'matematic',
  'tomate',
  'adeus',
  'forasteir',
  'interpret',
  'transform',
  'transport',
  'transit',
];

// Ataque a um grupo: uma palavra hostil junto de um grupo protegido, em
// qualquer ordem ("odeiocatolicos", "morteaosjudeus", "catolicolixo").
const HOSTILE_WORDS = [
  'odeio',
  'odio',
  'morte',
  'morra',
  'morram',
  'matar',
  'mata',
  'mate',
  'lixo',
  'nojo',
  'nojento',
  'nojenta',
  'maldito',
  'maldita',
  'queima',
  'queimar',
  'chuta',
  'fora',
  'abaixo',
  'extermina',
  'exterminar',
  'hate',
  'kill',
  'death',
];

const PROTECTED_GROUPS = [
  // Religiões
  'catolic',
  'cristao',
  'crista',
  'cristaos',
  'crente',
  'evangelic',
  'protestant',
  'judeu',
  'judia',
  'judaic',
  'muculman',
  'mulcuman',
  'islam',
  'umband',
  'candomble',
  'macumba',
  'espirita',
  'budista',
  'hindu',
  'ateu',
  'ateia',
  'testemunhadejeova',
  'mormon',
  'padre',
  'pastor',
  'freira',
  'jesus',
  'cristo',
  'deus',
  'alah',
  'allah',
  // Raça, etnia e origem
  'negro',
  'negra',
  'preto',
  'preta',
  'indio',
  'india',
  'indigena',
  'cigano',
  'nordestin',
  'baiano',
  'imigrante',
  'haitian',
  'venezuelan',
  'jew',
  // Gênero e orientação
  'gay',
  'lesbica',
  'trans',
  'travesti',
  'lgbt',
  'bissexual',
  'mulher',
  'feminista',
];

// Nomes que parecem a equipe ou o sistema.
const RESERVED_ANYWHERE = ['openem', 'admin', 'moderador', 'moderacao'];
const RESERVED_EXACT = [
  'mod',
  'staff',
  'suporte',
  'equipe',
  'oficial',
  'sistema',
  'root',
  'inep',
  'mec',
  'enem',
  'estudante',
  'anonimo',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  k: 'c',
  y: 'i',
};

/**
 * Esqueletos do texto para a busca: o `1` pode ser i (h1tler) ou l (ki11),
 * então saem dois. Sem acento, sem separador.
 */
export function skeletons(text: string): string[] {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@$]/g, '')
    .replace(/[0345-9@$ky]/g, (c) => LEET[c] ?? c);
  const variants = new Set([base.replace(/1/g, 'i'), base.replace(/1/g, 'l')]);
  return [...variants].map((s) => s.replace(/[^a-z]/g, ''));
}

/** Toda letra do termo pode se repetir; letra dobrada continua dobrada. */
function termPattern(term: string): string {
  const [s] = skeletons(term);
  return [...s].map((c) => `${c}+`).join('');
}

function anyOf(terms: string[]): RegExp {
  return new RegExp(terms.map(termPattern).join('|'));
}

const ANYWHERE = anyOf(ANYWHERE_TERMS);
const HOSTILE = anyOf(HOSTILE_WORDS);
const GROUPS = anyOf(PROTECTED_GROUPS);
const RESERVED = anyOf(RESERVED_ANYWHERE);
const TOKEN = new RegExp(`^(?:${TOKEN_TERMS.map(termPattern).join('|')})$`);
const SAFE = new RegExp(SAFE_WORDS.map((w) => skeletons(w)[0]).join('|'), 'g');

/** Palavras do apelido, separadas por `.`, `_` ou números. */
function tokens(nickname: string): string[] {
  return nickname.split(/[^a-z]+/).filter(Boolean);
}

function cleanSkeletons(nickname: string): string[] {
  return skeletons(nickname).map((sk) => sk.replace(SAFE, ''));
}

function isOffensive(nickname: string): boolean {
  if (NUMBER_CODES.some((code) => nickname.includes(code))) return true;
  if (tokens(nickname).some((t) => TOKEN.test(skeletons(t)[0]))) return true;
  return cleanSkeletons(nickname).some(
    (sk) => ANYWHERE.test(sk) || (HOSTILE.test(sk) && GROUPS.test(sk)),
  );
}

function isReserved(nickname: string): boolean {
  if (RESERVED_EXACT.includes(nickname.replace(/[._\d]/g, ''))) return true;
  return cleanSkeletons(nickname).some((sk) => RESERVED.test(sk));
}

/** Confere um apelido já normalizado (`normalizeNickname`). */
export function checkNickname(nickname: string): NicknameCheck {
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      reason: 'formato',
      message: `O apelido precisa ter de ${NICKNAME_MIN} a ${NICKNAME_MAX} caracteres.`,
    };
  }
  if (!FORMAT.test(nickname)) {
    return {
      ok: false,
      reason: 'formato',
      message:
        'Use só letras sem acento, números, ponto (.) e sublinhado (_), sem espaços.',
    };
  }
  if (
    nickname.startsWith('.') ||
    nickname.endsWith('.') ||
    nickname.includes('..')
  ) {
    return {
      ok: false,
      reason: 'formato',
      message:
        'O apelido não pode começar nem terminar com ponto, nem ter dois pontos seguidos.',
    };
  }
  if (!/[a-z]/.test(nickname)) {
    return {
      ok: false,
      reason: 'formato',
      message: 'O apelido precisa ter pelo menos uma letra.',
    };
  }
  // A mensagem não diz qual termo barrou: assim o filtro não vira um guia de
  // como contorná-lo.
  if (isOffensive(nickname)) {
    return {
      ok: false,
      reason: 'ofensivo',
      message:
        'Esse apelido não é permitido: ele tem palavrão, ofensa ou referência a ódio. Escolha outro.',
    };
  }
  if (isReserved(nickname)) {
    return {
      ok: false,
      reason: 'reservado',
      message: 'Esse apelido é reservado. Escolha outro.',
    };
  }
  return { ok: true };
}

/** Nome público de quem tem (ou ainda não tem) apelido. */
export function publicName(
  profile: { nickname: string | null } | null | undefined,
): string {
  return profile?.nickname ?? 'Estudante';
}
