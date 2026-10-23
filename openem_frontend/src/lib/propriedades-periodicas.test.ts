import { describe, expect, it } from 'vitest';
import catalogo from '../data/elementos.json';
import type { Catalogo } from './elementos';
import { escala, estadoNaTemperatura, PASSOS_ESCALA, PROPRIEDADES, TENDENCIAS, tomDaCasa } from './propriedades-periodicas';

const lista = (catalogo as unknown as Catalogo).elementos;
const el = (s: string) => lista.find((e) => e.simbolo === s)!;
const prop = (k: string) => PROPRIEDADES.find((p) => p.key === k)!;

describe('estado físico pela temperatura', () => {
  it('usa os pontos de fusão e ebulição', () => {
    const fe = { fusao: { k: 1811 }, ebulicao: { k: 3134 } };
    expect(estadoNaTemperatura(fe, 298)).toBe('solido');
    expect(estadoNaTemperatura(fe, 1811)).toBe('liquido');
    expect(estadoNaTemperatura(fe, 3133.9)).toBe('liquido');
    expect(estadoNaTemperatura(fe, 3134)).toBe('gasoso');
  });

  it('o mercúrio é líquido a 25 °C e sólido a −40 °C', () => {
    expect(estadoNaTemperatura(el('Hg'), 298.15)).toBe('liquido');
    expect(estadoNaTemperatura(el('Hg'), 233.15)).toBe('solido');
    expect(estadoNaTemperatura(el('Ga'), 310)).toBe('liquido');
  });

  it('desconhecido sem pontos ou com pontos estimados', () => {
    expect(estadoNaTemperatura({ fusao: null, ebulicao: null }, 300)).toBeNull();
    expect(estadoNaTemperatura({ fusao: { k: 300 }, ebulicao: null }, 200)).toBe('solido');
    expect(estadoNaTemperatura({ fusao: { k: 300 }, ebulicao: null }, 400)).toBeNull();
    expect(estadoNaTemperatura({ fusao: { k: 300, estimado: true }, ebulicao: null }, 200)).toBeNull();
    expect(estadoNaTemperatura({ fusao: { k: 300 }, ebulicao: { k: 900, estimado: true } }, 200)).toBeNull();
    expect(estadoNaTemperatura(el('Og'), 300)).toBeNull();
  });

  it('carbono sublima e hélio não solidifica a 1 atm', () => {
    expect(estadoNaTemperatura(el('C'), 3000)).toBe('solido');
    expect(estadoNaTemperatura(el('C'), 5000)).toBe('gasoso');
    expect(estadoNaTemperatura(el('He'), 1)).toBe('liquido');
    expect(estadoNaTemperatura(el('He'), 10)).toBe('gasoso');
    expect(estadoNaTemperatura({ semFusao: 'sublima', fusao: null, ebulicao: null }, 10)).toBeNull();
    expect(estadoNaTemperatura({ semFusao: 'nao-solidifica', fusao: null, ebulicao: null }, 10)).toBeNull();
  });
});

describe('escala do mapa de calor', () => {
  it('divide o intervalo em degraus iguais', () => {
    const s = escala([0, 10, 70, null]);
    expect(s.min).toBe(0);
    expect(s.max).toBe(70);
    expect(s.passo(0)).toBe(0);
    expect(s.passo(9.99)).toBe(0);
    expect(s.passo(10)).toBe(1);
    expect(s.passo(70)).toBe(PASSOS_ESCALA - 1);
    expect(s.passo(35)).toBe(3);
    expect(s.marcas).toHaveLength(PASSOS_ESCALA + 1);
    expect(s.marcas[0]).toBe(0);
    expect(s.marcas[PASSOS_ESCALA]).toBe(70);
  });

  it('desconhecido não ganha cor da escala', () => {
    const s = escala([1, 2, 3]);
    expect(s.passo(null)).toBeNull();
    expect(s.passo(Number.NaN)).toBeNull();
  });

  it('limita valores fora do intervalo às pontas', () => {
    const s = escala([10, 20]);
    expect(s.passo(-5)).toBe(0);
    expect(s.passo(99)).toBe(PASSOS_ESCALA - 1);
  });

  it('em log, ordens de grandeza viram degraus', () => {
    const s = escala([0.0001, 0.001, 1000], true);
    expect(s.log).toBe(true);
    expect(s.passo(0.0001)).toBe(0);
    expect(s.passo(1000)).toBe(PASSOS_ESCALA - 1);
    expect(s.passo(0.1)).toBe(3);
    expect(s.passo(0)).toBeNull();
    expect(s.marcas[0]).toBeCloseTo(0.0001, 8);
  });

  it('com um valor só, tudo no primeiro degrau; sem valor, nada', () => {
    expect(escala([5, 5]).passo(5)).toBe(0);
    expect(escala([null, null]).passo(3)).toBeNull();
  });
});

