import { describe, expect, it } from 'vitest';
import {
  adicionarMoleculas,
  criarGas,
  energiaCinetica,
  maxwell2D,
  passoGas,
  pressaoIdeal,
  pressaoMedida,
  temperatura,
  termostato,
  zerarMedicao,
} from './gases';
import { anguloEntre, ehPolar, MOLECULAS, montarMolecula } from './moleculas';
import { avancar, criarRng } from './numerico';
import {
  ANALITOS,
  comprimentoTransicao,
  constantesVelocidade,
  corComprimento,
  corIndicador,
  decairAleatorio,
  descarregar,
  ELETRODOS,
  energiaFoton,
  energiaNivel,
  equilibrioN2O4,
  evoluirN2O4,
  faixaEspectro,
  idadePorFracao,
  INDICADORES,
  ISOTOPOS,
  KcN2O4,
  massaFaraday,
  montarPilha,
  pH,
  quocienteN2O4,
  restantes,
  serieEspectral,
  volumeEquivalencia,
} from './quimica';
import {
  alturaMeioDia,
  declinacaoSolar,
  derivadaPopulacao,
  diaDoAno,
  duracaoDia,
  eixoTerra,
  equilibrioPopulacao,
  estacao,
  hardyWeinberg,
  insolacaoDiaria,
  invarianteLV,
  LEBRE_LINCE,
  NEUTRO,
  proximaGeracao,
  selecao,
} from './vida-terra';
import { PLANETAS, posicaoPlaneta } from './gravitacao';

const el = (k: string) => ELETRODOS.find((e) => e.key === k)!;
const an = (k: string) => ANALITOS.find((a) => a.key === k)!;

describe('gás ideal por dinâmica molecular', () => {
  it('as velocidades sorteadas têm a energia média da equipartição (kT em 2D)', () => {
    const g = criarGas(0, 300, 400, 400, 7);
    adicionarMoleculas(g, 1999, 300);
    expect(temperatura(g)).toBeGreaterThan(285);
    expect(temperatura(g)).toBeLessThan(315);
  });

  it('sem termostato e com paredes paradas, a energia se conserva nas colisões', () => {
    const g = criarGas(150, 300, 30, 30, 3);
    const e0 = energiaCinetica(g);
    for (let i = 0; i < 2000; i++) passoGas(g, 0.1);
    expect(energiaCinetica(g) / e0).toBeCloseTo(1, 9);
  }, 30_000);

  it('a pressão medida nas paredes bate com P·A = N·k·T', () => {
    const g = criarGas(200, 300, 60, 40, 11);
    for (let i = 0; i < 250; i++) passoGas(g, 0.2);
    zerarMedicao(g);
    for (let i = 0; i < 3000; i++) passoGas(g, 0.2);
    const razao = pressaoMedida(g) / pressaoIdeal(g);
    expect(razao).toBeGreaterThan(0.93);
    expect(razao).toBeLessThan(1.1);
  }, 30_000);

  it('Boyle: pela metade do volume, o dobro da pressão (com termostato)', () => {
    const medir = (largura: number) => {
      const g = criarGas(150, 300, largura, 40, 5);
      zerarMedicao(g);
      for (let i = 0; i < 3000; i++) { passoGas(g, 0.2); termostato(g, 300, 0.2); }
      return pressaoMedida(g);
    };
    const razao = medir(40) / medir(80);
    expect(razao).toBeGreaterThan(1.85);
    expect(razao).toBeLessThan(2.2);
  }, 30_000);

  it('comprimir sem trocar calor esquenta o gás (adiabática)', () => {
    const g = criarGas(150, 300, 80, 40, 9);
    const T0 = temperatura(g);
    for (let i = 0; i < 2000; i++) passoGas(g, 0.1, -0.2); // pistão entra
    expect(temperatura(g)).toBeGreaterThan(T0 * 1.3);
  }, 30_000);

  it('a curva de Maxwell 2D integra 1 e tem o pico em √(kT/m)', () => {
    let s = 0;
    for (let v = 0; v < 3000; v += 1) s += maxwell2D(v + 0.5, 300);
    expect(s).toBeCloseTo(1, 3);
    expect(maxwell2D(298, 300)).toBeGreaterThan(maxwell2D(250, 300));
    expect(maxwell2D(298, 300)).toBeGreaterThan(maxwell2D(350, 300));
  });
});

