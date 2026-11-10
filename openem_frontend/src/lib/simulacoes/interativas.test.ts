import { describe, expect, it } from 'vitest';
import { angulo, configuracao, distancia, espelhar, formula, montar, PARES } from './isomeria';
import {
  afimPorPontos,
  distribuicaoSoma,
  esperanca,
  exponencialPorPontos,
  formaGeral,
  logaritmo,
  notavelMaisPerto,
  quadrante,
  quadraticaPorVertice,
  radianosEmPi,
  raizes,
  reducao,
  senoPorPico,
  totalCubos,
  triangulo,
  vistas,
  vistasIguais,
} from './matematica';
import {
  anguloEntre,
  CIDADES,
  cruzar,
  diferenca,
  direcao,
  fusoTeorico,
  gametas,
  horaOficial,
  horaSolar,
  leiDosCossenos,
  modulo,
  proporcao,
  relogio,
  somaVetores,
  type Gene,
} from './mais-modelos';
import { areaFace, dobrar, solido, type V3 } from './solidos';

describe('funções', () => {
  it('reta e parábola pelos pontos arrastados', () => {
    expect(afimPorPontos([0, 1], [2, 5])).toEqual({ a: 2, b: 1 });
    const q = quadraticaPorVertice([1, -4], [3, 0]);
    expect(q.a).toBeCloseTo(1, 12);
    const g = formaGeral(q);
    expect(raizes(g.a, g.b, g.c).map((r) => +r.toFixed(9))).toEqual([-1, 3]);
    expect(raizes(1, -2, 1)).toEqual([1]);
    expect(raizes(1, 0, 1)).toEqual([]);
  });

  it('exponencial, logaritmo e seno', () => {
    expect(exponencialPorPontos([0, 2], [1, 6])).toEqual({ k: 2, base: 3 });
    expect(logaritmo(2)(8)).toBeCloseTo(3, 12);
    expect(Number.isNaN(logaritmo(2)(-1))).toBe(true);
    const s = senoPorPico([1, 3], 4, 1);
    const f = (x: number) => s.A * Math.sin(s.B * (x - s.C)) + s.D;
    expect(f(1)).toBeCloseTo(3, 12);
    expect(f(3)).toBeCloseTo(-1, 12); // meio período depois, o vale
  });
});

describe('ciclo trigonométrico', () => {
  it('ângulos notáveis, quadrante e redução', () => {
    expect(radianosEmPi(30)).toBe('π/6');
    expect(radianosEmPi(225)).toBe('5π/4');
    expect(radianosEmPi(390)).toBe('π/6');
    expect(notavelMaisPerto(44)).toBe(45);
    expect(notavelMaisPerto(50)).toBeNull();
    expect(quadrante(150)).toBe(2);
    expect(quadrante(90)).toBe(0);
    expect(reducao(150)).toBe(30);
    expect(reducao(210)).toBe(30);
    expect(reducao(330)).toBe(30);
  });
});

describe('triângulo', () => {
  it('3-4-5 é retângulo, área 6, e a soma dos ângulos é 180°', () => {
    const t = triangulo([0, 0], [4, 0], [0, 3]);
    expect(t.tipoAngulos).toBe('retângulo');
    expect(t.tipoLados).toBe('escaleno');
    expect(t.area).toBeCloseTo(6, 12);
    expect(t.angulos.A + t.angulos.B + t.angulos.C).toBeCloseTo(180, 9);
    // Circuncentro no meio da hipotenusa, ortocentro no vértice do ângulo reto.
    expect(t.circuncentro![0]).toBeCloseTo(2, 9);
    expect(t.circuncentro![1]).toBeCloseTo(1.5, 9);
    expect(t.ortocentro![0]).toBeCloseTo(0, 9);
    expect(t.ortocentro![1]).toBeCloseTo(0, 9);
    expect(t.raioInscrito).toBeCloseTo(1, 9); // r = (a + b − c)/2
    expect(t.raioCircunscrito).toBeCloseTo(2.5, 9);
  });

  it('equilátero: os quatro pontos notáveis coincidem', () => {
    const t = triangulo([0, 0], [2, 0], [1, Math.sqrt(3)]);
    expect(t.tipoLados).toBe('equilátero');
    for (const p of [t.circuncentro!, t.incentro, t.ortocentro!]) {
      expect(p[0]).toBeCloseTo(t.baricentro[0], 9);
      expect(p[1]).toBeCloseTo(t.baricentro[1], 9);
    }
  });
});

