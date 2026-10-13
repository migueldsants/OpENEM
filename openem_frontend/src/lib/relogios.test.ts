// Testes do núcleo puro dos cronômetros e timers.
import { describe, it, expect } from 'vitest';
import {
  aTocar,
  decorridoMs,
  duracaoDe,
  fimEm,
  fmtCronometro,
  fmtDuracao,
  fmtTimer,
  iniciar,
  lerRelogios,
  marcarVolta,
  MAX_NOME,
  MAX_RELOGIOS,
  MAX_TIMER_MS,
  MAX_VOLTAS,
  MIN_TIMER_MS,
  nomeLimpo,
  novoCronometro,
  novoTimer,
  parciais,
  pausar,
  proximoFim,
  restanteMs,
  rodando,
  terminou,
  zerar,
  type Relogio,
} from './relogios';

const T0 = 1_000_000;
const crono = (extra: Partial<Relogio> = {}): Relogio => ({
  ...novoCronometro('c1', 'Cronômetro 1'),
  ...extra,
});
const timer = (extra: Partial<Relogio> = {}): Relogio => ({
  ...novoTimer('t1', 'Timer', 60_000),
  ...extra,
});

describe('lib/relogios — criação', () => {
  it('cria um cronômetro parado e zerado', () => {
    expect(novoCronometro('a', 'Meu')).toEqual({
      id: 'a',
      tipo: 'cronometro',
      nome: 'Meu',
      acumuladoMs: 0,
      rodandoDesde: null,
      duracaoMs: null,
      voltas: [],
      tocou: false,
    });
  });

  it('cria um timer com a duração dentro dos limites', () => {
    expect(novoTimer('a', 'T', 90_000)).toMatchObject({
      tipo: 'timer',
      duracaoMs: 90_000,
      rodandoDesde: null,
    });
    expect(novoTimer('a', 'T', 10).duracaoMs).toBe(MIN_TIMER_MS);
    expect(novoTimer('a', 'T', 1e12).duracaoMs).toBe(MAX_TIMER_MS);
    expect(novoTimer('a', 'T', 1500.4).duracaoMs).toBe(1500);
  });

  it('duracaoDe soma minutos e segundos e prende nos limites', () => {
    expect(duracaoDe(5, 0)).toBe(300_000);
    expect(duracaoDe('1', '30')).toBe(90_000);
    expect(duracaoDe(0, 1)).toBe(MIN_TIMER_MS);
    expect(duracaoDe(0, 0)).toBe(MIN_TIMER_MS);
    expect(duracaoDe('abc', 20)).toBe(20_000);
    expect(duracaoDe(2, 'x')).toBe(120_000);
    expect(duracaoDe(99999, 0)).toBe(MAX_TIMER_MS);
    expect(duracaoDe(0.5, 0.4)).toBe(30_000);
  });

  it('nomeLimpo apara, limita e cai no padrão', () => {
    expect(nomeLimpo('  Redação ', 'Timer')).toBe('Redação');
    expect(nomeLimpo('   ', 'Timer')).toBe('Timer');
    expect(nomeLimpo('', 'Timer')).toBe('Timer');
    expect(nomeLimpo('x'.repeat(60), 'Timer')).toHaveLength(MAX_NOME);
  });
});

