// Testes do núcleo puro do quadro da sala (simulado no papel).
import { describe, it, expect } from 'vitest';
import {
  avisos,
  clampSessao,
  estadoDoQuadro,
  fmtHora,
  fmtMarca,
  lerSessao,
  marcas,
  MAX_DURACAO,
  MIN_DURACAO,
  type QuadroSessao,
} from './quadro-prova';

const MIN = 60_000;
// Data local, para o teste não depender do fuso da máquina.
const INICIO = new Date(2026, 10, 8, 13, 30, 0).getTime();
const DIA1: QuadroSessao = {
  startedAt: INICIO,
  durationMin: 330,
  intervalMin: 30,
};

describe('lib/quadro-prova — marcas', () => {
  it('lista a duração e os múltiplos do intervalo, da maior para a menor', () => {
    expect(marcas(330, 30)).toEqual([
      330, 300, 270, 240, 210, 180, 150, 120, 90, 60, 30,
    ]);
    expect(marcas(300, 60)).toEqual([300, 240, 180, 120, 60]);
  });

  it('não repete a duração quando ela já é múltipla do intervalo', () => {
    expect(marcas(60, 30)).toEqual([60, 30]);
  });

  it('encaixa uma duração quebrada antes do primeiro múltiplo', () => {
    expect(marcas(100, 30)).toEqual([100, 90, 60, 30]);
  });

  it('fica só com a duração quando ela é menor que o intervalo', () => {
    expect(marcas(20, 30)).toEqual([20]);
    expect(marcas(30, 30)).toEqual([30]);
  });
});

describe('lib/quadro-prova — estadoDoQuadro', () => {
  it('começa com a duração inteira e nada apagado', () => {
    expect(estadoDoQuadro(DIA1, INICIO)).toEqual({
      restanteSec: 330 * 60,
      encerrado: false,
      marcaAtual: 330,
      atualizadoEm: INICIO,
      apagadas: 0,
    });
  });

  it('mantém a marca parada entre duas atualizações', () => {
    const e = estadoDoQuadro(DIA1, INICIO + 29 * MIN + 59_000);
    expect(e.marcaAtual).toBe(330);
    expect(e.apagadas).toBe(0);
    expect(e.restanteSec).toBe(300 * 60 + 1);
  });

  it('apaga a marca exatamente quando o intervalo fecha', () => {
    const e = estadoDoQuadro(DIA1, INICIO + 30 * MIN);
    expect(e.marcaAtual).toBe(300);
    expect(e.apagadas).toBe(1);
    expect(e.atualizadoEm).toBe(INICIO + 30 * MIN);
  });

  it('chega à última marca na reta final', () => {
    const e = estadoDoQuadro(DIA1, INICIO + 329 * MIN);
    expect(e.marcaAtual).toBe(30);
    expect(e.apagadas).toBe(10);
    expect(e.encerrado).toBe(false);
    expect(e.atualizadoEm).toBe(INICIO + 300 * MIN);
  });

  it('encerra no fim do tempo, com tudo apagado', () => {
    for (const agora of [INICIO + 330 * MIN, INICIO + 400 * MIN]) {
      expect(estadoDoQuadro(DIA1, agora)).toEqual({
        restanteSec: 0,
        encerrado: true,
        marcaAtual: null,
        atualizadoEm: INICIO + 330 * MIN,
        apagadas: 11,
      });
    }
  });

  it('trata relógio antes do início como início', () => {
    const e = estadoDoQuadro(DIA1, INICIO - 5 * MIN);
    expect(e.restanteSec).toBe(330 * 60);
    expect(e.marcaAtual).toBe(330);
  });

  it('respeita a primeira marca quebrada', () => {
    const s = { startedAt: INICIO, durationMin: 100, intervalMin: 30 };
    expect(estadoDoQuadro(s, INICIO + 9 * MIN).marcaAtual).toBe(100);
    const e = estadoDoQuadro(s, INICIO + 10 * MIN);
    expect(e.marcaAtual).toBe(90);
    expect(e.atualizadoEm).toBe(INICIO + 10 * MIN);
  });
});