describe('titulação', () => {
  const forte = { analito: an('hcl'), Ca: 0.1, Va: 25, Ct: 0.1 };
  const fraco = { analito: an('acetico'), Ca: 0.1, Va: 25, Ct: 0.1 };
  const base = { analito: an('amonia'), Ca: 0.1, Va: 25, Ct: 0.1 };

  it('HCl 0,1 mol/L tem pH 1 e a equivalência é neutra', () => {
    expect(pH(forte, 0)).toBeCloseTo(1, 3);
    expect(volumeEquivalencia(forte)).toBe(25);
    expect(pH(forte, 25)).toBeCloseTo(7, 3);
    expect(pH(forte, 50)).toBeCloseTo(14 + Math.log10(0.1 * 25 / 75), 3);
  });

  it('ácido acético 0,1 mol/L: pH 2,88; na meia equivalência pH = pKa', () => {
    expect(pH(fraco, 0)).toBeCloseTo(2.88, 2);
    expect(pH(fraco, 12.5)).toBeCloseTo(-Math.log10(1.75e-5), 2);
  });

  it('ácido fraco com base forte: a equivalência é básica (≈ 8,72)', () => {
    expect(pH(fraco, 25)).toBeCloseTo(8.73, 1);
  });

  it('amônia com HCl: começa básica (≈ 11,1) e a equivalência é ácida (≈ 5,28)', () => {
    expect(pH(base, 0)).toBeCloseTo(11.13, 1);
    expect(pH(base, 25)).toBeCloseTo(5.28, 1);
  });

  it('o pH cresce sempre ao adicionar NaOH', () => {
    let ant = -Infinity;
    for (let v = 0; v <= 50; v += 0.5) {
      const x = pH(fraco, v);
      expect(x).toBeGreaterThan(ant);
      ant = x;
    }
  });

  it('a fenolftaleína é incolor no ácido e rosa no básico', () => {
    const fen = INDICADORES[0];
    expect(corIndicador(fen, 4)).toMatch(/0\.000\)$/);
    expect(corIndicador(fen, 11)).toMatch(/^rgba\(2\d\d, 4\d, 1\d\d/);
  });
});

describe('equilíbrio N₂O₄ ⇌ 2 NO₂', () => {
  it('Kc a 25 °C tem a ordem de grandeza tabelada (~5 × 10⁻³)', () => {
    expect(KcN2O4(298.15)).toBeGreaterThan(3e-3);
    expect(KcN2O4(298.15)).toBeLessThan(8e-3);
  });

  it('a cinética leva Q até Kc e conserva os átomos de N', () => {
    const T = 310;
    const s = evoluirN2O4([0.05, 0], T, 60);
    expect(quocienteN2O4(s) / KcN2O4(T)).toBeCloseTo(1, 4);
    expect(s[0] + s[1] / 2).toBeCloseTo(0.05, 10);
    const eq = equilibrioN2O4(0.05, T);
    expect(s[1]).toBeCloseTo(eq[1], 6);
  });

  it('endotérmica: aquecer desloca para o NO₂ (Le Chatelier)', () => {
    expect(KcN2O4(350)).toBeGreaterThan(KcN2O4(300));
    expect(equilibrioN2O4(0.05, 350)[1]).toBeGreaterThan(equilibrioN2O4(0.05, 300)[1]);
  });

  it('comprimir desloca para o lado de menos mols de gás (N₂O₄)', () => {
    const T = 300;
    const antes = equilibrioN2O4(0.05, T);
    const depois = equilibrioN2O4(0.1, T); // metade do volume
    expect(depois[1] / (2 * depois[0] + depois[1])).toBeLessThan(antes[1] / (2 * antes[0] + antes[1]));
  });

  it('k1/k2 = Kc em qualquer temperatura', () => {
    for (const T of [260, 300, 360]) {
      const { k1, k2 } = constantesVelocidade(T);
      expect(k1 / k2 / KcN2O4(T)).toBeCloseTo(1, 12);
    }
  });
});