describe('lib/relogios — cronômetro', () => {
  it('conta a partir do instante em que começou', () => {
    const r = iniciar(crono(), T0);
    expect(r.rodandoDesde).toBe(T0);
    expect(decorridoMs(r, T0)).toBe(0);
    expect(decorridoMs(r, T0 + 4200)).toBe(4200);
    expect(rodando(r, T0 + 4200)).toBe(true);
    expect(terminou(r, T0 + 1e9)).toBe(false);
    expect(restanteMs(r, T0)).toBe(0);
  });

  it('não anda para trás se o relógio do sistema recuar', () => {
    expect(decorridoMs(iniciar(crono(), T0), T0 - 500)).toBe(0);
  });

  it('pausa guardando o acumulado e retoma de onde parou', () => {
    const pausado = pausar(iniciar(crono(), T0), T0 + 3000);
    expect(pausado).toMatchObject({ acumuladoMs: 3000, rodandoDesde: null });
    expect(decorridoMs(pausado, T0 + 99_000)).toBe(3000);
    expect(rodando(pausado, T0 + 99_000)).toBe(false);

    const retomado = iniciar(pausado, T0 + 10_000);
    expect(decorridoMs(retomado, T0 + 12_000)).toBe(5000);
  });

  it('iniciar e pausar repetidos não mudam nada', () => {
    const r = iniciar(crono(), T0);
    expect(iniciar(r, T0 + 500)).toBe(r);
    const parado = crono();
    expect(pausar(parado, T0)).toBe(parado);
  });

  it('marca voltas só enquanto corre', () => {
    const parado = crono();
    expect(marcarVolta(parado, T0)).toBe(parado);

    let r = iniciar(crono(), T0);
    r = marcarVolta(r, T0 + 1000);
    r = marcarVolta(r, T0 + 2500);
    expect(r.voltas).toEqual([1000, 2500]);
    expect(parciais(r.voltas)).toEqual([
      { numero: 1, totalMs: 1000, parcialMs: 1000 },
      { numero: 2, totalMs: 2500, parcialMs: 1500 },
    ]);
    expect(parciais([])).toEqual([]);
  });

  it('para de aceitar voltas no limite', () => {
    const cheio = iniciar(
      crono({ voltas: Array.from({ length: MAX_VOLTAS }, (_, i) => i) }),
      T0,
    );
    expect(marcarVolta(cheio, T0 + 1)).toBe(cheio);
    const quase = { ...cheio, voltas: cheio.voltas.slice(1) };
    expect(marcarVolta(quase, T0 + 1).voltas).toHaveLength(MAX_VOLTAS);
  });

  it('zerar limpa tempo, voltas e o aviso', () => {
    const r = marcarVolta(iniciar(crono({ acumuladoMs: 500 }), T0), T0 + 100);
    expect(zerar({ ...r, tocou: true })).toEqual(crono());
  });
});

describe('lib/relogios — timer', () => {
  it('conta para baixo e para na duração', () => {
    const r = iniciar(timer(), T0);
    expect(restanteMs(r, T0)).toBe(60_000);
    expect(restanteMs(r, T0 + 15_000)).toBe(45_000);
    expect(terminou(r, T0 + 59_999)).toBe(false);
    expect(rodando(r, T0 + 59_999)).toBe(true);

    expect(terminou(r, T0 + 60_000)).toBe(true);
    expect(rodando(r, T0 + 60_000)).toBe(false);
    expect(decorridoMs(r, T0 + 999_000)).toBe(60_000);
    expect(restanteMs(r, T0 + 999_000)).toBe(0);
  });

  it('não reinicia sozinho depois de acabar', () => {
    const acabado = pausar(iniciar(timer(), T0), T0 + 70_000);
    expect(acabado).toMatchObject({ acumuladoMs: 60_000, rodandoDesde: null });
    expect(iniciar(acabado, T0 + 80_000)).toBe(acabado);
  });

  it('não marca volta', () => {
    const r = iniciar(timer(), T0);
    expect(marcarVolta(r, T0 + 10)).toBe(r);
  });

  it('fimEm desconta o que já correu antes da pausa', () => {
    expect(fimEm(timer())).toBeNull();
    expect(fimEm(iniciar(crono(), T0))).toBeNull();
    expect(fimEm(iniciar(timer(), T0))).toBe(T0 + 60_000);
    expect(fimEm(iniciar(timer({ acumuladoMs: 20_000 }), T0))).toBe(
      T0 + 40_000,
    );
  });

  it('proximoFim pega o timer que acaba primeiro e ignora o resto', () => {
    const lista = [
      iniciar(crono(), T0),
      timer({ id: 'parado' }),
      iniciar(timer({ id: 'longo', duracaoMs: 300_000 }), T0),
      iniciar(timer({ id: 'curto', duracaoMs: 30_000 }), T0),
    ];
    expect(proximoFim(lista, T0)).toBe(T0 + 30_000);
    // O curto já passou: sobra o longo.
    expect(proximoFim(lista, T0 + 30_000)).toBe(T0 + 300_000);
    expect(proximoFim(lista, T0 + 300_000)).toBeNull();
    expect(proximoFim([], T0)).toBeNull();
  });

  it('aTocar lista os que acabaram e ainda não avisaram', () => {
    const lista = [
      iniciar(crono(), T0),
      iniciar(timer({ id: 'a', duracaoMs: 10_000 }), T0),
      iniciar(timer({ id: 'b', duracaoMs: 10_000, tocou: true }), T0),
      iniciar(timer({ id: 'c', duracaoMs: 50_000 }), T0),
    ];
    expect(aTocar(lista, T0 + 9_999)).toEqual([]);
    expect(aTocar(lista, T0 + 10_000).map((r) => r.id)).toEqual(['a']);
  });
});

