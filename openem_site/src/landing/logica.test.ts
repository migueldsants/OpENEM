import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import temasDoArquivo from 'virtual:arquivo-redacoes';
import { porAno } from './anos';
import { abaVizinha, TELAS } from './depois';
import { ANOS_DO_ENEM, anoDaQuestao, proximaQuestao, QUESTOES } from './questoes';

describe('janela do app', () => {
  it('cada tela tem a captura de desktop e a de celular nos dois temas', () => {
    for (const t of TELAS) {
      for (const lado of ['clara', 'escura']) {
        for (const arquivo of [`${t.id}-desktop-${lado}.webp`, `${t.id}-${lado}.webp`]) {
          const caminho = resolve(process.cwd(), 'public/telas', arquivo);
          expect(existsSync(caminho), arquivo).toBe(true);
          expect(existsSync(`${caminho}.json`), `${arquivo}.json`).toBe(true);
        }
      }
    }
  });

  it('as setas dão a volta nas pontas', () => {
    expect(abaVizinha(0, -1, 4)).toBe(3);
    expect(abaVizinha(3, 1, 4)).toBe(0);
    expect(abaVizinha(1, 1, 4)).toBe(2);
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

  it('a faixa de anos vai de 1998 a 2025 e cada questão cai num ano dela', () => {
    expect(ANOS_DO_ENEM).toHaveLength(28);
    expect(ANOS_DO_ENEM[0]).toBe(1998);
    expect(ANOS_DO_ENEM[27]).toBe(2025);
    const anos = QUESTOES.map(anoDaQuestao);
    for (const ano of anos) expect(ANOS_DO_ENEM).toContain(ano);
    expect(new Set(anos).size).toBe(anos.length);
  });

  it('a roda de questões volta ao começo', () => {
    expect(proximaQuestao(0, 3)).toBe(1);
    expect(proximaQuestao(2, 3)).toBe(0);
  });

  it('nenhum texto da landing usa travessão', () => {
    const textos = [
      ...QUESTOES.flatMap((q) => [q.resolucao, q.comando, ...q.enunciado]),
      ...TELAS.flatMap((t) => [t.titulo, t.texto, t.alt]),
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
