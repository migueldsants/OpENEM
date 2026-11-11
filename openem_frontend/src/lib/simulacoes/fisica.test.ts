import { describe, expect, it } from 'vitest';
import {
  montarCircuito,
  paralelo,
  PARTICULAS,
  passoBoris,
  periodoCiclotron,
  raioCiclotron,
  resistenciaLampada,
  resolverCircuito,
  resolverLinear,
  serie,
  velocidadeInicial,
  type Vec3,
} from './eletromagnetismo';
import {
  avancarCorpo,
  elementosOrbita,
  energiaEspecifica,
  momentoAngular,
  PLANETAS,
  periodoKepler,
  posicaoPlaneta,
  resolverKepler,
  vCircular,
  vEscape,
  visViva,
  type Corpo,
} from './gravitacao';
import {
  anguloCritico,
  anguloMach,
  comprimentosDoppler,
  focoComSinal,
  formarImagem,
  frentesDeOnda,
  frequenciaDoppler,
  refratar,
  velocidadeSom,
} from './optica-ondas';

describe('circuitos (análise nodal)', () => {
  it('resolve um sistema linear com pivotamento', () => {
    const x = resolverLinear([[0, 2, 1], [1, 1, 1], [2, 1, 0]], [7, 6, 4]);
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(2, 12);
    expect(x[2]).toBeCloseTo(3, 12);
  });

  it('série: Req = soma, a mesma corrente em todas e as tensões somam V', () => {
    const r = resolverCircuito(montarCircuito('serie', 12, [10, 20, 30]));
    expect(r.resistenciaEquivalente).toBeCloseTo(serie(10, 20, 30), 6);
    for (const id of ['R1', 'R2', 'R3']) expect(r.correntes[id]).toBeCloseTo(0.2, 9);
    expect(r.tensoes.R1 + r.tensoes.R2 + r.tensoes.R3).toBeCloseTo(12, 9);
  });

  it('paralelo: cada lâmpada recebe a tensão toda e as correntes somam', () => {
    const r = resolverCircuito(montarCircuito('paralelo', 12, [10, 20, 30]));
    expect(r.resistenciaEquivalente).toBeCloseTo(paralelo(10, 20, 30), 6);
    expect(r.tensoes.R2).toBeCloseTo(12, 9);
    expect(r.correnteFonte).toBeCloseTo(1.2 + 0.6 + 0.4, 9);
  });

  it('misto: R1 + (R2 ∥ R3), com a lei dos nós no nó do meio', () => {
    const r = resolverCircuito(montarCircuito('misto', 9, [4, 6, 3]));
    expect(r.resistenciaEquivalente).toBeCloseTo(4 + 2, 6);
    expect(r.correntes.R1).toBeCloseTo(r.correntes.R2 + r.correntes.R3, 9);
    expect(r.correntes.R1).toBeCloseTo(1.5, 9);
  });

  it('a potência da fonte é a soma das potências dissipadas', () => {
    for (const m of ['serie', 'paralelo', 'misto'] as const) {
      const r = resolverCircuito(montarCircuito(m, 127, [100, 220, 47]));
      const soma = Object.values(r.potencias).reduce((a, b) => a + b, 0);
      expect(soma).toBeCloseTo(r.potenciaFonte, 6);
    }
  });

  it('lâmpada queimada: em série todas apagam; em paralelo as outras seguem iguais', () => {
    const s = resolverCircuito(montarCircuito('serie', 12, [10, 10, 10], [false, true, false]));
    expect(Math.abs(s.correntes.R1)).toBeLessThan(1e-9);
    expect(s.tensoes.R2).toBeCloseTo(12, 6); // a tensão toda aparece no ramo aberto
    const p = resolverCircuito(montarCircuito('paralelo', 12, [10, 10, 10], [false, true, false]));
    expect(p.correntes.R1).toBeCloseTo(1.2, 9);
    expect(p.correntes.R2).toBe(0);
  });

  it('misto: queimar R3 deixa R2 mais forte e R1 mais fraca', () => {
    const antes = resolverCircuito(montarCircuito('misto', 12, [10, 10, 10]));
    const depois = resolverCircuito(montarCircuito('misto', 12, [10, 10, 10], [false, false, true]));
    expect(depois.potencias.R2).toBeGreaterThan(antes.potencias.R2);
    expect(depois.potencias.R1).toBeLessThan(antes.potencias.R1);
  });

  it('uma lâmpada de 60 W em 127 V tem ~269 Ω', () => {
    expect(resistenciaLampada(60, 127)).toBeCloseTo(268.8, 1);
  });
});