describe('lib/relogios — lerRelogios', () => {
  it('lê de volta o que foi salvo', () => {
    const lista = [
      marcarVolta(iniciar(crono(), T0), T0 + 700),
      { ...iniciar(timer(), T0), tocou: true },
    ];
    expect(lerRelogios(JSON.stringify(lista))).toEqual(lista);
  });

  it('devolve lista vazia para vazio, JSON quebrado ou formato errado', () => {
    expect(lerRelogios(null)).toEqual([]);
    expect(lerRelogios('')).toEqual([]);
    expect(lerRelogios('{')).toEqual([]);
    expect(lerRelogios('{}')).toEqual([]);
    expect(lerRelogios('null')).toEqual([]);
  });

  it('descarta itens inválidos e mantém os bons', () => {
    const bom = crono();
    const ruins = [
      null,
      'texto',
      { ...bom, id: '' },
      { ...bom, id: 7 },
      { ...bom, tipo: 'pomodoro' },
      { ...bom, acumuladoMs: '5' },
      { ...bom, acumuladoMs: -1 },
      { ...bom, rodandoDesde: 'agora' },
      { ...timer(), duracaoMs: null },
    ];
    expect(lerRelogios(JSON.stringify([...ruins, bom]))).toEqual([bom]);
  });

  it('conserta campos soltos em vez de descartar o relógio', () => {
    const [c, t] = lerRelogios(
      JSON.stringify([
        { ...crono(), nome: 5, voltas: [100, 'x', 300], tocou: true },
        { ...timer(), nome: '  ', voltas: [1], tocou: 'sim', duracaoMs: 5 },
      ]),
    );
    expect(c).toMatchObject({
      nome: 'Cronômetro',
      voltas: [100, 300],
      tocou: false,
    });
    expect(t).toMatchObject({
      nome: 'Timer',
      voltas: [],
      tocou: false,
      duracaoMs: MIN_TIMER_MS,
    });
    expect(lerRelogios(JSON.stringify([{ ...crono(), voltas: 'x' }]))).toEqual(
      [crono()],
    );
  });

  it('corta a lista e as voltas nos limites', () => {
    const muitos = Array.from({ length: MAX_RELOGIOS + 3 }, (_, i) =>
      crono({ id: `c${i}` }),
    );
    expect(lerRelogios(JSON.stringify(muitos))).toHaveLength(MAX_RELOGIOS);
    const voltas = Array.from({ length: MAX_VOLTAS + 5 }, (_, i) => i);
    expect(
      lerRelogios(JSON.stringify([crono({ voltas })]))[0].voltas,
    ).toHaveLength(MAX_VOLTAS);
  });
});

describe('lib/relogios — formatação', () => {
  it('fmtCronometro mostra décimos, sempre para baixo', () => {
    expect(fmtCronometro(0)).toBe('0:00.0');
    expect(fmtCronometro(999)).toBe('0:00.9');
    expect(fmtCronometro(65_432)).toBe('1:05.4');
    expect(fmtCronometro(3_600_000)).toBe('1:00:00.0');
    expect(fmtCronometro(3_725_950)).toBe('1:02:05.9');
    expect(fmtCronometro(-50)).toBe('0:00.0');
  });

  it('fmtTimer arredonda para cima e só zera no fim', () => {
    expect(fmtTimer(60_000)).toBe('1:00');
    expect(fmtTimer(4_200)).toBe('0:05');
    expect(fmtTimer(1)).toBe('0:01');
    expect(fmtTimer(0)).toBe('0:00');
    expect(fmtTimer(-10)).toBe('0:00');
    expect(fmtTimer(3_600_000)).toBe('1:00:00');
    expect(fmtTimer(5_400_000)).toBe('1:30:00');
  });

  it('fmtDuracao escreve por extenso', () => {
    expect(fmtDuracao(45_000)).toBe('45 s');
    expect(fmtDuracao(60_000)).toBe('1 min');
    expect(fmtDuracao(90_000)).toBe('1 min 30 s');
    expect(fmtDuracao(3_600_000)).toBe('1h');
    expect(fmtDuracao(5_400_000)).toBe('1h30');
    expect(fmtDuracao(3_900_000)).toBe('1h05');
  });
});
