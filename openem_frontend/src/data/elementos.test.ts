// Trava o catálogo da tabela periódica gerado por tools/tabela-periodica: se o
// roteiro regredir (elemento faltando, configuração que não fecha, posição
// trocada, campo sem fonte), é aqui que aparece.
import { describe, expect, it } from 'vitest';
import catalogo from './elementos.json';
import type { Catalogo, Elemento } from '../lib/elementos';
import {
  distribuicaoPauling,
  excecaoAufbau,
  formatarAbreviada,
  lerConfiguracao,
  maisEnergetico,
  ordemGeometrica,
  porCamada,
  totalEletrons,
} from '../lib/configuracao-eletronica';
import { estadoNaTemperatura, TEMPERATURA_AMBIENTE_K } from '../lib/propriedades-periodicas';

const cat = catalogo as unknown as Catalogo;
const lista: Elemento[] = cat.elementos;
const porSimbolo = (s: string) => lista.find((e) => e.simbolo === s)!;

/** As exceções ao Aufbau na configuração do NIST (e a do Lr, 7p¹). */
const EXCECOES_AUFBAU = [
  'Cr', 'Cu', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'La', 'Ce', 'Gd', 'Pt', 'Au', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Cm', 'Lr',
];

/** Campos que todo elemento precisa citar. */
const CAMPOS_COM_FONTE = [
  'simbolo', 'nome', 'nomeEn', 'posicao', 'categoria', 'massa', 'radioativo', 'isotopos', 'natural', 'configuracao',
  'energiaIonizacao', 'eletronegatividade', 'raio', 'afinidade', 'oxidacao', 'oxidacaoComum', 'densidade', 'fusao',
  'ebulicao', 'estado', 'quimica',
];