describe('pilhas', () => {
  it('pilha de Daniell: ddp-padrão 1,10 V, zinco é o ânodo', () => {
    const p = montarPilha(el('cu'), 1, el('zn'), 1);
    expect(p.ddpPadrao).toBeCloseTo(1.104, 3);
    expect(p.anodo.key).toBe('zn');
    expect(p.equacao).toBe('Zn + Cu²⁺ → Zn²⁺ + Cu');
  });

  it('Nernst: [Cu²⁺] = 0,01 mol/L baixa a ddp em 59 mV', () => {
    const p = montarPilha(el('zn'), 1, el('cu'), 0.01);
    expect(p.ddp).toBeCloseTo(1.104 - 0.05916, 3);
  });

  it('balanceia os elétrons: 2 Al + 3 Cu²⁺', () => {
    const p = montarPilha(el('al'), 1, el('cu'), 1);
    expect(p.equacao).toBe('2Al + 3Cu²⁺ → 2Al³⁺ + 3Cu');
    expect(p.eletrons).toBe(6);
  });

  it('a descarga baixa a ddp e a carga obedece a Faraday', () => {
    let p = montarPilha(el('zn'), 1, el('cu'), 1);
    let carga = 0;
    for (let i = 0; i < 200; i++) {
      const r = descarregar(p, 1, 0.1, 3600);
      p = r.pilha;
      carga += r.carga;
    }
    expect(p.ddp).toBeLessThan(1.06);
    // Cu²⁺ consumido (mol) × 2 F = carga
    expect((1 - p.cCatodo) * 0.1 * 2 * 96485.33212).toBeCloseTo(carga, 3);
    expect(massaFaraday(96485.33212 * 2, el('cu'))).toBeCloseTo(63.546, 6);
  });
});

describe('decaimento radioativo', () => {
  it('N = N0·(1/2)^(t/T½)', () => {
    expect(restantes(1000, 5730 * 2, 5730)).toBeCloseTo(250, 9);
  });

  it('datação: sobrou 25% de C-14 → 11.460 anos', () => {
    expect(idadePorFracao(0.25, 5730)).toBeCloseTo(11460, 6);
  });

  it('o sorteio núcleo a núcleo segue a curva exponencial', () => {
    const rng = criarRng(42);
    const T = ISOTOPOS[2].meiaVida;
    const vivos = new Uint8Array(4000).fill(1);
    for (let i = 0; i < 100; i++) decairAleatorio(vivos, T / 100, T, rng);
    const n = vivos.reduce((a, b) => a + b, 0);
    expect(Math.abs(n - 2000)).toBeLessThan(4 * Math.sqrt(1000)); // 4σ
  });
});

describe('espectro do hidrogênio', () => {
  it('nível fundamental −13,6 eV e o n = 2 em −3,4 eV', () => {
    expect(energiaNivel(1)).toBeCloseTo(-13.6, 1);
    expect(energiaNivel(2)).toBeCloseTo(-3.4, 1);
  });

  it('Hα (3 → 2) em 656,5 nm, vermelho; Lyman α em 121,6 nm', () => {
    expect(comprimentoTransicao(3, 2)).toBeCloseTo(656.47, 1);
    expect(faixaEspectro(656.47)).toBe('vermelho');
    expect(comprimentoTransicao(2, 1)).toBeCloseTo(121.57, 1);
    expect(serieEspectral(1)).toMatch(/Lyman/);
    expect(serieEspectral(2)).toMatch(/visível/);
  });

  it('a energia do fóton bate com a diferença entre os níveis', () => {
    expect(energiaFoton(comprimentoTransicao(4, 2))).toBeCloseTo(energiaNivel(4) - energiaNivel(2), 2);
  });

  it('a cor do comprimento de onda: vermelho, verde e azul nos lugares certos', () => {
    expect(corComprimento(656)).toEqual([255, 0, 0]);
    expect(corComprimento(530)[1]).toBe(255);
    expect(corComprimento(450)[2]).toBe(255);
    expect(corComprimento(300)).toEqual([0, 0, 0]);
  });
});

