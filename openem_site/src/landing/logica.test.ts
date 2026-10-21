import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import temasDoArquivo from 'virtual:arquivo-redacoes';
import { porAno } from './anos';
import { ETAPAS, fracaoDaRegua, marcasDaRegua, minutoDaEtapa } from './hora';
import { proximaQuestao, QUESTOES } from './questoes';
import { FAMILIAS, ladoDaVitrine } from './temas';

describe('régua da hora', () => {
  it('começa em 0, marca o fim de cada etapa e fecha em 60', () => {
    expect(minutoDaEtapa(-1)).toBe(0);
    expect(ETAPAS.map((_, i) => minutoDaEtapa(i))).toEqual(ETAPAS.map((e) => e.fim));
    expect(minutoDaEtapa(ETAPAS.length)).toBe(60);
    expect(minutoDaEtapa(99)).toBe(60);
  });

  it('as etapas cobrem a hora inteira, sem buraco nem sobreposição', () => {
    expect(ETAPAS[0].inicio).toBe(0);
    for (let i = 1; i < ETAPAS.length; i++) expect(ETAPAS[i].inicio).toBe(ETAPAS[i - 1].fim);
    expect(ETAPAS[ETAPAS.length - 1].fim).toBe(60);
  });

  it('converte minuto em fração da régua, presa entre 0 e 1', () => {
    expect(fracaoDaRegua(0)).toBe(0);
    expect(fracaoDaRegua(30)).toBe(0.5);
    expect(fracaoDaRegua(-5)).toBe(0);
    expect(fracaoDaRegua(90)).toBe(1);
  });

  it('cada etapa tem a captura do app nos dois temas', () => {
    for (const e of ETAPAS) {
      for (const lado of ['clara', 'escura']) {
        expect(existsSync(resolve(process.cwd(), `public/telas/${e.id}-${lado}.webp`)), `${e.id}-${lado}`).toBe(true);
      }
    }
  });

  it('tem marca a cada 5 minutos e rótulo a cada 10', () => {
    const marcas = marcasDaRegua();
    expect(marcas).toHaveLength(13);
    expect(marcas.filter((m) => m.rotulo).map((m) => m.minuto)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });
});

describe('questões da landing', () => {
  it('cada questão tem cinco alternativas A a E e o gabarito entre elas', () => {
    for (const q of QUESTOES) {
      expect(q.alternativas.map((a) => a.letra)).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(q.alternativas.some((a) => a.letra === q.correta)).toBe(true);
      expect(q.resolucao.length).toBeGreaterThan(40);
    }
  });

  it('a roda de questões volta ao começo', () => {
    expect(proximaQuestao(0, 3)).toBe(1);
    expect(proximaQuestao(2, 3)).toBe(0);
  });

  it('nenhum texto da landing usa travessão', () => {
    const textos = [
      ...QUESTOES.flatMap((q) => [q.resolucao, q.comando, ...q.enunciado]),
      ...ETAPAS.flatMap((e) => [e.titulo, e.texto, e.alt]),
    ];
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });
});

describe('arquivo de redações', () => {
  it('vem do catálogo do app: 48 temas de 1998 a 2025', () => {
    expect(temasDoArquivo).toHaveLength(48);
    const anos = porAno(temasDoArquivo);
    expect(anos[0].ano).toBe(1998);
    expect(anos[anos.length - 1].ano).toBe(2025);
    expect(anos).toHaveLength(28);
  });

  it('agrupa por ano com a aplicação regular primeiro', () => {
    const anos = porAno([
      { ano: 2020, aplicacao: 'ppl', rotulo: 'PPL', tema: 'b' },
      { ano: 2020, aplicacao: 'regular', rotulo: 'Regular', tema: 'a' },
      { ano: 2019, aplicacao: 'regular', rotulo: 'Regular', tema: 'c' },
    ]);
    expect(anos.map((a) => a.ano)).toEqual([2019, 2020]);
    expect(anos[1].temas.map((t) => t.aplicacao)).toEqual(['regular', 'ppl']);
  });
});

describe('faixa de temas', () => {
  it('acompanha as famílias do app (src/theme.tsx)', () => {
    const fonte = readFileSync(resolve(process.cwd(), '../openem_frontend/src/theme.tsx'), 'utf8');
    const bloco = fonte.slice(fonte.indexOf('export const FAMILIES'));
    const doApp = [...bloco.matchAll(/\{\s*key:\s*'([a-z]+)',\s*label:\s*'([^']+)'/g)].map((m) => ({
      key: m[1],
      label: m[2],
    }));
    expect(FAMILIAS).toEqual(doApp);
  });

  it('as famílias OLED aparecem no lado escuro', () => {
    expect(ladoDaVitrine('oled')).toBe('dark');
    expect(['light', 'dark']).toContain(ladoDaVitrine('default'));
  });
});