describe('probabilidade', () => {
  it('soma de dois dados: 7 é o mais provável (6/36) e a média é 7', () => {
    const d = distribuicaoSoma(2);
    expect(d[7]).toBeCloseTo(6 / 36, 12);
    expect(d[2]).toBeCloseTo(1 / 36, 12);
    expect(d.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 12);
    expect(esperanca(d)).toBeCloseTo(7, 12);
    expect(esperanca(distribuicaoSoma(3))).toBeCloseTo(10.5, 12);
  });
});

describe('projeções ortográficas', () => {
  it('vistas de um sólido de cubos', () => {
    // Linha 0 no fundo, linha 1 na frente.
    const h = [
      [2, 0, 1],
      [1, 1, 0],
    ];
    const v = vistas(h);
    expect(v.frontal).toEqual([2, 1, 1]);
    expect(v.lateral).toEqual([2, 1]);
    expect(v.superior).toEqual([[true, false, true], [true, true, false]]);
    expect(totalCubos(h)).toBe(5);
    // Sólidos diferentes podem ter as mesmas três vistas: tirar um cubo escondido não muda nada.
    expect(vistasIguais(vistas([[2, 1], [1, 1]]), vistas([[2, 1], [1, 1]]))).toBe(true);
  });
});

describe('planificação de sólidos', () => {
  const verticesUnicos = (faces: V3[][]) => {
    const vs: V3[] = [];
    for (const f of faces) for (const p of f) if (!vs.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-6)) vs.push(p);
    return vs;
  };

  it('fechado, cada sólido tem os vértices de Euler (V − A + F = 2) e a área total certa', () => {
    for (const key of ['cubo', 'paralelepipedo', 'prisma', 'piramide', 'tetraedro'] as const) {
      const s = solido(key, { a: 2, b: 3, c: 1.5 });
      expect(s.vertices - s.arestas + s.faces, key).toBe(2);
      const fechado = dobrar(s.rede, 0);
      expect(fechado).toHaveLength(s.faces);
      expect(verticesUnicos(fechado), key).toHaveLength(s.vertices);
      const area = fechado.reduce((t, f) => t + areaFace(f), 0);
      expect(area, key).toBeCloseTo(s.area, 6);
      // Aberto, tudo fica no chão.
      for (const f of dobrar(s.rede, 1)) for (const p of f) expect(Math.abs(p[1])).toBeLessThan(1e-9);
    }
  });

  it('volumes', () => {
    expect(solido('cubo', { a: 3, b: 0, c: 0 }).volume).toBe(27);
    expect(solido('piramide', { a: 3, b: 0, c: 4 }).volume).toBeCloseTo(12, 12);
    expect(solido('tetraedro', { a: 1, b: 0, c: 0 }).volume).toBeCloseTo(0.11785, 4);
  });
});

describe('isomeria', () => {
  it('geometria: 109,5° no sp³, 120° no sp² e comprimentos de ligação', () => {
    const [butano] = PARES.find((p) => p.key === 'butano')!.girar(0);
    expect(angulo(butano, 1, 0, 2)).toBeCloseTo(109.47, 1);
    expect(distancia(butano, 0, 1)).toBeCloseTo(1.54, 9);
    const cis = PARES.find((p) => p.key === 'but-2-eno')!.a;
    expect(angulo(cis, 1, 0, 2)).toBeCloseTo(120, 6);
    expect(distancia(cis, 1, 2)).toBeCloseTo(1.34, 9);
  });

  it('cis deixa os metilas mais perto que trans; os dois têm a mesma fórmula', () => {
    const par = PARES.find((p) => p.key === 'but-2-eno')!;
    expect(distancia(par.a, 0, 3)).toBeLessThan(distancia(par.b, 0, 3) - 0.5);
    expect(formula(par.a)).toBe('C₄H₈');
    expect(formula(par.b)).toBe('C₄H₈');
  });

  it('todo par tem a mesma fórmula molecular (é o que define isômeros)', () => {
    for (const p of PARES) expect(formula(p.a), p.key).toBe(formula(p.b));
    expect(formula(PARES.find((p) => p.key === 'etanol')!.a)).toBe('C₂H₆O');
  });

  it('girar a ligação simples não muda a molécula; o espelho inverte R e S', () => {
    const par = PARES.find((p) => p.key === 'propanol')!;
    const [a0] = par.girar(0);
    const [a60] = par.girar(60);
    expect(formula(a60)).toBe(formula(a0));
    expect(distancia(a60, 0, 1)).toBeCloseTo(distancia(a0, 0, 1), 9);
    const quiral = PARES.find((p) => p.key === 'chfclbr')!;
    const ca = configuracao(quiral.a, 0);
    expect(ca === 'R' || ca === 'S').toBe(true);
    expect(configuracao(quiral.b, 0)).toBe(ca === 'R' ? 'S' : 'R');
    expect(configuracao(espelhar(quiral.b, ''), 0)).toBe(ca);
    // Montar de novo dá a mesma configuração.
    expect(configuracao(montar({ nome: '', atomos: [{ el: 'C', hib: 'sp3', liga: [1, 2, 3, 'H'] }, { el: 'F', hib: 'sp3', liga: [0] }, { el: 'Cl', hib: 'sp3', liga: [0] }, { el: 'Br', hib: 'sp3', liga: [0] }] }), 0)).toBe(ca);
  });
});

