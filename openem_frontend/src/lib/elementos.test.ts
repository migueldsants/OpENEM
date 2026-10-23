import { describe, expect, it } from 'vitest';
import catalogo from '../data/elementos.json';
import {
  abundanciaTexto,
  buscar,
  CATEGORIAS,
  comIncerteza,
  decimalBr,
  descricaoAcessivel,
  evParaKjMol,
  grupoTexto,
  kelvinParaCelsius,
  massaCurta,
  massaParaConta,
  meiaVidaTexto,
  mover,
  normalizar,
  numeroBr,
  oxidacaoTexto,
  passaFiltro,
  rotuloCategoria,
  sobrescrito,
  temFiltro,
  type Catalogo,
} from './elementos';

const lista = (catalogo as unknown as Catalogo).elementos;
const el = (s: string) => lista.find((e) => e.simbolo === s)!;
const simbolos = (xs: { simbolo: string }[]) => xs.map((x) => x.simbolo);

describe('busca', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizar('  Potássio ')).toBe('potassio');
    expect(normalizar('NIHÔNIO')).toBe('nihonio');
  });

  it('acha por nome sem acento, símbolo ou número', () => {
    expect(simbolos(buscar(lista, 'potassio'))[0]).toBe('K');
    expect(simbolos(buscar(lista, 'k'))[0]).toBe('K');
    expect(simbolos(buscar(lista, '19'))).toEqual(['K']);
    expect(simbolos(buscar(lista, 'FE'))[0]).toBe('Fe');
    expect(simbolos(buscar(lista, 'ouro'))).toEqual(['Au']);
  });

  it('acha pelas variantes e pelo nome em inglês', () => {
    expect(simbolos(buscar(lista, 'oganessonio'))).toEqual(['Og']);
    expect(simbolos(buscar(lista, 'cromio'))).toEqual(['Cr']);
    expect(simbolos(buscar(lista, 'iron'))).toEqual(['Fe']);
  });

  it('ordena: símbolo exato, depois nome que começa, depois que contém', () => {
    const r = simbolos(buscar(lista, 'c'));
    expect(r[0]).toBe('C');
    expect(r).toContain('Ca');
    expect(r).not.toContain('Sc'); // "escândio" não começa com c e o termo é curto
    expect(simbolos(buscar(lista, 'andio'))).toContain('Sc'); // a partir de 3 letras, "contém" vale
    expect(simbolos(buscar(lista, 'carbono'))[0]).toBe('C');
  });

  it('sem termo, sem resultado; número fora da tabela não acha nada', () => {
    expect(buscar(lista, '  ')).toEqual([]);
    expect(buscar(lista, '0')).toEqual([]);
    expect(buscar(lista, '119')).toEqual([]);
    expect(buscar(lista, 'xyzw')).toEqual([]);
  });
});

describe('filtros', () => {
  it('cruzam os critérios ligados', () => {
    expect(temFiltro({})).toBe(false);
    expect(temFiltro({ bloco: 'p' })).toBe(true);
    expect(temFiltro({ grupo: 1 })).toBe(true);
    expect(temFiltro({ periodo: 3 })).toBe(true);
    expect(temFiltro({ categoria: 'halogenio' })).toBe(true);
    const halogenios = lista.filter((e) => passaFiltro(e, { categoria: 'halogenio' }));
    expect(simbolos(halogenios)).toEqual(['F', 'Cl', 'Br', 'I', 'At', 'Ts']);
    expect(simbolos(lista.filter((e) => passaFiltro(e, { grupo: 17, periodo: 4 })))).toEqual(['Br']);
    expect(lista.filter((e) => passaFiltro(e, { bloco: 'f' }))).toHaveLength(30);
    expect(lista.filter((e) => passaFiltro(e, { periodo: 1 }))).toHaveLength(2);
    expect(lista.filter((e) => passaFiltro(e, {}))).toHaveLength(118);
  });
});

describe('navegação pela grade', () => {
  it('pula as casas vazias na linha', () => {
    expect(mover(lista, 1, 'direita')).toBe(2);
    expect(mover(lista, 2, 'esquerda')).toBe(1);
    expect(mover(lista, 4, 'direita')).toBe(5);
    expect(mover(lista, 56, 'direita')).toBe(72); // Ba → Hf
  });

  it('para na borda', () => {
    expect(mover(lista, 2, 'direita')).toBe(2);
    expect(mover(lista, 1, 'esquerda')).toBe(1);
    expect(mover(lista, 1, 'cima')).toBe(1);
    expect(mover(lista, 103, 'baixo')).toBe(103);
  });

  it('anda na coluna pulando linhas sem elemento', () => {
    expect(mover(lista, 1, 'baixo')).toBe(3);
    expect(mover(lista, 3, 'cima')).toBe(1);
    expect(mover(lista, 2, 'baixo')).toBe(10);
    expect(mover(lista, 5, 'cima')).toBe(5); // nada acima do B
    expect(mover(lista, 21, 'cima')).toBe(21);
    // Y (grupo 3) desce para o La, na faixa dos lantanídeos.
    expect(mover(lista, 39, 'baixo')).toBe(57);
    expect(mover(lista, 57, 'cima')).toBe(39);
    expect(mover(lista, 57, 'baixo')).toBe(89);
    expect(mover(lista, 104, 'baixo')).toBe(58); // Rf → Ce
  });

  it('Home e End vão às pontas da linha', () => {
    expect(mover(lista, 26, 'inicio')).toBe(19);
    expect(mover(lista, 26, 'fim')).toBe(36);
    expect(mover(lista, 60, 'fim')).toBe(71);
  });

  it('número desconhecido fica onde está', () => {
    expect(mover(lista, 200, 'direita')).toBe(200);
  });
});

