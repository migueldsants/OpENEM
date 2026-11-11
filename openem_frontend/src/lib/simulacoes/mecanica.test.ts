import { describe, expect, it } from 'vitest';
import {
  amplitudeForcada,
  coeficienteArrasto,
  derivadaMola,
  derivadaPendulo,
  descidaPlano,
  energiaPendulo,
  equilibrioEmpuxo,
  forcasEmpuxo,
  forcasPlano,
  lancamentoIdeal,
  medirPeriodo,
  molaLivreAnalitica,
  passoEmpuxo,
  periodoExato,
  periodoPequenasOscilacoes,
  PROJETEIS,
  regimeAmortecimento,
  simularLancamento,
} from './mecanica';
import { avancar, rk4 } from './numerico';

describe('lançamento oblíquo', () => {
  it('sem arrasto, o integrador bate com as fórmulas (alcance, altura e tempo)', () => {
    const p = { v0: 20, anguloGraus: 35, h0: 1.5, g: 9.81 };
    const num = simularLancamento({ ...p, k: 0 });
    const ana = lancamentoIdeal(p);
    expect(num.alcance).toBeCloseTo(ana.alcance, 3);
    expect(num.alturaMax).toBeCloseTo(ana.alturaMax, 3);
    expect(num.tempoVoo).toBeCloseTo(ana.tempoVoo, 3);
  });

  it('do chão e sem ar, 45° dá o maior alcance e ângulos complementares empatam', () => {
    const alc = (a: number) => lancamentoIdeal({ v0: 15, anguloGraus: a, h0: 0, g: 9.81 }).alcance;
    expect(alc(45)).toBeCloseTo((15 * 15) / 9.81, 6);
    expect(alc(30)).toBeCloseTo(alc(60), 6);
    for (const a of [20, 40, 50, 70]) expect(alc(a)).toBeLessThan(alc(45));
  });

  it('sem arrasto a energia mecânica se conserva ao longo do voo', () => {
    const g = 9.81;
    const t = simularLancamento({ v0: 25, anguloGraus: 60, h0: 0, g, k: 0 });
    const e0 = 0.5 * 25 * 25;
    for (const p of t.pontos) {
      expect(0.5 * (p.vx ** 2 + p.vy ** 2) + g * p.y).toBeCloseTo(e0, 5);
    }
  });

  it('o ar encurta o voo, e o melhor ângulo cai para menos de 45°', () => {
    const k = coeficienteArrasto(PROJETEIS[1]);
    const comAr = (a: number) => simularLancamento({ v0: 30, anguloGraus: a, h0: 0, g: 9.81, k }, 0.002).alcance;
    const semAr = lancamentoIdeal({ v0: 30, anguloGraus: 45, h0: 0, g: 9.81 }).alcance;
    expect(comAr(45)).toBeLessThan(semAr * 0.8);
    expect(comAr(38)).toBeGreaterThan(comAr(45));
  });

  it('o coeficiente de arrasto da bola de futebol tem a ordem de grandeza real', () => {
    // ½·1,225·0,25·π·0,11²/0,43 ≈ 0,0135 1/m
    expect(coeficienteArrasto(PROJETEIS[0])).toBeCloseTo(0.01354, 4);
  });
});

describe('pêndulo simples', () => {
  const g = 9.81;
  const L = 1;

  it('em ângulo pequeno o período é 2π√(L/g)', () => {
    const T = medirPeriodo(derivadaPendulo(g, L, 0), [0.02, 0]);
    expect(T).toBeCloseTo(periodoPequenasOscilacoes(L, g), 3);
  });

  it('a 90° o período é 18% maior (integral elíptica), e o integrador concorda', () => {
    const T0 = periodoPequenasOscilacoes(L, g);
    const T90 = periodoExato(L, g, Math.PI / 2);
    expect(T90 / T0).toBeCloseTo(1.18034, 4);
    expect(medirPeriodo(derivadaPendulo(g, L, 0), [Math.PI / 2, 0])).toBeCloseTo(T90, 3);
  });

  it('sem amortecimento a energia se conserva por 100 s', () => {
    const f = derivadaPendulo(g, L, 0);
    let s = [1.2, 0];
    const e0 = energiaPendulo(1, g, L, s[0], s[1]).total;
    for (let i = 0; i < 100; i++) s = avancar(f, 0, s, 1, 1e-3).y;
    expect(energiaPendulo(1, g, L, s[0], s[1]).total / e0).toBeCloseTo(1, 6);
  });

  it('com amortecimento a amplitude cai', () => {
    const f = derivadaPendulo(g, L, 0.3);
    const s = avancar(f, 0, [0.5, 0], 20, 1e-3).y;
    expect(energiaPendulo(1, g, L, s[0], s[1]).total).toBeLessThan(energiaPendulo(1, g, L, 0.5, 0).total * 0.01);
  });
});