describe('geometria molecular', () => {
  it('os ângulos montados batem com os medidos de cada molécula', () => {
    const casos: Record<string, [number, number, number]> = {
      h2o: [1, 2, 104.5], nh3: [1, 2, 106.7], ch4: [1, 2, 109.47], co2: [1, 2, 180], bf3: [1, 2, 120],
      so2: [1, 2, 119], ch2o: [2, 3, 116.5], chcl3: [2, 3, 111.3], sf6: [1, 3, 90], xef4: [1, 2, 90],
      pcl5: [3, 4, 120], sf4: [1, 2, 173.1], clf3: [1, 2, 87.5], brf5: [1, 2, 84.8],
    };
    for (const [key, [i, j, ang]] of Object.entries(casos)) {
      const g = montarMolecula(MOLECULAS.find((m) => m.key === key)!);
      expect(anguloEntre(g.atomos[i].pos, g.atomos[j].pos), key).toBeCloseTo(ang, 1);
    }
    const sf4 = montarMolecula(MOLECULAS.find((m) => m.key === 'sf4')!);
    expect(anguloEntre(sf4.atomos[3].pos, sf4.atomos[4].pos)).toBeCloseTo(101.6, 1);
  });

  it('os comprimentos de ligação são os do catálogo (pm)', () => {
    for (const m of MOLECULAS) {
      const g = montarMolecula(m);
      m.ligantes.forEach((l, i) => expect(Math.hypot(...g.atomos[i + 1].pos)).toBeCloseTo(l.pm, 6));
    }
  });

  it('polaridade pela soma vetorial dos dipolos', () => {
    const polares = ['hcn', 'ch2o', 'so2', 'chcl3', 'nh3', 'h2o', 'sf4', 'clf3', 'brf5'];
    const apolares = ['becl2', 'co2', 'bf3', 'ch4', 'pcl5', 'xef2', 'sf6', 'xef4'];
    for (const k of polares) expect(ehPolar(MOLECULAS.find((m) => m.key === k)!), k).toBe(true);
    for (const k of apolares) expect(ehPolar(MOLECULAS.find((m) => m.key === k)!), k).toBe(false);
  });
});

describe('predador e presa', () => {
  it('no modelo clássico a órbita é fechada (invariante conservado)', () => {
    const p = LEBRE_LINCE;
    const v0 = invarianteLV(p, 30, 4);
    const s = avancar(derivadaPopulacao(p), 0, [30, 4], 80, 0.005).y;
    expect(invarianteLV(p, s[0], s[1])).toBeCloseTo(v0, 6);
  });

  it('no equilíbrio as populações não mudam', () => {
    const p = LEBRE_LINCE;
    const e = equilibrioPopulacao(p);
    const s = avancar(derivadaPopulacao(p), 0, [e.presas, e.predadores], 20, 0.01).y;
    expect(s[0]).toBeCloseTo(e.presas, 8);
    expect(s[1]).toBeCloseTo(e.predadores, 8);
  });

  it('com capacidade de suporte as oscilações amortecem até o equilíbrio', () => {
    const p = { ...LEBRE_LINCE, K: 150 };
    const e = equilibrioPopulacao(p);
    const s = avancar(derivadaPopulacao(p), 0, [30, 4], 400, 0.01).y;
    expect(s[0]).toBeCloseTo(e.presas, 2);
    expect(s[1]).toBeCloseTo(e.predadores, 2);
  });
});

