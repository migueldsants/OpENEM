import {
  checkNickname,
  normalizeNickname,
  publicName,
  skeletons,
} from './nickname';

const reason = (nick: string) => {
  const r = checkNickname(normalizeNickname(nick));
  return r.ok ? 'ok' : r.reason;
};

describe('normalizeNickname', () => {
  it('tira espaços nas pontas, o @ da frente e põe em minúsculas', () => {
    expect(normalizeNickname('  @Maria_Estuda ')).toBe('maria_estuda');
  });
});

describe('skeletons', () => {
  it('lê números como letras, tira separadores e acentos', () => {
    expect(skeletons('h1tl3r_88')).toContain('hitlerbb');
    expect(skeletons('ki11')).toContain('cill');
    expect(skeletons('João.Silva')).toEqual(['joaosilva']);
  });
});

describe('checkNickname', () => {
  it.each([
    'maria',
    'joao.silva',
    'ana_2008',
    'medicina2027',
    'futura.engenheira',
    'catolica_fiel',
    'evangelico.estudante',
    'umbandista',
    'judeu.de.sp',
    'gay_e_orgulhoso',
    'negra.na.medicina',
    'theila',
    'cumbuca',
    'picanha',
    'disputa',
    'deputada.ana',
    'computador',
    'enviado',
    'desviado',
    'badminton',
    'matematica.crista',
    'interpretacao',
    'pinto.carlos',
    'unicornio',
    'kkkkk',
    'joao88',
  ])('aceita %s', (nick) => {
    expect(reason(nick)).toBe('ok');
  });

  it.each([
    'caralho',
    'p0rra',
    'mariaputa',
    'fdp123',
    'buceta',
    'b0c3ta',
    'merdinha',
    'fuck_you',
    'cu_123',
    'cuuu',
    'pica.grossa',
    'viado',
    'v1ado',
    'sapatao',
    'crioulo',
    'macaco_crioulo',
    'retardado',
    'estuprador',
    'pedofilo',
  ])('barra palavrão e ofensa: %s', (nick) => {
    expect(reason(nick)).toBe('ofensivo');
  });

  it.each([
    'hitler',
    'h1tl3r',
    'hiiitler',
    'adolf.hitler',
    'nazista',
    'n4zi',
    'siegheil',
    'mussolini',
    'stalin',
    'whitepower',
    'kukluxklan',
    'maria1488',
  ])('barra nazismo e genocidas: %s', (nick) => {
    expect(reason(nick)).toBe('ofensivo');
  });

  it.each([
    'odeio_catolicos',
    'morte.aos.catolicos',
    'catolico_lixo',
    'morte_aos_crentes',
    'crentelho',
    'macumbeiro',
    'chuta_santa',
    'odeio_judeus',
    'mata_judeu',
    'fora_muculmanos',
    'queima_umbanda',
    'evangelicos_nojentos',
    'odeio_ateus',
    'odeio_negros',
    'morte_aos_gays',
    'fora_nordestinos',
  ])('barra ataque a grupo: %s', (nick) => {
    expect(reason(nick)).toBe('ofensivo');
  });

  it.each([
    'admin',
    'openem_oficial',
    'moderador',
    'suporte',
    'estudante',
    'mec',
  ])('barra nome reservado: %s', (nick) => {
    expect(reason(nick)).toBe('reservado');
  });

  it.each([
    ['ab', 'curto'],
    ['a'.repeat(21), 'longo'],
    ['maria silva', 'espaço'],
    ['joão', 'acento'],
    ['.maria', 'ponto no começo'],
    ['maria.', 'ponto no fim'],
    ['ma..ria', 'dois pontos'],
    ['12345', 'sem letra'],
  ])('barra formato inválido: %s (%s)', (nick) => {
    expect(reason(nick)).toBe('formato');
  });

  it('não diz qual termo barrou', () => {
    const r = checkNickname('hitler');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toMatch(/hitler/i);
  });
});

describe('publicName', () => {
  it('é o apelido, ou "Estudante" sem apelido', () => {
    expect(publicName({ nickname: 'maria' })).toBe('maria');
    expect(publicName({ nickname: null })).toBe('Estudante');
    expect(publicName(null)).toBe('Estudante');
  });
});
