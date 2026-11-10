import { describe, expect, it } from 'vitest';
import catalogo from '../../data/elementos.json';
import nuclideosJson from '../../data/nuclideos.json';
import { formatar } from '../configuracao-eletronica';
import type { Catalogo, Elemento } from '../elementos';
import {
  caixasHund,
  camadas,
  cargasPossiveis,
  configuracaoDe,
  estavel,
  ionsSugeridos,
  isotopoPadrao,
  lerNuclideos,
  meiaVidaTexto,
  notacaoA,
  nucleo,
  nuvem,
  orbitais,
  textoCarga,
  tipoIon,
  vizinhoA,
  type CatalogoNuclideos,
} from './atomo';
import { carateriIonico, DATIVAS, formulaIonica, ligar } from './ligacoes';

const ELS = (catalogo as unknown as Catalogo).elementos;
const el = (s: string) => ELS.find((e) => e.simbolo === s) as Elemento;
const NUC = lerNuclideos(nuclideosJson as unknown as CatalogoNuclideos);

describe('nuclídeos (IAEA) e o catálogo da tabela', () => {
  it('os 118 elementos têm nuclídeos, e todo isótopo natural do catálogo está na lista', () => {
    expect(NUC.size).toBe(118);
    for (const e of ELS) {
      const nucs = NUC.get(e.z)!;
      expect(nucs.length, e.simbolo).toBeGreaterThan(0);
      for (const i of e.isotopos) expect(nucs.some((n) => n.a === i.a), `${e.simbolo}-${i.a}`).toBe(true);
    }
  });

  it('"radioativo" do catálogo bate com não ter nuclídeo estável', () => {
    for (const e of ELS) expect(NUC.get(e.z)!.some(estavel), e.simbolo).toBe(!e.radioativo);
    const totalEstaveis = [...NUC.values()].flat().filter(estavel).length;
    expect(totalEstaveis).toBeGreaterThan(240);
    expect(totalEstaveis).toBeLessThan(260);
  });
});

describe('montar um átomo', () => {
  it('isótopo padrão: o natural mais abundante, senão o de vida mais longa', () => {
    expect(isotopoPadrao(el('C'), NUC.get(6)!)).toBe(12);
    expect(isotopoPadrao(el('Cl'), NUC.get(17)!)).toBe(35);
    expect(isotopoPadrao(el('U'), NUC.get(92)!)).toBe(238);
    const tc = el('Tc');
    expect(isotopoPadrao(tc, NUC.get(43)!)).toBe(tc.isotopoMaisEstavel!.a);
  });

  it('só anda por isótopos que existem: o carbono-14 existe, e há um limite', () => {
    const c = NUC.get(6)!;
    expect(vizinhoA(c, 12, 1)).toBe(13);
    expect(vizinhoA(c, 13, 1)).toBe(14);
    const ultimo = Math.max(...c.map((n) => n.a));
    expect(vizinhoA(c, ultimo, 1)).toBeNull();
    const c14 = c.find((n) => n.a === 14)!;
    expect(meiaVidaTexto(c14)).toMatch(/^5[.\s]?700 anos$/);
    expect(c14.decaimento).toBe('β⁻');
    expect(meiaVidaTexto(c.find((n) => n.a === 12)!)).toBe('estável');
    expect(notacaoA('C', 14)).toBe('¹⁴C');
  });

  it('íons: só ânions que existem; cátions marcados como comuns, conhecidos ou de plasma', () => {
    expect(cargasPossiveis(el('Cl')).min).toBe(-1);
    expect(cargasPossiveis(el('Ne')).min).toBe(0); // o neônio não forma ânion
    expect(cargasPossiveis(el('O')).min).toBe(-2);
    expect(tipoIon(el('Na'), 1)).toBe('comum');
    expect(tipoIon(el('Na'), 3)).toBe('plasma');
    expect(tipoIon(el('Fe'), 2)).toBe('comum');
    expect(ionsSugeridos(el('Fe'))).toEqual(expect.arrayContaining([2, 3]));
    expect(textoCarga(-2)).toBe('2−');
    expect(textoCarga(1)).toBe('+');
  });

  it('configuração do íon pela mesma regra da tabela: Fe²⁺ perde os 4s; Cl⁻ completa o 3p', () => {
    expect(formatar(configuracaoDe(el('Fe'), 2)!)).toBe(formatar(configuracaoDe(el('Fe'), 0)!).replace(' 4s²', ''));
    expect(camadas(configuracaoDe(el('Cl'), -1)!)).toEqual([2, 8, 8]);
    expect(camadas(configuracaoDe(el('Na'), 0)!)).toEqual([2, 8, 1]);
    expect(camadas(configuracaoDe(el('Na'), 1)!)).toEqual([2, 8]);
  });

  it('núcleo com A núcleons, Z prótons, e raio que cresce com A^⅓', () => {
    const n = nucleo(26, 30);
    expect(n).toHaveLength(56);
    expect(n.filter((x) => x.proton)).toHaveLength(26);
    const raio = (lista: { pos: number[] }[]) => Math.max(...lista.map((x) => Math.hypot(...x.pos)));
    expect(raio(nucleo(92, 146)) / raio(n)).toBeCloseTo(Math.cbrt(238 / 56), 1);
    expect(nucleo(1, 0)[0].pos).toEqual([0, 0, 0]);
  });

  it('diagrama de orbitais pela regra de Hund e nuvens nas formas certas', () => {
    expect(caixasHund('p', 3)).toEqual([1, 1, 1]);
    expect(caixasHund('p', 4)).toEqual([2, 1, 1]);
    expect(caixasHund('d', 6)).toEqual([2, 1, 1, 1, 1]);
    expect(orbitais({ n: 2, l: 'p', e: 2 }).map((o) => o.forma)).toEqual(['px', 'py']);
    // O orbital pz (o eixo z vira o y da cena) fica ao longo do eixo vertical.
    const pz = nuvem('pz', 2, 400, 1);
    const ao = (i: number) => pz.reduce((s, p) => s + p[i] * p[i], 0);
    expect(ao(1)).toBeGreaterThan(2 * ao(0));
    const s1 = nuvem('s', 1, 400, 2);
    const s3 = nuvem('s', 3, 400, 2);
    const media = (ps: number[][]) => ps.reduce((t, p) => t + Math.hypot(...p), 0) / ps.length;
    expect(media(s3)).toBeGreaterThan(2 * media(s1));
  });
});

