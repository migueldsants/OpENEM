import { describe, expect, it } from 'vitest';
import { atomosPorCelula, coordenacao, densidade, empacotamento, ESTRUTURAS, gerarReticulo, ligacoesVizinhas } from './cristais';
import {
  CODIGO,
  complementar,
  conteudoGC,
  contagemDupla,
  efeitoMutacao,
  limparSequencia,
  posicaoPar,
  RAIO_NM,
  traduzir,
  transcrever,
} from './dna';
import { eclipsesEntre, elongacao, fracaoIluminada, latitudeLua, MES_SINODICO, nomeFase } from './lua';
import { altura, comprimentoOnda, envoltoria, linhasNodais, linhasVentrais, ordem, type Fontes } from './ondas-superficie';

describe('fases da Lua e eclipses', () => {
  it('a fração iluminada vai de 0 (nova) a 1 (cheia), metade nas quartos', () => {
    expect(fracaoIluminada(0)).toBeCloseTo(0, 6);
    expect(fracaoIluminada(MES_SINODICO / 2)).toBeCloseTo(1, 6);
    expect(fracaoIluminada(MES_SINODICO / 4)).toBeCloseTo(0.5, 6);
    expect(fracaoIluminada(MES_SINODICO * 0.75)).toBeCloseTo(0.5, 6);
    expect(elongacao(MES_SINODICO)).toBeCloseTo(0, 6);
  });

  it('nomes das fases na ordem do mês', () => {
    const q = MES_SINODICO / 4;
    expect(nomeFase(0)).toBe('Lua nova');
    expect(nomeFase(q / 2)).toBe('Crescente');
    expect(nomeFase(q)).toBe('Quarto crescente');
    expect(nomeFase(1.5 * q)).toBe('Crescente gibosa');
    expect(nomeFase(2 * q)).toBe('Lua cheia');
    expect(nomeFase(2.5 * q)).toBe('Minguante gibosa');
    expect(nomeFase(3 * q)).toBe('Quarto minguante');
    expect(nomeFase(3.5 * q)).toBe('Minguante');
    expect(nomeFase(MES_SINODICO - 0.2)).toBe('Lua nova');
  });

  it('não há eclipse todo mês: de 2 a 7 por ano, e sempre ao menos 2 solares', () => {
    for (let ano = 0; ano < 30; ano++) {
      const lista = eclipsesEntre(ano * 365.25, (ano + 1) * 365.25, 3.1);
      expect(lista.length, `ano ${ano}`).toBeGreaterThanOrEqual(2);
      expect(lista.length, `ano ${ano}`).toBeLessThanOrEqual(7);
      expect(lista.filter((e) => e.tipo === 'solar').length, `ano ${ano}`).toBeGreaterThanOrEqual(2);
    }
    // A latitude da Lua nunca passa da inclinação da órbita.
    for (let t = 0; t < 400; t += 0.37) expect(Math.abs(latitudeLua(t, 3.1))).toBeLessThanOrEqual(5.145 + 1e-9);
  });
});

describe('estruturas cristalinas', () => {
  const por = (k: string) => ESTRUTURAS.find((e) => e.key === k)!;

  it('átomos por célula contados pela posição (canto 1/8, face 1/2…)', () => {
    expect(atomosPorCelula(por('ccc'))).toBeCloseTo(2, 9);
    expect(atomosPorCelula(por('cfc'))).toBeCloseTo(4, 9);
    expect(atomosPorCelula(por('nacl'))).toBeCloseTo(8, 9); // 4 Na⁺ + 4 Cl⁻
    expect(atomosPorCelula(por('diamante'))).toBeCloseTo(8, 9);
  });

  it('número de coordenação e distância ao vizinho', () => {
    expect(coordenacao(por('ccc'))).toMatchObject({ numero: 8 });
    expect(coordenacao(por('ccc')).distancia).toBeCloseTo(Math.sqrt(3) / 2, 6);
    expect(coordenacao(por('cfc'))).toMatchObject({ numero: 12 });
    expect(coordenacao(por('nacl'))).toMatchObject({ numero: 6, distancia: 0.5 });
    expect(coordenacao(por('diamante'))).toMatchObject({ numero: 4 });
  });

  it('fator de empacotamento dos livros: 68% (CCC), 74% (CFC), 34% (diamante)', () => {
    expect(empacotamento(por('ccc'))).toBeCloseTo(0.68, 2);
    expect(empacotamento(por('cfc'))).toBeCloseTo(0.74, 2);
    expect(empacotamento(por('diamante'))).toBeCloseTo(0.34, 2);
  });

  it('densidade calculada pelo parâmetro de rede fecha com a medida (até 1%)', () => {
    for (const e of ESTRUTURAS) expect(Math.abs(densidade(e) / e.densidadeReal - 1), e.key).toBeLessThan(0.01);
  });

  it('no diamante, cada átomo de dentro tem 4 ligações', () => {
    const e = por('diamante');
    const at = gerarReticulo(e, 2);
    const { distancia } = coordenacao(e);
    const lig = ligacoesVizinhas(at, distancia);
    const grau = new Array(at.length).fill(0);
    for (const [i, j] of lig) { grau[i]++; grau[j]++; }
    const meio = at.findIndex((a) => a.pos.every((c) => Math.abs(c - 1.25) < 1e-6));
    expect(grau[meio]).toBe(4);
  });
});