describe('textos e números', () => {
  it('descreve para o leitor de tela', () => {
    expect(descricaoAcessivel(el('Fe'))).toBe('Ferro, número atômico 26, metal de transição');
    expect(descricaoAcessivel(el('Og'))).toBe('Oganessono, número atômico 118, gás nobre (previsto)');
    expect(rotuloCategoria(el('Na'))).toBe('Metal alcalino');
    expect(CATEGORIAS).toHaveLength(10);
  });

  it('dá o grupo nas duas numerações', () => {
    expect(grupoTexto(el('Na'))).toBe('1 (1A)');
    expect(grupoTexto(el('Fe'))).toBe('8 (8B)');
    expect(grupoTexto(el('Ce'))).toBe('3 (3B), na série do grupo 3');
  });

  it('formata massa, incerteza e números no padrão brasileiro', () => {
    expect(massaCurta(el('Fe'))).toBe('55,845');
    expect(massaCurta(el('Tc'))).toBe('[97]');
    expect(massaParaConta(el('Fe'))).toBe(55.845);
    expect(massaParaConta(el('Tc'))).toBe(97);
    expect(comIncerteza({ valor: '157.249', incerteza: '0.002' })).toBe('157,249(2)');
    expect(comIncerteza({ valor: '173.045', incerteza: '0.010' })).toBe('173,045(10)');
    expect(decimalBr('1.0080')).toBe('1,0080');
    expect(numeroBr(3.14159)).toBe('3,14');
    expect(numeroBr(2.5, 0)).toBe('3');
    expect(numeroBr(12345.6, 1)).toBe('12345,6');
  });

  it('converte unidades', () => {
    expect(evParaKjMol(1)).toBeCloseTo(96.485, 3);
    expect(kelvinParaCelsius(273.15)).toBe(0);
  });

  it('escreve a meia-vida por extenso', () => {
    expect(meiaVidaTexto({ valor: '4.21', incerteza: '0.16', unidade: 'Ma' })).toBe('4,21 milhões de anos');
    expect(meiaVidaTexto({ valor: '1.38', incerteza: '0.25', unidade: 'ka' })).toBe('1,38 mil anos');
    expect(meiaVidaTexto({ valor: '1.5', incerteza: null, unidade: 'h' })).toBe('1,5 hora');
    expect(meiaVidaTexto({ valor: '22.00', incerteza: '0.07', unidade: 'min' })).toBe('22,00 minutos');
    expect(meiaVidaTexto({ valor: '4', incerteza: null, unidade: 'h', aproximado: true })).toBe('cerca de 4 horas');
    expect(meiaVidaTexto({ valor: '2.01E19', incerteza: '8', unidade: 'Y' })).toBe('2,01 × 10¹⁹ anos');
    expect(meiaVidaTexto({ valor: '0.7', incerteza: '0.3', unidade: 'ms' })).toBe('0,7 milissegundo');
    expect(meiaVidaTexto({ valor: '3', incerteza: null, unidade: 'xx' })).toBe('3 xx');
  });

  it('escreve abundância, sobrescrito e estado de oxidação', () => {
    expect(abundanciaTexto('0.91754(36)')).toBe('91,754%');
    expect(abundanciaTexto('1')).toBe('100%');
    expect(abundanciaTexto('0.999885(70)')).toBe('99,9885%');
    expect(sobrescrito(19)).toBe('¹⁹');
    expect(sobrescrito('2+')).toBe('²⁺');
    expect(oxidacaoTexto(3)).toBe('+3');
    expect(oxidacaoTexto(-2)).toBe('−2');
    expect(oxidacaoTexto(0)).toBe('0');
  });
});

describe('fontes', () => {
  it('toda fonte do catálogo tem um nome curto e a data vem no padrão brasileiro', async () => {
    const { ROTULO_FONTE, dataBr } = await import('./elementos');
    for (const id of Object.keys((catalogo as unknown as Catalogo).fontes)) expect(ROTULO_FONTE[id], id).toBeTruthy();
    expect(dataBr('2026-10-23')).toBe('23/10/2026');
  });
});

describe('íons', () => {
  it('escreve a carga em sobrescrito', async () => {
    const { rotuloIon } = await import('./elementos');
    expect(rotuloIon('Fe', 2)).toBe('Fe²⁺');
    expect(rotuloIon('Na', 1)).toBe('Na⁺');
    expect(rotuloIon('Cl', -1)).toBe('Cl⁻');
    expect(rotuloIon('O', -2)).toBe('O²⁻');
    expect(rotuloIon('Ar', 0)).toBe('Ar');
  });
});