describe('ligações químicas', () => {
  it('iônica: fórmula pelo balanço de cargas', () => {
    expect(ligar(el('Na'), el('Cl'))).toMatchObject({ tipo: 'ionica', formula: 'NaCl' });
    expect(ligar(el('Cl'), el('Mg')).formula).toBe('MgCl₂');
    expect(ligar(el('Al'), el('O')).formula).toBe('Al₂O₃');
    expect(ligar(el('Ca'), el('O')).formula).toBe('CaO');
    expect(ligar(el('Na'), el('H')).formula).toBe('NaH');
    expect(formulaIonica('Fe', 3, 'O', -2).formula).toBe('Fe₂O₃');
    expect(carateriIonico(2.23)).toBeCloseTo(0.71, 2);
  });

  it('covalente: moléculas pelo octeto, geometria e polaridade', () => {
    expect(ligar(el('H'), el('O'))).toMatchObject({ formula: 'H₂O', geometria: 'angular', molecula: 'polar', tipo: 'covalente-polar' });
    expect(ligar(el('O'), el('C'))).toMatchObject({ formula: 'CO₂', geometria: 'linear', molecula: 'apolar' });
    expect(ligar(el('C'), el('H'))).toMatchObject({ formula: 'CH₄', geometria: 'tetraédrica', molecula: 'apolar' });
    expect(ligar(el('N'), el('H'))).toMatchObject({ formula: 'NH₃', geometria: 'piramidal', molecula: 'polar' });
    expect(ligar(el('H'), el('Cl'))).toMatchObject({ formula: 'HCl', molecula: 'polar' });
    expect(ligar(el('B'), el('F'))).toMatchObject({ formula: 'BF₃', geometria: 'trigonal plana', molecula: 'apolar' });
    expect(ligar(el('C'), el('Cl'))).toMatchObject({ formula: 'CCl₄', molecula: 'apolar' });
    expect(ligar(el('O'), el('F')).formula).toBe('OF₂');
    // A dupla do CO₂: duas ligações de ordem 2.
    expect(ligar(el('C'), el('O')).estrutura!.ligacoes.map((l) => l.ordem)).toEqual([2, 2]);
  });

  it('moléculas de elementos iguais e redes', () => {
    expect(ligar(el('H'), el('H'))).toMatchObject({ formula: 'H₂', tipo: 'covalente-apolar' });
    expect(ligar(el('O'), el('O')).estrutura!.ligacoes[0].ordem).toBe(2);
    expect(ligar(el('N'), el('N')).estrutura!.ligacoes[0].ordem).toBe(3);
    expect(ligar(el('C'), el('C')).rede).toBe(true);
    expect(ligar(el('Si'), el('O')).rede).toBe(true);
    expect(ligar(el('S'), el('S')).explicacao).toMatch(/S₈/);
  });

  it('metálica, gás nobre e pares que fogem do octeto', () => {
    expect(ligar(el('Fe'), el('Fe')).tipo).toBe('metalica');
    expect(ligar(el('Cu'), el('Zn')).explicacao).toMatch(/latão/);
    expect(ligar(el('Ne'), el('Na')).tipo).toBe('nenhuma');
    expect(ligar(el('N'), el('O')).explicacao).toMatch(/NO₂/);
    expect(ligar(el('S'), el('O')).explicacao).toMatch(/dativa/);
  });

  it('exemplos de dativa têm exatamente uma ligação dativa e o octeto no central', () => {
    for (const d of DATIVAS) {
      expect(d.estrutura.ligacoes.filter((l) => l.dativa), d.key).toHaveLength(1);
    }
  });
});