describe('DNA', () => {
  it('pareamento, transcrição e Chargaff', () => {
    expect(complementar('ATGCCGTA')).toBe('TACGGCAT');
    expect(transcrever('ATGGCCTAA')).toBe('AUGGCCUAA');
    expect(limparSequencia('at g-c x')).toBe('ATGC');
    const c = contagemDupla('ATGGCGTA');
    expect(c.A).toBe(c.T);
    expect(c.C).toBe(c.G);
    expect(conteudoGC('GGCC')).toBe(1);
  });

  it('código genético: 64 códons, 3 de parada, só o AUG para metionina', () => {
    expect(Object.keys(CODIGO)).toHaveLength(64);
    expect(Object.values(CODIGO).filter((a) => a === 'Pare')).toHaveLength(3);
    expect(Object.entries(CODIGO).filter(([, a]) => a === 'Met').map(([k]) => k)).toEqual(['AUG']);
    expect(CODIGO.UGG).toBe('Trp');
    expect(CODIGO.GGG).toBe('Gly');
    expect(CODIGO.UAG).toBe('Pare');
  });

  it('tradução do AUG até a parada', () => {
    const t = traduzir(transcrever('CCATGGCCAAATTTTAGGG'));
    expect(t.inicio).toBe(2);
    expect(t.aminoacidos).toEqual(['Met', 'Ala', 'Lys', 'Phe']);
    expect(t.parou).toBe(true);
    expect(traduzir('CCCGGG').inicio).toBe(-1);
  });

  it('mutações: silenciosa, troca de aminoácido e sem sentido', () => {
    const gene = 'ATGGCCAAATTTTAG'; // Met Ala Lys Phe Pare
    expect(efeitoMutacao(gene, 5, 'T')).toBe('silenciosa'); // GCC → GCT, ainda Ala
    expect(efeitoMutacao(gene, 4, 'A')).toBe('troca de aminoácido'); // GCC → GAC, Asp
    expect(efeitoMutacao(gene, 6, 'T')).toBe('sem sentido'); // AAA → TAA, parada
  });

  it('dupla hélice: as duas fitas no mesmo raio, 10,5 pares por volta', () => {
    const p = posicaoPar(0);
    expect(Math.hypot(p.fita1[0], p.fita1[2])).toBeCloseTo(RAIO_NM, 9);
    expect(Math.hypot(p.fita2[0], p.fita2[2])).toBeCloseTo(RAIO_NM, 9);
    const volta = posicaoPar(10.5);
    expect(volta.fita1[0]).toBeCloseTo(p.fita1[0], 9);
    expect(volta.y).toBeCloseTo(3.57, 2);
  });
});

describe('interferência na cuba de ondas', () => {
  const p: Fontes = { f: 2, v: 0.2, d: 0.3, fase: 0 };

  it('λ = v/f', () => {
    expect(comprimentoOnda(p)).toBeCloseTo(0.1, 12);
  });

  it('na mediatriz as ondas se somam; com Δ = λ/2 se cancelam', () => {
    const lambda = comprimentoOnda(p);
    // Ponto longe na mediatriz: amplitude quase o dobro de uma fonte só.
    const y = 2;
    expect(envoltoria(p, 0, y) / envoltoria({ ...p, uma: true }, -p.d / 2, y)).toBeCloseTo(2, 1);
    expect(ordem(p, 0, y)).toBeCloseTo(0, 9);
    // Ponto com diferença de caminho de meio comprimento de onda (achado por bissecção em x, com y grande).
    let a = 0;
    let b = 1;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (ordem(p, m, y) > 0.5) b = m; else a = m;
    }
    expect(Math.abs(ordem(p, a, y))).toBeCloseTo(0.5, 6);
    expect(envoltoria(p, a, y)).toBeLessThan(0.02 * envoltoria(p, 0, y));
    // A altura no tempo nunca passa da envoltória.
    for (let t = 0; t < 1; t += 0.05) expect(Math.abs(altura(p, 0.1, 0.4, t))).toBeLessThanOrEqual(envoltoria(p, 0.1, 0.4) + 1e-12);
    expect(lambda).toBeGreaterThan(0);
  });

  it('conta as linhas nodais e ventrais e confere andando num círculo grande', () => {
    expect(linhasNodais(p)).toBe(6); // d = 3λ: Δ = ±0,5λ, ±1,5λ, ±2,5λ
    expect(linhasVentrais(p)).toBe(5); // Δ = 0, ±λ, ±2λ
    // Mínimos da envoltória num semicírculo de raio 20d em volta das fontes.
    const R = 20 * p.d;
    let minimos = 0;
    const N = 20000;
    const amp = (i: number) => {
      const th = (Math.PI * i) / N;
      return envoltoria(p, R * Math.cos(th), R * Math.sin(th));
    };
    for (let i = 1; i < N; i++) if (amp(i) < amp(i - 1) && amp(i) < amp(i + 1)) minimos++;
    expect(minimos).toBe(linhasNodais(p));
    // Em oposição de fase, a mediatriz vira linha nodal.
    expect(envoltoria({ ...p, fase: Math.PI }, 0, 2)).toBeLessThan(1e-9);
  });
});