describe('massa-mola', () => {
  it('livre e sem atrito: x(t) = x0·cos(ω0 t)', () => {
    const p = { m: 0.5, k: 20, c: 0, F0: 0, omegaF: 0 };
    const w = Math.sqrt(p.k / p.m);
    const r = avancar(derivadaMola(p), 0, [0.1, 0], 3.7, 1e-3);
    expect(r.y[0]).toBeCloseTo(0.1 * Math.cos(w * 3.7), 6);
  });

  it('subamortecido segue a solução analítica', () => {
    const p = { m: 1, k: 40, c: 1.5, F0: 0, omegaF: 0 };
    const r = avancar(derivadaMola(p), 0, [0.2, 0], 2.3, 1e-3);
    expect(r.y[0]).toBeCloseTo(molaLivreAnalitica(p, 0.2, 2.3), 6);
  });

  it('classifica o regime de amortecimento', () => {
    expect(regimeAmortecimento({ m: 1, k: 4, c: 0 }).nome).toBe('sem amortecimento');
    expect(regimeAmortecimento({ m: 1, k: 4, c: 1 }).nome).toBe('subamortecido');
    expect(regimeAmortecimento({ m: 1, k: 4, c: 4 }).nome).toBe('amortecimento crítico');
    expect(regimeAmortecimento({ m: 1, k: 4, c: 9 }).nome).toBe('superamortecido');
  });

  it('forçado: depois do transitório a amplitude é F0/√((k−mω²)² + (cω)²)', () => {
    const p = { m: 1, k: 25, c: 0.8, F0: 2, omegaF: 4.2 };
    const f = derivadaMola(p);
    let s: number[] = [0, 0];
    let t = 0;
    const h = 1e-3;
    while (t < 40) {
      s = rk4(f, t, s, h);
      t += h;
    }
    let max = 0;
    while (t < 50) {
      s = rk4(f, t, s, h);
      t += h;
      max = Math.max(max, Math.abs(s[0]));
    }
    expect(max).toBeCloseTo(amplitudeForcada(p), 4);
  });

  it('na ressonância a amplitude é muito maior do que longe dela', () => {
    const base = { m: 1, k: 25, c: 0.4, F0: 1 };
    expect(amplitudeForcada({ ...base, omegaF: 5 })).toBeGreaterThan(10 * amplitudeForcada({ ...base, omegaF: 1 }));
  });
});

describe('plano inclinado', () => {
  const g = 9.81;
  it('fica parado enquanto tg θ ≤ μe, e o atrito estático iguala Px', () => {
    const p = { anguloGraus: 20, m: 2, muE: 0.4, muC: 0.3, g };
    const f = forcasPlano(p);
    expect(Math.tan((20 * Math.PI) / 180)).toBeLessThan(0.4);
    expect(f.parado).toBe(true);
    expect(f.atrito).toBeCloseTo(f.px, 10);
    expect(f.aceleracao).toBe(0);
    expect(f.anguloCritico).toBeCloseTo(21.80, 2);
  });

  it('acima do ângulo crítico, a = g(sen θ − μc cos θ)', () => {
    const p = { anguloGraus: 35, m: 3, muE: 0.4, muC: 0.25, g };
    const th = (35 * Math.PI) / 180;
    const f = forcasPlano(p);
    expect(f.parado).toBe(false);
    expect(f.aceleracao).toBeCloseTo(g * (Math.sin(th) - 0.25 * Math.cos(th)), 10);
    expect(f.normal).toBeCloseTo(3 * g * Math.cos(th), 10);
  });

  it('sem atrito a = g sen θ e a massa não importa', () => {
    const a = (m: number) => forcasPlano({ anguloGraus: 30, m, muE: 0, muC: 0, g }).aceleracao;
    expect(a(1)).toBeCloseTo(g / 2, 10);
    expect(a(50)).toBeCloseTo(g / 2, 10);
    const d = descidaPlano({ anguloGraus: 30, m: 1, muE: 0, muC: 0, g }, 4);
    expect(d.velocidade).toBeCloseTo(Math.sqrt(2 * g * 2), 10); // h = 2 m
  });

  it('μc maior que μe é tratado como μe', () => {
    const f = forcasPlano({ anguloGraus: 40, m: 1, muE: 0.3, muC: 0.9, g });
    expect(f.atrito).toBeCloseTo(0.3 * f.normal, 10);
  });
});

describe('empuxo', () => {
  const g = 9.81;
  it('madeira na água flutua com fração submersa ρc/ρf', () => {
    const e = equilibrioEmpuxo({ aresta: 0.2, rhoCorpo: 500, rhoFluido: 997, g });
    expect(e.flutua).toBe(true);
    expect(e.fracaoSubmersa).toBeCloseTo(500 / 997, 10);
  });

  it('cerca de 90% do gelo fica submerso na água', () => {
    expect(equilibrioEmpuxo({ aresta: 1, rhoCorpo: 917, rhoFluido: 997, g }).fracaoSubmersa).toBeCloseTo(0.92, 2);
  });

  it('ferro afunda na água, mas flutua no mercúrio', () => {
    expect(equilibrioEmpuxo({ aresta: 0.1, rhoCorpo: 7870, rhoFluido: 997, g }).flutua).toBe(false);
    expect(equilibrioEmpuxo({ aresta: 0.1, rhoCorpo: 7870, rhoFluido: 13534, g }).flutua).toBe(true);
  });

  it('E = ρ·g·V_sub e o peso aparente é P − E', () => {
    const p = { aresta: 0.1, rhoCorpo: 2700, rhoFluido: 997, g };
    const f = forcasEmpuxo(p, 1); // totalmente submerso
    expect(f.empuxo).toBeCloseTo(997 * g * 0.001, 10);
    expect(f.pesoAparente).toBeCloseTo((2700 - 997) * g * 0.001, 10);
  });

  it('solto acima da água, o corpo que flutua se acomoda na profundidade de equilíbrio', () => {
    const p = { aresta: 0.2, rhoCorpo: 600, rhoFluido: 997, g };
    let s = [-0.3, 0];
    for (let i = 0; i < 1200; i++) s = passoEmpuxo(p, s, 1 / 60, 2);
    expect(s[0]).toBeCloseTo(0.2 * (600 / 997), 3);
  });

  it('o corpo mais denso desce até o fundo', () => {
    const p = { aresta: 0.1, rhoCorpo: 2700, rhoFluido: 997, g };
    let s = [0, 0];
    for (let i = 0; i < 600; i++) s = passoEmpuxo(p, s, 1 / 60, 1);
    expect(s[0]).toBe(1);
  });
});