describe('vetores', () => {
  it('soma, módulo, direção e lei dos cossenos', () => {
    const r = somaVetores([[3, 0], [0, 4]]);
    expect(modulo(r)).toBe(5);
    expect(direcao([0, -1])).toBeCloseTo(270, 9);
    expect(anguloEntre([1, 0], [0, 2])).toBeCloseTo(90, 9);
    expect(leiDosCossenos(3, 4, 90)).toBeCloseTo(5, 9);
    expect(leiDosCossenos(3, 4, 0)).toBeCloseTo(7, 9);
    expect(leiDosCossenos(3, 4, 180)).toBeCloseTo(1, 9);
  });
});

describe('Mendel', () => {
  const cor: Gene = { letra: 'A', dominante: 'amarela', recessivo: 'verde', dominancia: 'completa' };
  const textura: Gene = { letra: 'B', dominante: 'lisa', recessivo: 'rugosa', dominancia: 'completa' };
  const flor: Gene = { letra: 'V', dominante: 'vermelha', recessivo: 'branca', intermediario: 'rosa', dominancia: 'incompleta' };

  it('monoibridismo: Aa × Aa dá 1 : 2 : 1 e 3 : 1', () => {
    const r = cruzar([cor], ['Aa'], ['Aa']);
    expect(proporcao(r.genotipos.map((g) => g.p))).toBe('2 : 1 : 1');
    expect(r.genotipos.find((g) => g.g === 'Aa')!.p).toBeCloseTo(0.5, 12);
    expect(proporcao(r.fenotipos.map((f) => f.p))).toBe('3 : 1');
    expect(gametas(['AA'])).toHaveLength(1);
  });

  it('diibridismo: AaBb × AaBb dá 9 : 3 : 3 : 1', () => {
    const r = cruzar([cor, textura], ['Aa', 'Bb'], ['Aa', 'Bb']);
    expect(r.gametasPai).toHaveLength(4);
    expect(proporcao(r.fenotipos.map((f) => f.p))).toBe('9 : 3 : 3 : 1');
  });

  it('dominância incompleta: vermelha × branca dá rosa; rosa × rosa dá 1 : 2 : 1 de fenótipos', () => {
    expect(cruzar([flor], ['VV'], ['vv']).fenotipos).toEqual([{ f: 'rosa', p: 1 }]);
    expect(proporcao(cruzar([flor], ['Vv'], ['Vv']).fenotipos.map((f) => f.p))).toBe('2 : 1 : 1');
  });
});

describe('fusos horários', () => {
  it('Brasília no fuso −3; Tóquio 12 h à frente; 4 minutos por grau', () => {
    const bsb = CIDADES.find((c) => c.nome === 'Brasília')!;
    const toq = CIDADES.find((c) => c.nome === 'Tóquio')!;
    expect(fusoTeorico(bsb.lon)).toBe(-3);
    expect(diferenca(bsb, toq)).toBe(12);
    expect(horaOficial(15, -3)).toBe(12);
    expect(horaSolar(12, 15) - horaSolar(12, 0)).toBeCloseTo(1, 12);
    expect(relogio(13.5)).toBe('13:30');
    expect(relogio(-1)).toBe('23:00');
    // Nova Délhi tem meia hora no fuso.
    expect(relogio(horaOficial(0, CIDADES.find((c) => c.nome === 'Nova Délhi')!.fuso))).toBe('05:30');
  });
});