describe('partícula no campo magnético (Boris)', () => {
  const { q, m } = PARTICULAS[0];
  const B: Vec3 = [0, 0, 0.5];
  const v = 1e6;

  function rodar(alfa: number, voltas: number, carga = q, massa = m) {
    const T = periodoCiclotron(massa, carga, 0.5);
    const dt = T / 2000;
    let pos: Vec3 = [0, 0, 0];
    let vel = velocidadeInicial(v, alfa);
    const traj: Vec3[] = [pos];
    for (let i = 0; i < 2000 * voltas; i++) {
      ({ pos, vel } = passoBoris(pos, vel, carga, massa, [0, 0, 0], B, dt));
      traj.push(pos);
    }
    return { traj, vel, T };
  }

  it('o raio da circunferência é r = mv/(|q|B)', () => {
    const { traj } = rodar(90, 1);
    const xs = traj.map((p) => p[0]);
    const ys = traj.map((p) => p[1]);
    const diam = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(diam / 2 / raioCiclotron(m, v, q, 0.5)).toBeCloseTo(1, 4);
  });

  it('depois de um período a partícula volta ao ponto de partida (T = 2πm/|q|B)', () => {
    const { traj } = rodar(90, 1);
    const fim = traj[traj.length - 1];
    expect(Math.hypot(fim[0], fim[1]) / raioCiclotron(m, v, q, 0.5)).toBeLessThan(1e-4);
  });

  it('o campo magnético não muda o módulo da velocidade', () => {
    const { vel } = rodar(37, 5);
    expect(Math.hypot(...vel) / v).toBeCloseTo(1, 12);
  });

  it('com ângulo, a trajetória é uma hélice de passo v·cos α·T', () => {
    const { traj, T } = rodar(60, 1);
    expect(traj[traj.length - 1][2]).toBeCloseTo(v * Math.cos(Math.PI / 3) * T, 6);
  });

  it('carga positiva e negativa giram em sentidos opostos (regra da mão direita)', () => {
    const p = passoBoris([0, 0, 0], [v, 0, 0], q, m, [0, 0, 0], B, 1e-12);
    const e = passoBoris([0, 0, 0], [v, 0, 0], -q, m, [0, 0, 0], B, 1e-12);
    // F = q v × B: v = +x, B = +z → v × B = −y.
    expect(p.vel[1]).toBeLessThan(0);
    expect(e.vel[1]).toBeGreaterThan(0);
  });
});

describe('refração', () => {
  it('lei de Snell do ar para a água', () => {
    const r = refratar(1, 1.333, 45);
    expect(Math.sin((r.refratadoGraus! * Math.PI) / 180) * 1.333).toBeCloseTo(Math.sin(Math.PI / 4), 12);
  });

  it('ângulo crítico água → ar ≈ 48,6° e reflexão total acima dele', () => {
    expect(anguloCritico(1.333, 1.000293)).toBeCloseTo(48.62, 1);
    expect(refratar(1.333, 1.000293, 50).reflexaoTotal).toBe(true);
    expect(refratar(1.333, 1.000293, 47).reflexaoTotal).toBe(false);
    expect(anguloCritico(1, 1.5)).toBeNull();
  });

  it('Fresnel: 4% de reflexão no vidro em incidência normal, R + T = 1', () => {
    const r = refratar(1, 1.5, 0);
    expect(r.R).toBeCloseTo(0.04, 10);
    expect(r.R + r.T).toBeCloseTo(1, 12);
  });

  it('perto da incidência rasante quase tudo reflete', () => {
    expect(refratar(1, 1.5, 89).R).toBeGreaterThan(0.9);
  });
});

describe('lentes e espelhos', () => {
  it('objeto em 2f: imagem real, invertida, do mesmo tamanho em 2f', () => {
    const im = formarImagem(0.1, 0.2);
    expect(im.pLinha).toBeCloseTo(0.2, 12);
    expect(im.aumento).toBeCloseTo(-1, 12);
    expect(im).toMatchObject({ natureza: 'real', orientacao: 'invertida', tamanho: 'igual' });
  });

  it('entre o foco e a lente (lupa): virtual, direita e maior', () => {
    expect(formarImagem(0.1, 0.05)).toMatchObject({ natureza: 'virtual', orientacao: 'direita', tamanho: 'maior' });
  });

  it('além de 2f: real, invertida e menor (câmera, olho)', () => {
    expect(formarImagem(0.1, 0.5)).toMatchObject({ natureza: 'real', orientacao: 'invertida', tamanho: 'menor' });
  });

  it('objeto no foco: imagem imprópria', () => {
    expect(formarImagem(0.1, 0.1).natureza).toBe('imprópria');
  });

  it('divergente e convexo: sempre virtual, direita e menor', () => {
    for (const inst of ['lente-divergente', 'espelho-convexo'] as const) {
      for (const p of [0.02, 0.1, 0.4, 3]) {
        expect(formarImagem(focoComSinal(inst, 0.1), p)).toMatchObject({ natureza: 'virtual', orientacao: 'direita', tamanho: 'menor' });
      }
    }
  });
});

