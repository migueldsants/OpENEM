import { describe, expect, it } from 'vitest';
import {
  abreviada,
  distribuicaoIon,
  distribuicaoPauling,
  excecaoAufbau,
  formatar,
  formatarAbreviada,
  formatarSimples,
  lerConfiguracao,
  lerSubnivel,
  maisEnergetico,
  mesmaDistribuicao,
  ordemEnergetica,
  ordemGeometrica,
  passosDistribuicao,
  porCamada,
  totalEletrons,
  valencia,
} from './configuracao-eletronica';

const FE = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p6', '3d6', '4s2']);
const CR = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p6', '3d5', '4s1']);
const CU = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s1']);
const CL = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p5']);

describe('leitura e formatação', () => {
  it('lê subníveis com contagem', () => {
    expect(lerSubnivel('3d6')).toEqual({ n: 3, l: 'd', e: 6 });
    expect(lerSubnivel('4f14')).toEqual({ n: 4, l: 'f', e: 14 });
    expect(() => lerSubnivel('3x2')).toThrow();
    expect(() => lerSubnivel('3d')).toThrow();
  });

  it('formata com sobrescritos e em texto simples', () => {
    expect(formatar(FE)).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²');
    expect(formatarSimples(ordemEnergetica(FE))).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6');
    expect(formatar([{ n: 4, l: 'f', e: 14 }, { n: 5, l: 'd', e: 0 }])).toBe('4f¹⁴');
  });

  it('ordena pela energia (Pauling) e pela camada', () => {
    expect(formatarSimples(ordemEnergetica(FE))).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6');
    expect(formatarSimples(ordemGeometrica(ordemEnergetica(FE)))).toBe('1s2 2s2 2p6 3s2 3p6 3d6 4s2');
  });
});

describe('diagrama de Pauling', () => {
  it('preenche na ordem das diagonais', () => {
    expect(formatarSimples(distribuicaoPauling(1))).toBe('1s1');
    expect(formatarSimples(distribuicaoPauling(20))).toBe('1s2 2s2 2p6 3s2 3p6 4s2');
    expect(formatarSimples(distribuicaoPauling(26))).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6');
    expect(formatarSimples(distribuicaoPauling(57))).toContain('6s2 4f1');
    expect(totalEletrons(distribuicaoPauling(118))).toBe(118);
    expect(distribuicaoPauling(0)).toEqual([]);
  });

  it('reconhece as exceções e devolve a prevista', () => {
    expect(excecaoAufbau(FE)).toBeNull();
    expect(formatarSimples(excecaoAufbau(CR)!)).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d4');
    expect(formatarSimples(excecaoAufbau(CU)!)).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d9');
  });

  it('compara distribuições pela contagem, sem ligar para a ordem', () => {
    expect(mesmaDistribuicao(FE, ordemEnergetica(FE))).toBe(true);
    expect(mesmaDistribuicao(FE, CR)).toBe(false);
    expect(mesmaDistribuicao(FE, [...FE, { n: 5, l: 's', e: 0 }])).toBe(true);
    expect(mesmaDistribuicao(FE, FE.slice(1))).toBe(false);
  });
});