describe('catálogo da tabela periódica', () => {
  it('tem os 118 elementos, de 1 a 118 sem buraco, com símbolos únicos', () => {
    expect(lista.map((e) => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(lista.map((e) => e.simbolo)).size).toBe(118);
    expect(new Set(lista.map((e) => e.nome)).size).toBe(118);
  });

  it('cada casa da grade tem um elemento só, na posição da IUPAC', () => {
    const casas = new Set(lista.map((e) => `${e.linha}-${e.coluna}`));
    expect(casas.size).toBe(118);
    expect(porSimbolo('H')).toMatchObject({ linha: 1, coluna: 1, grupo: 1 });
    expect(porSimbolo('He')).toMatchObject({ linha: 1, coluna: 18, grupo: 18 });
    expect(porSimbolo('Fe')).toMatchObject({ linha: 4, coluna: 8, grupo: 8, grupoAntigo: '8B' });
    expect(porSimbolo('Ba')).toMatchObject({ linha: 6, coluna: 2 });
    expect(porSimbolo('Hf')).toMatchObject({ linha: 6, coluna: 4 });
    expect(porSimbolo('Og')).toMatchObject({ linha: 7, coluna: 18, grupo: 18 });
    // Lantanídeos e actinídeos nas duas linhas de baixo, do grupo 3 em diante.
    const serie = (de: number, ate: number) => lista.filter((e) => e.z >= de && e.z <= ate);
    expect(serie(57, 71).every((e) => e.linha === 9 && e.bloco === 'f')).toBe(true);
    expect(serie(89, 103).every((e) => e.linha === 10 && e.bloco === 'f')).toBe(true);
    expect(serie(57, 71).map((e) => e.coluna)).toEqual(Array.from({ length: 15 }, (_, i) => i + 3));
  });

  it('a configuração soma Z elétrons e a forma abreviada expande para a completa', () => {
    for (const e of lista) {
      const c = lerConfiguracao(e.configuracao);
      expect(totalEletrons(c), e.simbolo).toBe(e.z);
      const ab = formatarAbreviada(c);
      const m = /^\[(\w+)\]/.exec(ab);
      if (m) {
        const gas = porSimbolo(m[1]);
        expect(gas.categoria, e.simbolo).toBe('gas-nobre');
        // Cerne + o resto = a configuração completa.
        const resto = c.reduce((t, s) => t + s.e, 0) - gas.z;
        expect(resto, e.simbolo).toBeGreaterThan(0);
        expect(lerConfiguracao(gas.configuracao).every((g) => c.some((s) => s.n === g.n && s.l === g.l && s.e >= g.e)), e.simbolo).toBe(true);
      }
    }
  });

  it('os elétrons por camada somam Z', () => {
    for (const e of lista) {
      const camadas = porCamada(lerConfiguracao(e.configuracao));
      expect(camadas.reduce((a, b) => a + b, 0), e.simbolo).toBe(e.z);
      expect(camadas.length, e.simbolo).toBeLessThanOrEqual(7);
    }
  });

  it('período, grupo e bloco são coerentes com a configuração', () => {
    for (const e of lista) {
      const c = lerConfiguracao(e.configuracao);
      // Período = camada mais externa ocupada. O paládio ([Kr] 4d¹⁰) é o único
      // sem elétron na camada do período; pelo diagrama de Pauling, tem.
      expect(Math.max(...distribuicaoPauling(e.z).map((s) => s.n)), e.simbolo).toBe(e.periodo);
      if (e.simbolo !== 'Pd') expect(Math.max(...c.map((s) => s.n)), e.simbolo).toBe(e.periodo);
      // Bloco = subnível do último elétron pelo diagrama de Pauling. Lu e Lr
      // são a exceção: a IUPAC os põe na faixa f (ver nota do grupo 3).
      const ultimo = maisEnergetico(distribuicaoPauling(e.z))!;
      if (e.simbolo === 'Lu' || e.simbolo === 'Lr') expect(ultimo.l).toBe('d');
      else if (e.simbolo === 'He') expect(e.bloco).toBe('s');
      else expect(ultimo.l, e.simbolo).toBe(e.bloco);
      // Grupos s e p: elétrons de valência pela numeração antiga (1A … 8A).
      if (e.bloco === 's' || e.bloco === 'p') {
        const n = e.periodo;
        const valencia = c.filter((s) => s.n === n).reduce((t, s) => t + s.e, 0);
        if (e.simbolo !== 'He') expect(`${valencia}A`, e.simbolo).toBe(e.grupoAntigo);
      }
    }
  });

  it('as exceções ao princípio de Aufbau são exatamente as documentadas', () => {
    const achadas = lista.filter((e) => excecaoAufbau(lerConfiguracao(e.configuracao))).map((e) => e.simbolo);
    expect(achadas).toEqual(EXCECOES_AUFBAU);
  });

  it('as massas batem com a tabela da CIAAW de 2024', () => {
    // As três revisões de 2024, que a tabela impressa da IUPAC ainda não tem.
    expect(porSimbolo('Gd').massa.padrao).toEqual({ valor: '157.249', incerteza: '0.002' });
    expect(porSimbolo('Lu').massa.padrao).toEqual({ valor: '174.96669', incerteza: '0.00005' });
    expect(porSimbolo('Zr').massa.padrao).toEqual({ valor: '91.222', incerteza: '0.003' });
    // Intervalo, abreviada e radioativos.
    expect(porSimbolo('H').massa).toMatchObject({
      padrao: { intervalo: ['1.00784', '1.00811'] },
      abreviado: { valor: '1.0080', incerteza: '0.0002' },
    });
    expect(porSimbolo('C').massa.padrao).toEqual({ intervalo: ['12.0096', '12.0116'] });
    expect(porSimbolo('Fe').massa.padrao).toEqual({ valor: '55.845', incerteza: '0.002' });
    expect(porSimbolo('Pb').massa.abreviado).toEqual({ valor: '207.2', incerteza: '1.1' });
    expect(porSimbolo('Tc').massa).toEqual({ numeroMassa: 97 });
    expect(porSimbolo('Og').massa).toEqual({ numeroMassa: 294 });
    expect(cat.revisaoCiaaw).toBe('2024');
  });

  it('todo elemento tem massa, padrão ou número de massa', () => {
    for (const e of lista) {
      expect(Boolean(e.massa.abreviado) || Boolean(e.massa.numeroMassa), e.simbolo).toBe(true);
      if (!e.massa.abreviado) expect(e.radioativo, e.simbolo).toBe(true);
    }
  });

  it('todo campo tem fonte, e toda fonte está cadastrada com endereço', () => {
    for (const e of lista) {
      for (const campo of CAMPOS_COM_FONTE) {
        expect(e.fontes[campo], `${e.simbolo}.${campo}`).toBeTruthy();
        expect(cat.fontes[e.fontes[campo]], `${e.simbolo}.${campo} → ${e.fontes[campo]}`).toBeTruthy();
      }
    }
    for (const f of Object.values(cat.fontes)) expect(f.url).toMatch(/^https:\/\//);
  });

  it('o estado a 25 °C é o que os pontos de fusão e ebulição dizem', () => {
    for (const e of lista) {
      expect(e.estado ?? null, e.simbolo).toBe(estadoNaTemperatura(e, TEMPERATURA_AMBIENTE_K));
    }
    expect(lista.filter((e) => e.estado === 'liquido').map((e) => e.simbolo)).toEqual(['Br', 'Hg']);
    expect(lista.filter((e) => e.estado === 'gasoso').map((e) => e.simbolo)).toEqual([
      'H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn',
    ]);
  });

  it('o que é previsto ou estimado vem marcado', () => {
    for (const e of lista.filter((x) => x.z >= 104)) expect(e.configuracaoPrevista, e.simbolo).toBe(true);
    for (const e of lista.filter((x) => x.z >= 109)) expect(e.categoriaPrevista, e.simbolo).toBe(true);
    // Superpesados: sem estado medido, nunca um estado sem marcação.
    for (const e of lista.filter((x) => x.z >= 100)) expect(e.estado, e.simbolo).toBeNull();
  });

  it('cada categoria tem o seu texto e cada elemento, o dele', () => {
    for (const e of lista) {
      expect(e.quimica.length, e.simbolo).toBeGreaterThan(40);
      expect(cat.familias[e.categoria], e.categoria).toBeTruthy();
    }
    // Texto do projeto: nada de travessão (a casa usa vírgula e dois-pontos).
    for (const t of [...lista.map((e) => e.quimica), ...Object.values(cat.familias)]) expect(t).not.toMatch(/—/);
  });

  it('isótopos naturais somam 100% e radioativo tem o de vida mais longa', () => {
    for (const e of lista) {
      if (e.isotopos.length) {
        const soma = e.isotopos.reduce((t, i) => t + Number(i.abundancia.replace(/\(.*\)/, '')), 0);
        expect(soma, e.simbolo).toBeGreaterThan(0.99);
        expect(soma, e.simbolo).toBeLessThan(1.01);
      }
      if (e.radioativo) expect(e.isotopoMaisEstavel, e.simbolo).toBeTruthy();
    }
    expect(ordemGeometrica(lerConfiguracao(porSimbolo('Fe').configuracao)).map((s) => `${s.n}${s.l}`)).toEqual([
      '1s', '2s', '2p', '3s', '3p', '3d', '4s',
    ]);
  });
});