describe('efeito Doppler', () => {
  it('velocidade do som a 20 °C ≈ 343 m/s', () => {
    expect(velocidadeSom(20)).toBeCloseTo(343.2, 0);
  });

  it('fonte se aproximando: mais agudo; se afastando: mais grave', () => {
    const v = 343;
    expect(frequenciaDoppler(440, v, 0, 30)).toBeCloseTo((440 * 343) / 313, 9);
    expect(frequenciaDoppler(440, v, 0, -30)).toBeCloseTo((440 * 343) / 373, 9);
    expect(frequenciaDoppler(440, v, 20, 0)).toBeCloseTo((440 * 363) / 343, 9);
  });

  it('as frentes de onda simuladas têm o λ previsto à frente e atrás da fonte', () => {
    const f = 5, v = 340, vs = 100;
    const frentes = frentesDeOnda(f, v, vs, 3);
    const a = frentes[frentes.length - 3];
    const b = frentes[frentes.length - 2];
    const lam = comprimentosDoppler(f, v, vs);
    expect((a.cx + a.r) - (b.cx + b.r)).toBeCloseTo(lam.frente, 9);
    expect((b.cx - b.r) - (a.cx - a.r)).toBeCloseTo(lam.tras, 9);
  });

  it('cone de Mach só acima da velocidade do som: Mach 2 → 30°', () => {
    expect(anguloMach(340, 300)).toBeNull();
    expect(anguloMach(340, 680)).toBeCloseTo(30, 9);
  });
});

describe('gravitação', () => {
  it('a equação de Kepler é satisfeita', () => {
    for (const e of [0, 0.2, 0.6, 0.95]) {
      for (const M of [0.1, 1, 2.5, -2, 5]) {
        const E = resolverKepler(M, e);
        const m = Math.atan2(Math.sin(M), Math.cos(M));
        expect(E - e * Math.sin(E)).toBeCloseTo(m, 10);
      }
    }
  });

  it('3ª lei de Kepler: Júpiter leva ~11,86 anos', () => {
    expect(periodoKepler(PLANETAS[4].a)).toBeCloseTo(11.86, 1);
  });

  it('a Terra fica entre o periélio (~0,983 UA) e o afélio (~1,017 UA) e anda ~29,8 km/s', () => {
    const terra = PLANETAS[2];
    const ds: number[] = [];
    for (let i = 0; i < 365; i++) ds.push(Math.hypot(...posicaoPlaneta(terra, i / 365)));
    expect(Math.min(...ds)).toBeCloseTo(0.9833, 3);
    expect(Math.max(...ds)).toBeCloseTo(1.0167, 3);
    expect(visViva(1, 1)).toBeCloseTo(29.78, 1);
  });

  it('a Terra passa no periélio no começo de janeiro', () => {
    let min = Infinity, dia = 0;
    for (let d = 0; d < 365; d++) {
      const r = Math.hypot(...posicaoPlaneta(PLANETAS[2], d / 365.25));
      if (r < min) { min = r; dia = d; }
    }
    expect(dia).toBeGreaterThanOrEqual(0);
    expect(dia).toBeLessThanOrEqual(6);
  });

  it('órbita circular a 1 UA: volta em 1 ano', () => {
    const c: Corpo = { pos: [1, 0, 0], vel: [0, vCircular(1), 0] };
    const fim = avancarCorpo(c, 1);
    expect(Math.hypot(fim.pos[0] - 1, fim.pos[1])).toBeLessThan(1e-4);
  });

  it('elipse: conserva energia e momento angular (2ª lei) e o período segue T² = a³', () => {
    const c: Corpo = { pos: [1, 0, 0], vel: [0, 1.2 * vCircular(1), 0] };
    const el = elementosOrbita(c);
    expect(el.tipo).toBe('elíptica');
    const e0 = energiaEspecifica(c);
    const h0 = momentoAngular(c)[2];
    const fim = avancarCorpo(c, el.periodo);
    expect(energiaEspecifica(fim) / e0).toBeCloseTo(1, 6);
    expect(momentoAngular(fim)[2] / h0).toBeCloseTo(1, 9);
    expect(Math.hypot(fim.pos[0] - 1, fim.pos[1])).toBeLessThan(1e-3);
    expect(el.perielio).toBeCloseTo(1, 9);
  });

  it('na velocidade de escape a órbita deixa de ser fechada', () => {
    expect(elementosOrbita({ pos: [1, 0, 0], vel: [0, vEscape(1) * 1.01, 0] }).tipo).toBe('hiperbólica');
    expect(vEscape(1) / vCircular(1)).toBeCloseTo(Math.SQRT2, 12);
  });
});
