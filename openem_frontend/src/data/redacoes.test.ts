// Trava a estrutura do catálogo de redações gerado por tools/enem-fix/redacao:
// se o extrator regredir (texto ilegível, figura sem descrição, arquivo que
// sumiu), é aqui que aparece.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import catalogo from './redacoes.json';
import type { PropostaRedacao } from '../lib/redacoes';

const lista = catalogo as PropostaRedacao[];
const publico = join(__dirname, '..', '..', 'public');

describe('catálogo de redações', () => {
  it('cobre toda aplicação regular de 1998 a 2025', () => {
    const anos = lista
      .filter((p) => p.aplicacao === 'regular')
      .map((p) => p.ano)
      .sort((a, b) => a - b);
    expect(anos).toEqual(Array.from({ length: 28 }, (_, i) => 1998 + i));
  });

  it('traz o PPL/reaplicação de 2010 a 2025', () => {
    const anos = lista
      .filter((p) => p.aplicacao === 'ppl')
      .map((p) => p.ano)
      .sort((a, b) => a - b);
    expect(anos).toEqual(Array.from({ length: 16 }, (_, i) => 2010 + i));
  });

  it('não repete id e vem do mais recente para o mais antigo', () => {
    expect(new Set(lista.map((p) => p.id)).size).toBe(lista.length);
    const anos = lista.map((p) => p.ano);
    expect(anos).toEqual([...anos].sort((a, b) => b - a));
  });

  it('todos os cadernos têm fac-símile da página', () => {
    // Nenhum caderno deve ficar sem a página do caderno.
    // Qualquer caderno sem página é regressão do extrator.
    expect(
      lista
        .filter((p) => p.paginas.length === 0)
        .map((p) => p.id)
        .sort(),
    ).toEqual([]);
  });

  it('mantém a grafia do tema como está no caderno', () => {
    const tema = (id: string) => lista.find((p) => p.id === id)?.tema;
    expect(tema('2011-regular')).toBe(
      'VIVER EM REDE NO SÉCULO XXI: OS LIMITES ENTRE O PÚBLICO E O PRIVADO',
    );
    expect(tema('2010-regular')).toBe('O Trabalho na Construção da Dignidade Humana');
    expect(tema('2012-ppl')).toBe('O GRUPO FORTALECE O INDIVÍDUO?');
  });

  it.each(lista.map((p) => [p.id, p] as const))(
    '%s tem tema, proposta, textos e fonte oficial',
    (_id, p) => {
      // Só 2008 não tem frase-tema no caderno; nos demais, o tema está no
      // comando com a mesma grafia (nada de título reescrito).
      if (p.semTema) expect(p.tema).toBe('');
      else {
        expect(p.tema.trim().length).toBeGreaterThan(8);
        expect(p.proposta).toContain(p.tema);
      }
      expect(Boolean(p.semTema)).toBe(p.id === '2008-regular');
      if (p.propostaPartes) {
        expect(p.propostaPartes.map((x) => x.t).join('')).toBe(p.proposta);
      }
      expect(p.aplicacaoRotulo).toBeTruthy();
      expect(p.proposta.length).toBeGreaterThan(80);
      expect(p.textos.length).toBeGreaterThan(0);
      expect(p.fonteUrl).toMatch(/^https:\/\/download\.inep\.gov\.br\/.+\.pdf$/);

      // Até 2013 o caderno não numera os textos: rótulo só onde ele existe.
      const rotulos = p.textos.map((t) => t.rotulo);
      if (p.ano <= 2013) expect(rotulos.every((r) => r === '')).toBe(true);
      else {
        expect(rotulos.every((r) => /^Texto [IVX]+$/.test(r))).toBe(true);
        expect(new Set(rotulos).size).toBe(rotulos.length);
      }

      for (const pg of p.paginas) {
        expect(pg.src).toMatch(/^\/redacoes\/[\w-]+-pagina(-\d+)?\.webp$/);
        expect(existsSync(join(publico, pg.src))).toBe(true);
      }

      for (const t of p.textos) {
        expect(t.blocos.length).toBeGreaterThan(0);
        for (const b of t.blocos) {
          if (b.t === 'img') {
            // Figura sem descrição some para quem usa leitor de tela.
            expect(b.alt.length).toBeGreaterThan(20);
            expect(b.src).toMatch(/^\/redacoes\/[\w-]+\.webp$/);
            expect(existsSync(join(publico, b.src))).toBe(true);
            expect(b.w).toBeGreaterThan(50);
            expect(b.h).toBeGreaterThan(50);
          } else {
            expect(b.texto.trim()).not.toBe('');
            // O negrito/itálico é só marcação: juntando as partes, dá o texto.
            if (b.partes) {
              expect(b.partes.map((x) => x.t).join('')).toBe(b.texto);
              expect(b.partes.some((x) => x.b || x.i)).toBe(true);
            }
            // Resíduo de fonte sem mapeamento ou de rótulo que vazou.
            expect(b.texto).not.toMatch(/[�-]/);
            expect(b.texto).not.toMatch(/\bTEXTO [IVX]+\b/);
            expect(b.texto).not.toMatch(/INSTRUÇÕES|PROPOSTA DE REDAÇÃO/);
          }
        }
      }
    },
  );
});
