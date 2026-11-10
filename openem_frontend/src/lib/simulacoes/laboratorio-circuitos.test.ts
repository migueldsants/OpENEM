import { describe, expect, it } from 'vitest';
import {
  brilho,
  chaveAresta,
  chavePonto,
  montagem,
  QUEIMA,
  R_FIO,
  R_INTERNA,
  resistenciaEquivalente,
  resistenciaLampada,
  resolverComQueima,
  resolverLab,
  saoVizinhos,
  type Peca,
  type Ponto,
} from './laboratorio-circuitos';

let n = 0;
const p = (tipo: Peca['tipo'], a: Ponto, b: Ponto, extra: Partial<Peca> = {}): Peca => ({ id: `t${++n}`, tipo, a, b, ...extra });

/** Laço retangular: bateria de (0,1)→(0,0) e o resto por `meio`, voltando por baixo. */
function laco(meio: Peca[], eps = 6): { bateria: Peca; pecas: Peca[] } {
  const bateria = p('bateria', [0, 1], [0, 0], { valor: eps });
  return { bateria, pecas: [bateria, ...meio] };
}

describe('laboratório de circuitos', () => {
  it('aresta e vizinhança', () => {
    expect(chaveAresta([1, 2], [2, 2])).toBe(chaveAresta([2, 2], [1, 2]));
    expect(saoVizinhos([1, 1], [1, 2])).toBe(true);
    expect(saoVizinhos([1, 1], [2, 2])).toBe(false);
  });

  it('um resistor: lei de Ohm com a resistência interna (U = ε − r·i)', () => {
    const R = p('resistor', [0, 0], [1, 0], { valor: 10 });
    const { bateria, pecas } = laco([R, p('fio', [1, 0], [1, 1]), p('fio', [1, 1], [0, 1])], 12);
    const r = resolverLab(pecas);
    const i = 12 / (10 + R_INTERNA + 2 * R_FIO);
    expect(r.correntes[bateria.id]).toBeCloseTo(i, 4);
    expect(r.correntes[R.id]).toBeCloseTo(i, 4);
    expect(r.tensoes[bateria.id]).toBeCloseTo(12 - R_INTERNA * i, 3);
    expect(r.potencias[R.id]).toBeCloseTo(i * i * 10, 3);
    expect(resistenciaEquivalente(bateria, r)).toBeCloseTo(10, 1);
    expect(r.curto).toBe(false);
  });

  it('série e paralelo: Req = soma e Req = produto/soma, e Kirchhoff nos nós', () => {
    const r1 = p('resistor', [0, 0], [1, 0], { valor: 4 });
    const r2 = p('resistor', [1, 0], [2, 0], { valor: 6 });
    const serie = laco([r1, r2, p('fio', [2, 0], [2, 1]), p('fio', [2, 1], [1, 1]), p('fio', [1, 1], [0, 1])]);
    const rs = resolverLab(serie.pecas);
    expect(resistenciaEquivalente(serie.bateria, rs)).toBeCloseTo(10, 1);
    expect(rs.correntes[r1.id]).toBeCloseTo(rs.correntes[r2.id], 6);

    const a = p('resistor', [1, 0], [1, 1], { valor: 4 });
    const b = p('resistor', [2, 0], [2, 1], { valor: 6 });
    const par = laco([p('fio', [0, 0], [1, 0]), p('fio', [1, 0], [2, 0]), a, b, p('fio', [2, 1], [1, 1]), p('fio', [1, 1], [0, 1])]);
    const rp = resolverLab(par.pecas);
    expect(resistenciaEquivalente(par.bateria, rp)).toBeCloseTo(2.4, 1);
    // Nó (1,1): a corrente que chega pelos dois resistores sai pelo fio.
    expect(rp.correntes[a.id] + rp.correntes[b.id]).toBeCloseTo(rp.correntes[par.bateria.id], 4);
    // Em paralelo, a mesma tensão; a corrente se divide na razão inversa das resistências.
    expect(rp.correntes[a.id] / rp.correntes[b.id]).toBeCloseTo(6 / 4, 2); // o fio a mais de um ramo tem 1 mΩ
  });

  it('chave aberta e voltímetro não conduzem; amperímetro lê a corrente do ramo', () => {
    const chave = p('chave', [0, 0], [1, 0], { fechada: false });
    const lamp = p('lampada', [1, 0], [1, 1], { valor: 6 });
    const amp = p('amperimetro', [1, 1], [0, 1]);
    const { bateria, pecas } = laco([chave, lamp, amp]);
    expect(resolverLab(pecas).correntes[bateria.id]).toBeCloseTo(0, 6);
    const fechado = pecas.map((x) => (x.id === chave.id ? { ...x, fechada: true } : x));
    const r = resolverLab(fechado);
    const i = 6 / (resistenciaLampada(6) + R_INTERNA + 2 * R_FIO);
    expect(r.correntes[amp.id]).toBeCloseTo(i, 4);
    // Voltímetro em paralelo com a lâmpada: lê a tensão dela e não muda a corrente.
    const volt = p('voltimetro', [1, 0], [1, 1]);
    const comVolt = resolverLab([...fechado, volt]);
    expect(Math.abs(comVolt.tensoes[volt.id])).toBeCloseTo(i * resistenciaLampada(6), 3);
    expect(comVolt.correntes[amp.id]).toBeCloseTo(i, 6);
  });

  it('fio ligando os polos é curto-circuito', () => {
    const { pecas } = laco([p('fio', [0, 0], [1, 0]), p('fio', [1, 0], [1, 1]), p('fio', [1, 1], [0, 1])]);
    expect(resolverLab(pecas).curto).toBe(true);
  });

  it('lâmpada além do limite queima e abre o ramo', () => {
    // 6 W / 6 V numa bateria de 12 V: 4× a potência nominal.
    const lamp = p('lampada', [0, 0], [1, 0], { valor: 6 });
    const { bateria, pecas } = laco([lamp, p('fio', [1, 0], [1, 1]), p('fio', [1, 1], [0, 1])], 12);
    const { pecas: depois, resultado, queimaram } = resolverComQueima(pecas);
    expect(queimaram).toEqual([lamp.id]);
    expect(depois.find((x) => x.id === lamp.id)?.queimada).toBe(true);
    expect(resultado.correntes[bateria.id]).toBeCloseTo(0, 6);
    expect(QUEIMA).toBeGreaterThan(1);
  });

  it('montagens prontas: em paralelo as lâmpadas brilham mais que em série', () => {
    for (const m of ['serie', 'paralelo', 'misto'] as const) {
      const pecas = montagem(m);
      for (const x of pecas) expect(saoVizinhos(x.a, x.b), `${m} ${x.tipo}`).toBe(true);
      // Uma peça por aresta.
      const arestas = pecas.map((x) => chaveAresta(x.a, x.b));
      expect(new Set(arestas).size, m).toBe(arestas.length);
      const { queimaram } = resolverComQueima(pecas);
      expect(queimaram, m).toEqual([]);
    }
    const media = (m: 'serie' | 'paralelo') => {
      const pecas = montagem(m);
      const r = resolverLab(pecas);
      const lamps = pecas.filter((x) => x.tipo === 'lampada');
      return lamps.reduce((s, l) => s + brilho(l, r), 0) / lamps.length;
    };
    expect(media('paralelo')).toBeGreaterThan(2 * media('serie'));
    // Na série, o amperímetro lê a mesma corrente das lâmpadas.
    const serie = montagem('serie');
    const r = resolverLab(serie);
    const amp = serie.find((x) => x.tipo === 'amperimetro')!;
    const lamp = serie.find((x) => x.tipo === 'lampada')!;
    expect(Math.abs(r.correntes[amp.id])).toBeCloseTo(Math.abs(r.correntes[lamp.id]), 4);
    expect(Object.keys(r.potenciais)).toContain(chavePonto(amp.a));
  });
});