describe('propriedades da grade', () => {
  it('lê o valor de cada elemento nas unidades da legenda', () => {
    expect(prop('eletronegatividade').valor(el('F'))).toBe(3.98);
    expect(prop('raio').valor(el('H'))).toBe(32);
    expect(prop('energiaIonizacao').valor(el('H'))).toBe(1312);
    expect(prop('densidade').valor(el('Os'))).toBeGreaterThan(22);
    expect(prop('fusao').valor(el('Hg'))).toBe(-39);
    expect(prop('ebulicao').valor(el('He'))).toBe(-269);
  });

  it('afinidade sem ânion estável fica no fundo da escala, desconhecida fica null', () => {
    expect(prop('afinidade').valor(el('N'))).toBe(0);
    expect(prop('afinidade').valor(el('Cl'))).toBe(349);
    expect(prop('afinidade').valor(el('Lv'))).toBeNull();
  });

  it('marca o que é estimado', () => {
    expect(prop('energiaIonizacao').estimado(el('H'))).toBe(false);
    expect(prop('energiaIonizacao').estimado(el('Sg'))).toBe(true);
    expect(prop('eletronegatividade').estimado(el('Fm'))).toBe(true);
    expect(prop('raio').estimado(el('Og'))).toBe(true);
    expect(prop('afinidade').estimado(el('Og'))).toBe(true);
    expect(prop('afinidade').estimado(el('N'))).toBe(false);
    expect(prop('densidade').estimado(el('At'))).toBe(true);
    expect(prop('fusao').estimado(el('Fm'))).toBe(true);
    expect(prop('ebulicao').estimado(el('Fe'))).toBe(false);
  });

  it('as tendências apontam para onde a propriedade cresce', () => {
    const raio = TENDENCIAS.find((t) => t.key === 'raio')!;
    expect([raio.periodo, raio.grupo]).toEqual(['esquerda', 'baixo']);
    for (const k of ['energiaIonizacao', 'eletronegatividade'] as const) {
      const t = TENDENCIAS.find((x) => x.key === k)!;
      expect([t.periodo, t.grupo]).toEqual(['direita', 'cima']);
    }
  });

  it('os dados confirmam as tendências nos grupos e períodos do ENEM', () => {
    const v = (k: string, s: string) => prop(k).valor(el(s))!;
    // Raio cresce para baixo no grupo 1 e diminui ao longo do período 3.
    expect(v('raio', 'Li')).toBeLessThan(v('raio', 'Na'));
    expect(v('raio', 'Na')).toBeLessThan(v('raio', 'K'));
    expect(v('raio', 'Na')).toBeGreaterThan(v('raio', 'Cl'));
    // Energia de ionização: o oposto.
    expect(v('energiaIonizacao', 'Li')).toBeGreaterThan(v('energiaIonizacao', 'Cs'));
    expect(v('energiaIonizacao', 'Na')).toBeLessThan(v('energiaIonizacao', 'Ar'));
    // O flúor é o mais eletronegativo.
    const ens = lista.map((e) => prop('eletronegatividade').valor(e) ?? 0);
    expect(Math.max(...ens)).toBe(v('eletronegatividade', 'F'));
  });
});

describe('tom de cada casa', () => {
  it('categoria e bloco', () => {
    expect(tomDaCasa(el('Na'), { tipo: 'categoria' })).toEqual({ tom: 'alcalino', passo: null, estimado: false });
    expect(tomDaCasa(el('Og'), { tipo: 'categoria' }).estimado).toBe(true);
    expect(tomDaCasa(el('Fe'), { tipo: 'bloco' }).tom).toBe('transicao');
    expect(tomDaCasa(el('Ce'), { tipo: 'bloco' }).tom).toBe('lantanideo');
    expect(tomDaCasa(el('Cl'), { tipo: 'bloco' }).tom).toBe('nao-metal');
    expect(tomDaCasa(el('Ca'), { tipo: 'bloco' }).tom).toBe('alcalino');
  });

  it('estado na temperatura, desconhecido sem tom', () => {
    expect(tomDaCasa(el('Fe'), { tipo: 'estado', kelvin: 298 }).tom).toBe('pos-transicao');
    expect(tomDaCasa(el('Hg'), { tipo: 'estado', kelvin: 298 }).tom).toBe('transicao');
    expect(tomDaCasa(el('O'), { tipo: 'estado', kelvin: 298 }).tom).toBe('alcalino-terroso');
    expect(tomDaCasa(el('Og'), { tipo: 'estado', kelvin: 298 }).tom).toBeNull();
  });

  it('mapa de calor: degrau, estimado e desconhecido', () => {
    const p = PROPRIEDADES.find((x) => x.key === 'eletronegatividade')!;
    const esc = escala(lista.map(p.valor));
    expect(tomDaCasa(el('F'), { tipo: 'calor', propriedade: 'eletronegatividade' }, esc)).toEqual({
      tom: 'calor',
      passo: PASSOS_ESCALA - 1,
      estimado: false,
    });
    expect(tomDaCasa(el('Fm'), { tipo: 'calor', propriedade: 'eletronegatividade' }, esc).estimado).toBe(true);
    expect(tomDaCasa(el('He'), { tipo: 'calor', propriedade: 'eletronegatividade' }, esc)).toEqual({
      tom: null,
      passo: null,
      estimado: false,
    });
    expect(tomDaCasa(el('F'), { tipo: 'calor', propriedade: 'eletronegatividade' }).tom).toBeNull();
  });
});
