import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import temasDoArquivo from 'virtual:arquivo-redacoes';
import { porAno } from './anos';
import { ANOS_DO_ENEM, provaDoAno, temaRegular } from './prova';

describe('caderno da hero', () => {
  it('os anos vão de 1998 a 2025', () => {
    expect(ANOS_DO_ENEM).toHaveLength(28);
    expect(ANOS_DO_ENEM[0]).toBe(1998);
    expect(ANOS_DO_ENEM[27]).toBe(2025);
  });

  it('até 2008 a prova é única e sem áreas', () => {
    for (const ano of [1998, 2008]) {
      const p = provaDoAno(ano);
      expect(p.unica).toBe(true);
      expect(p.dias).toEqual([]);
      expect(p.questoes).toContain('63 questões');
    }
  });

  it('a ordem das áreas segue a do importador (2009, 2010 a 2016, 2017 em diante)', () => {
    expect(provaDoAno(2009).dias.map((d) => d.areas)).toEqual([
      ['nat', 'hum'],
      ['lin', 'mat'],
    ]);
    expect(provaDoAno(2016).dias.map((d) => d.areas)).toEqual([
      ['hum', 'nat'],
      ['lin', 'mat'],
    ]);
    expect(provaDoAno(2017).dias.map((d) => d.areas)).toEqual([
      ['lin', 'hum'],
      ['nat', 'mat'],
    ]);
  });

  it('a redação muda para o 1º dia em 2017', () => {
    const diaDaRedacao = (ano: number) => provaDoAno(ano).dias.find((d) => d.redacao)?.dia;
    expect(diaDaRedacao(2016)).toBe(2);
    expect(diaDaRedacao(2017)).toBe(1);
    expect(diaDaRedacao(2025)).toBe(1);
  });

  it('todo ano tem tema regular, menos 2008 (caderno sem frase-tema)', () => {
    const anos = porAno(temasDoArquivo);
    for (const ano of ANOS_DO_ENEM) {
      if (ano === 2008) expect(temaRegular(anos, ano)).toBeNull();
      else expect(temaRegular(anos, ano), String(ano)).toBeTruthy();
    }
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

describe('texto da landing', () => {
  it('não usa travessão', () => {
    for (const arquivo of ['Landing.tsx', 'Caderno.tsx', 'prova.ts']) {
      const texto = readFileSync(resolve(__dirname, arquivo), 'utf8');
      // Só o texto visível: comentários de código podem citar faixas de anos.
      const semComentarios = texto.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(semComentarios, arquivo).not.toMatch(/[—–]/);
    }
  });
});