describe('forma abreviada, camadas e valência', () => {
  it('usa o gás nobre anterior como cerne, em ordem energética', () => {
    expect(formatarAbreviada(FE)).toBe('[Ar] 4s² 3d⁶');
    expect(formatarAbreviada(CL)).toBe('[Ne] 3s² 3p⁵');
    expect(formatarAbreviada(lerConfiguracao(['1s1']))).toBe('1s¹');
    expect(formatarAbreviada(lerConfiguracao(['1s2']))).toBe('1s²');
    // O neônio abrevia com o hélio, não com ele mesmo.
    expect(formatarAbreviada(lerConfiguracao(['1s2', '2s2', '2p6']))).toBe('[He] 2s² 2p⁶');
    expect(abreviada(FE).cerne).toBe('Ar');
  });

  it('não usa um cerne que a configuração não contém inteiro', () => {
    // Paládio: [Kr] 4d¹⁰, sem 5s.
    const pd = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s2', '4p6', '4d10']);
    expect(formatarAbreviada(pd)).toBe('[Kr] 4d¹⁰');
    // Um íon com 3p incompleto não pode abreviar com o Ar.
    expect(abreviada(lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p5', '4s1'])).cerne).toBe('Ne');
  });

  it('conta elétrons por camada', () => {
    expect(porCamada(FE)).toEqual([2, 8, 14, 2]);
    expect(porCamada(CL)).toEqual([2, 8, 7]);
    expect(porCamada([])).toEqual([]);
  });

  it('acha a camada de valência e o subnível mais energético', () => {
    expect(valencia(FE)).toEqual({ n: 4, camada: 'N', eletrons: 2 });
    expect(valencia(CL)).toEqual({ n: 3, camada: 'M', eletrons: 7 });
    expect(maisEnergetico(FE)).toEqual({ n: 3, l: 'd', e: 6 });
    expect(maisEnergetico(CL)).toEqual({ n: 3, l: 'p', e: 5 });
    expect(maisEnergetico([])).toBeNull();
  });
});

describe('íons', () => {
  it('cátion perde primeiro da camada mais externa (4s antes de 3d)', () => {
    expect(formatarAbreviada(distribuicaoIon(FE, 2)!)).toBe('[Ar] 3d⁶');
    expect(formatarAbreviada(distribuicaoIon(FE, 3)!)).toBe('[Ar] 3d⁵');
    expect(formatarAbreviada(distribuicaoIon(CU, 2)!)).toBe('[Ar] 3d⁹');
    expect(formatarAbreviada(distribuicaoIon(CR, 3)!)).toBe('[Ar] 3d³');
  });

  it('no mesmo nível, p sai antes de s (Sn²⁺ guarda o 5s²)', () => {
    const sn = lerConfiguracao(['1s2', '2s2', '2p6', '3s2', '3p6', '3d10', '4s2', '4p6', '4d10', '5s2', '5p2']);
    expect(formatarAbreviada(distribuicaoIon(sn, 2)!)).toBe('[Kr] 5s² 4d¹⁰');
    expect(formatarAbreviada(distribuicaoIon(sn, 4)!)).toBe('[Kr] 4d¹⁰');
  });

  it('ânion ganha na ordem de Pauling', () => {
    expect(formatarAbreviada(distribuicaoIon(CL, -1)!)).toBe('[Ne] 3s² 3p⁶');
    const o = lerConfiguracao(['1s2', '2s2', '2p4']);
    expect(formatarAbreviada(distribuicaoIon(o, -2)!)).toBe('[He] 2s² 2p⁶');
    const h = lerConfiguracao(['1s1']);
    expect(formatar(distribuicaoIon(h, -1)!)).toBe('1s²');
    // Depois de completar o 3p, o próximo entra no 4s.
    expect(formatarSimples(distribuicaoIon(CL, -2)!)).toBe('1s2 2s2 2p6 3s2 3p6 4s1');
  });

  it('recusa tirar mais elétrons do que há', () => {
    expect(distribuicaoIon(lerConfiguracao(['1s1']), 2)).toBeNull();
    expect(formatar(distribuicaoIon(lerConfiguracao(['1s1']), 1)!)).toBe('');
    expect(distribuicaoIon(FE, 0)).toEqual(ordemGeometrica(FE));
  });
});

describe('passo a passo', () => {
  it('enche o diagrama um subnível por quadro', () => {
    const p = passosDistribuicao(lerConfiguracao(['1s2', '2s2', '2p3']));
    expect(p.map((x) => x.destaque)).toEqual(['1s', '2s', '2p']);
    expect(p.every((x) => x.tipo === 'encher')).toBe(true);
    expect(p[2].ocupacao).toEqual({ '1s': 2, '2s': 2, '2p': 3 });
    expect(p[2].texto).toBe('2p³');
  });

  it('mostra o ajuste de uma exceção', () => {
    const p = passosDistribuicao(CR);
    const ultimo = p[p.length - 1];
    expect(ultimo.tipo).toBe('ajuste');
    expect(ultimo.ocupacao['3d']).toBe(5);
    expect(ultimo.ocupacao['4s']).toBe(1);
    expect(ultimo.destaque).toBe('3d');
    expect(ultimo.texto).toBe('Na realidade: [Ar] 4s¹ 3d⁵');
    expect(p[p.length - 2].ocupacao['3d']).toBe(4);
  });

  it('tira os elétrons do íon um subnível por quadro, de fora para dentro', () => {
    const p = passosDistribuicao(FE, 3);
    const ion = p.filter((x) => x.tipo === 'retirar');
    expect(ion.map((x) => x.destaque)).toEqual(['4s', '3d']);
    expect(ion[0].texto).toBe('saem 2 de 4s');
    expect(ion[1].texto).toBe('sai 1 de 3d');
    expect(ion[0].ocupacao['4s']).toBeUndefined();
    expect(ion[1].ocupacao['3d']).toBe(5);
  });

  it('acrescenta os elétrons do ânion', () => {
    const p = passosDistribuicao(CL, -1);
    const ultimo = p[p.length - 1];
    expect(ultimo).toMatchObject({ tipo: 'acrescentar', destaque: '3p', texto: 'entra 1 em 3p' });
    expect(ultimo.ocupacao['3p']).toBe(6);
    const o = passosDistribuicao(lerConfiguracao(['1s2', '2s2', '2p4']), -2);
    expect(o[o.length - 1].texto).toBe('entram 2 em 2p');
  });

  it('carga impossível não acrescenta quadros de íon', () => {
    expect(passosDistribuicao(lerConfiguracao(['1s1']), 3)).toHaveLength(1);
  });
});