describe('lib/quadro-prova — avisos', () => {
  it('calcula saída (2h depois) e caderno (últimos 30 min)', () => {
    const a = avisos(DIA1, INICIO);
    expect(a.map((x) => [x.key, x.em, x.liberado])).toEqual([
      ['saida', INICIO + 120 * MIN, false],
      ['caderno', INICIO + 300 * MIN, false],
    ]);
    expect(a[0].texto).toBe('Saída da sala');
    expect(a[1].texto).toBe('Levar o caderno de questões');
  });

  it('libera cada um no seu horário, inclusive no instante exato', () => {
    expect(avisos(DIA1, INICIO + 120 * MIN - 1).map((x) => x.liberado)).toEqual(
      [false, false],
    );
    expect(avisos(DIA1, INICIO + 120 * MIN).map((x) => x.liberado)).toEqual([
      true,
      false,
    ]);
    expect(avisos(DIA1, INICIO + 300 * MIN - 1)[1].liberado).toBe(false);
    expect(avisos(DIA1, INICIO + 300 * MIN)[1].liberado).toBe(true);
  });

  it('some em simulado curto, onde a regra não se aplica', () => {
    expect(avisos({ ...DIA1, durationMin: 179 }, INICIO)).toEqual([]);
    expect(avisos({ ...DIA1, durationMin: 180 }, INICIO)).toHaveLength(2);
  });
});

describe('lib/quadro-prova — clampSessao', () => {
  it('mantém valores válidos', () => {
    expect(clampSessao(DIA1)).toEqual(DIA1);
    expect(clampSessao({ ...DIA1, durationMin: MIN_DURACAO })).toMatchObject({
      durationMin: MIN_DURACAO,
    });
    expect(clampSessao({ ...DIA1, durationMin: MAX_DURACAO })).toMatchObject({
      durationMin: MAX_DURACAO,
    });
  });

  it('prende a duração nos limites e arredonda', () => {
    expect(clampSessao({ ...DIA1, durationMin: 1 }).durationMin).toBe(
      MIN_DURACAO,
    );
    expect(clampSessao({ ...DIA1, durationMin: 9999 }).durationMin).toBe(
      MAX_DURACAO,
    );
    expect(clampSessao({ ...DIA1, durationMin: 90.6 }).durationMin).toBe(91);
    expect(clampSessao({ ...DIA1, durationMin: '120' }).durationMin).toBe(120);
  });

  it('cai no padrão quando o valor não é número', () => {
    expect(clampSessao({ ...DIA1, durationMin: 'abc' }).durationMin).toBe(330);
    expect(clampSessao({ ...DIA1, intervalMin: 7 }).intervalMin).toBe(30);
    expect(clampSessao({ ...DIA1, intervalMin: '15' }).intervalMin).toBe(15);
    expect(clampSessao({ ...DIA1, intervalMin: 60 }).intervalMin).toBe(60);
  });
});

describe('lib/quadro-prova — lerSessao', () => {
  it('lê uma sessão salva', () => {
    expect(lerSessao(JSON.stringify(DIA1), INICIO)).toEqual(DIA1);
  });

  it('devolve null para vazio, JSON quebrado ou campos errados', () => {
    expect(lerSessao(null, INICIO)).toBeNull();
    expect(lerSessao('', INICIO)).toBeNull();
    expect(lerSessao('{', INICIO)).toBeNull();
    expect(lerSessao('null', INICIO)).toBeNull();
    expect(lerSessao('{}', INICIO)).toBeNull();
    expect(
      lerSessao(JSON.stringify({ ...DIA1, startedAt: 'ontem' }), INICIO),
    ).toBeNull();
    expect(
      lerSessao(JSON.stringify({ ...DIA1, startedAt: null }), INICIO),
    ).toBeNull();
    expect(
      lerSessao(JSON.stringify({ ...DIA1, durationMin: '330' }), INICIO),
    ).toBeNull();
    expect(
      lerSessao(JSON.stringify({ ...DIA1, intervalMin: '30' }), INICIO),
    ).toBeNull();
  });

  it('normaliza valores fora dos limites', () => {
    expect(
      lerSessao(JSON.stringify({ ...DIA1, durationMin: 5000 }), INICIO),
    ).toMatchObject({ durationMin: MAX_DURACAO });
  });

  it('descarta um quadro que terminou há mais de 6 horas', () => {
    const fim = INICIO + 330 * MIN;
    const raw = JSON.stringify(DIA1);
    expect(lerSessao(raw, fim + 6 * 60 * MIN)).toEqual(DIA1);
    expect(lerSessao(raw, fim + 6 * 60 * MIN + 1)).toBeNull();
  });
});

describe('lib/quadro-prova — formatação', () => {
  it('fmtMarca escreve como no quadro', () => {
    expect(fmtMarca(330)).toBe('5h30');
    expect(fmtMarca(300)).toBe('5h');
    expect(fmtMarca(65)).toBe('1h05');
    expect(fmtMarca(60)).toBe('1h');
    expect(fmtMarca(45)).toBe('45 min');
  });

  it('fmtHora usa o horário local com minutos em dois dígitos', () => {
    expect(fmtHora(INICIO)).toBe('13h30');
    expect(fmtHora(new Date(2026, 10, 8, 9, 5).getTime())).toBe('9h05');
    expect(fmtHora(new Date(2026, 10, 8, 19, 0).getTime())).toBe('19h00');
  });
});