describe('genética de populações', () => {
  it('Hardy-Weinberg: p² + 2pq + q² = 1', () => {
    const f = hardyWeinberg(0.7);
    expect(f.AA).toBeCloseTo(0.49, 12);
    expect(f.Aa).toBeCloseTo(0.42, 12);
    expect(f.AA + f.Aa + f.aa).toBeCloseTo(1, 12);
  });

  it('sem seleção a frequência não muda (população infinita)', () => {
    expect(selecao(0.3, NEUTRO)).toBeCloseTo(0.3, 12);
  });

  it('seleção contra aa aumenta p', () => {
    expect(selecao(0.3, { AA: 1, Aa: 1, aa: 0.5 })).toBeGreaterThan(0.3);
  });

  it('deriva: a chance de fixação de um alelo neutro é a frequência inicial', () => {
    const rng = criarRng(2024);
    let fixou = 0;
    const runs = 1500;
    for (let r = 0; r < runs; r++) {
      let p = 0.3;
      while (p > 0 && p < 1) p = proximaGeracao(p, 10, NEUTRO, rng);
      if (p === 1) fixou++;
    }
    expect(Math.abs(fixou / runs - 0.3)).toBeLessThan(0.04);
  }, 30_000);

  it('a deriva é mais forte em populações pequenas', () => {
    const rng = criarRng(5);
    const variancia = (N: number) => {
      let s = 0;
      for (let i = 0; i < 2000; i++) s += (proximaGeracao(0.5, N, NEUTRO, rng) - 0.5) ** 2;
      return s / 2000;
    };
    expect(variancia(10)).toBeGreaterThan(5 * variancia(200));
  });
});

describe('estações do ano', () => {
  it('declinação: +23,4° no solstício de junho, −23,4° no de dezembro, ~0 nos equinócios', () => {
    expect(declinacaoSolar(172)).toBeCloseTo(23.44, 0);
    expect(declinacaoSolar(355)).toBeCloseTo(-23.44, 0);
    expect(Math.abs(declinacaoSolar(80))).toBeLessThan(0.6);
    expect(Math.abs(declinacaoSolar(266))).toBeLessThan(0.6);
  });

  it('no equinócio o dia tem 12 h em qualquer latitude (horizonte geométrico)', () => {
    for (const lat of [-50, -23.5, 0, 40]) expect(duracaoDia(lat, 0, 0)).toBeCloseTo(12, 9);
  });

  it('no equador o dia tem ~12 h o ano inteiro', () => {
    for (const dia of [1, 100, 172, 300]) expect(Math.abs(duracaoDia(0, declinacaoSolar(dia)) - 12.1)).toBeLessThan(0.1);
  });

  it('sol da meia-noite acima do Círculo Polar no verão e noite polar no inverno', () => {
    expect(duracaoDia(70, declinacaoSolar(172))).toBe(24);
    expect(duracaoDia(70, declinacaoSolar(355))).toBe(0);
  });

  it('em São Paulo o dia é mais longo em dezembro e o Sol do meio-dia fica a pino', () => {
    expect(duracaoDia(-23.55, declinacaoSolar(355))).toBeGreaterThan(13.3);
    expect(duracaoDia(-23.55, declinacaoSolar(172))).toBeLessThan(10.8);
    expect(alturaMeioDia(-23.55, declinacaoSolar(355))).toBeGreaterThan(89.5);
  });

  it('o verão do Sul recebe mais energia que o inverno do Sul', () => {
    expect(insolacaoDiaria(-30, 355)).toBeGreaterThan(2 * insolacaoDiaria(-30, 172));
    // No polo norte em junho a média diária passa de 500 W/m².
    expect(insolacaoDiaria(90, 172)).toBeGreaterThan(500);
  });

  it('estações invertidas entre os hemisférios', () => {
    expect(estacao(10, 'sul')).toBe('verão');
    expect(estacao(10, 'norte')).toBe('inverno');
    expect(estacao(200, 'sul')).toBe('inverno');
    expect(estacao(100, 'sul')).toBe('outono');
  });

  it('o eixo da Terra na órbita real reproduz a declinação do dia', () => {
    const data = new Date(Date.UTC(2026, 5, 21, 12));
    const t = (data.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000);
    const terra = posicaoPlaneta(PLANETAS[2], t);
    const r = Math.hypot(...terra);
    const paraSol: [number, number, number] = [-terra[0] / r, -terra[1] / r, -terra[2] / r];
    const eixo = eixoTerra();
    const dec = 90 - anguloEntre(eixo, paraSol);
    expect(dec).toBeCloseTo(declinacaoSolar(diaDoAno(data)), 0);
    expect(diaDoAno(data)).toBe(172);
  });
});
