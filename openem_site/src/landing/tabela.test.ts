import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import dados from 'virtual:tabela-periodica';
import { atrasoDaOnda, ONDA_MS, sentidoDaTendencia, vizinho } from './tabela';
import { enxugarCatalogo, type ModoDaPrevia } from './tabela-dados';

const CATALOGO = resolve(__dirname, '../../../openem_frontend/src/data/elementos.json');
const casa = (simbolo: string) => dados.casas.find((c) => c.simbolo === simbolo)!;
const modo = (key: string) => dados.modos.find((m) => m.key === key)!;

describe('prévia da tabela periódica: dados extraídos no build', () => {
  it('traz os 118 elementos, na ordem do número atômico, com a posição da IUPAC', () => {
    expect(dados.casas).toHaveLength(118);
    expect(dados.casas.map((c) => c.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(casa('H')).toMatchObject({ linha: 1, coluna: 1 });
    expect(casa('He')).toMatchObject({ linha: 1, coluna: 18 });
    // As séries f ficam embaixo, a partir do grupo 3.
    expect(casa('La')).toMatchObject({ linha: 9, coluna: 3 });
    expect(casa('Ac')).toMatchObject({ linha: 10, coluna: 3 });
  });

  it('usa as regras do app: massa da CIAAW, rótulo da categoria e valor formatado', () => {
    expect(casa('C')).toMatchObject({ nome: 'Carbono', massa: '12,011', categoria: 'Não metal' });
    expect(casa('C').valores.eletronegatividade).toBe('2,55');
    expect(casa('C').valores.raio).toMatch(/^\d+ pm$/);
    expect(casa('C').valores.energiaIonizacao).toMatch(/^\d+ kJ\/mol$/);
    expect(casa('Tc').massa).toBe('[97]');
  });

  it('cada casa tem o tom das categorias e dos três mapas de calor', () => {
    for (const c of dados.casas) {
      expect(c.tons.categoria[0]).toBeTruthy();
      for (const m of ['raio', 'energiaIonizacao', 'eletronegatividade'] as const) {
        const [tom, passo] = c.tons[m];
        if (tom == null) expect(passo).toBeNull();
        else expect(passo).toBeGreaterThanOrEqual(0);
        if (passo != null) expect(passo).toBeLessThanOrEqual(6);
        // Desconhecido é null nos dois lados, nunca um degrau inventado.
        expect(tom == null).toBe(c.valores[m] == null);
      }
    }
    // O flúor é o mais eletronegativo: o último degrau.
    expect(casa('F').tons.eletronegatividade).toEqual(['calor', 6, 0]);
  });

  it('as tendências e os seus sentidos vêm do app', () => {
    expect(dados.modos.map((m) => m.key)).toEqual(['categoria', 'raio', 'energiaIonizacao', 'eletronegatividade']);
    expect(modo('raio')).toMatchObject({ periodo: 'esquerda', grupo: 'baixo' });
    expect(modo('eletronegatividade')).toMatchObject({ periodo: 'direita', grupo: 'cima' });
    expect(dados.categorias).toHaveLength(10);
  });

  it('é bem menor que o catálogo inteiro (só o que a prévia usa)', () => {
    const extraido = JSON.stringify(enxugarCatalogo(JSON.parse(readFileSync(CATALOGO, 'utf8')))).length;
    expect(extraido).toBeLessThan(statSync(CATALOGO).size * 0.2);
  });
});

describe('prévia da tabela periódica: setas do teclado', () => {
  const z = (s: string) => casa(s).z;
  it('anda pela linha e pula o vão entre os grupos 2 e 13', () => {
    expect(vizinho(dados.casas, z('C'), 'direita')).toBe(z('N'));
    expect(vizinho(dados.casas, z('Be'), 'direita')).toBe(z('B'));
    expect(vizinho(dados.casas, z('H'), 'direita')).toBe(z('He'));
  });

  it('anda pela coluna e passa do corpo para as séries f', () => {
    expect(vizinho(dados.casas, z('C'), 'baixo')).toBe(z('Si'));
    expect(vizinho(dados.casas, z('Y'), 'baixo')).toBe(z('La'));
    expect(vizinho(dados.casas, z('La'), 'cima')).toBe(z('Y'));
  });

  it('na borda, fica onde está', () => {
    expect(vizinho(dados.casas, z('H'), 'cima')).toBe(z('H'));
    expect(vizinho(dados.casas, z('H'), 'esquerda')).toBe(z('H'));
    expect(vizinho(dados.casas, z('Lr'), 'baixo')).toBe(z('Lr'));
  });
});

describe('prévia da tabela periódica: onda de cor', () => {
  it('nas tendências, a cor corre no sentido em que a propriedade cresce', () => {
    const eletro = modo('eletronegatividade');
    // Cresce para a direita e para cima: começa no Fr (embaixo, à esquerda) e termina no He.
    expect(atrasoDaOnda(casa('He'), eletro)).toBe(ONDA_MS);
    expect(atrasoDaOnda(casa('Fr'), eletro)).toBeLessThan(atrasoDaOnda(casa('F'), eletro));
    expect(atrasoDaOnda(casa('Na'), eletro)).toBeLessThan(atrasoDaOnda(casa('Cl'), eletro));
    // O raio cresce no sentido oposto.
    const raio = modo('raio');
    expect(atrasoDaOnda(casa('F'), raio)).toBeLessThan(atrasoDaOnda(casa('Fr'), raio));
  });

  it('nas categorias, a cor corre pelo número atômico', () => {
    const cat = modo('categoria');
    expect(atrasoDaOnda(casa('H'), cat)).toBe(0);
    expect(atrasoDaOnda(casa('Og'), cat)).toBe(ONDA_MS);
    expect(atrasoDaOnda(casa('Na'), cat)).toBeLessThan(atrasoDaOnda(casa('K'), cat));
  });

  it('o atraso fica sempre entre 0 e a duração da onda', () => {
    for (const m of dados.modos) {
      for (const c of dados.casas) {
        const a = atrasoDaOnda(c, m);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(ONDA_MS);
      }
    }
  });

  it('descreve o sentido da tendência em português', () => {
    expect(sentidoDaTendencia(modo('eletronegatividade'))).toBe('Cresce para a direita e para cima.');
    expect(sentidoDaTendencia(modo('raio'))).toBe('Cresce para a esquerda e para baixo.');
    expect(sentidoDaTendencia({ key: 'categoria', rotulo: 'Categorias' } as ModoDaPrevia)).toBeNull();
  });
});
