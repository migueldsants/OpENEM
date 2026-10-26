import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGINAS, PAGINAS_EN } from '../docs/conteudo';
import {
  dataPorExtenso,
  DOCUMENTOS,
  documentoPorUrl,
  lerAtualizado,
  lerCaminhoLegal,
  lerUrl,
  montarDocumentos,
  urlDoDocumento,
} from './documentos';

// A versão que o cadastro grava (User.termsVersion) mora no backend.
const TERMS_TS = readFileSync(
  resolve(__dirname, '../../../openem_backend/src/common/terms.ts'),
  'utf8',
);
const TERMS_VERSION = /TERMS_VERSION = '([^']+)'/.exec(TERMS_TS)?.[1];

describe('endereços', () => {
  it('lê slug e idioma das quatro páginas, com ou sem a barra final', () => {
    expect(lerUrl('/privacidade/')).toEqual({ slug: 'privacidade', idioma: 'pt' });
    expect(lerUrl('/termos')).toEqual({ slug: 'termos', idioma: 'pt' });
    expect(lerUrl('/en/privacidade/')).toEqual({ slug: 'privacidade', idioma: 'en' });
    expect(lerUrl('/en/termos')).toEqual({ slug: 'termos', idioma: 'en' });
    expect(lerUrl('/docs/')).toBeNull();
    expect(lerUrl('/privacidade/outra/')).toBeNull();
  });

  it('monta a URL de volta', () => {
    expect(urlDoDocumento('termos', 'pt')).toBe('/termos/');
    expect(urlDoDocumento('privacidade', 'en')).toBe('/en/privacidade/');
  });

  it('lê o caminho do arquivo e o cabeçalho atualizado', () => {
    expect(lerCaminhoLegal('./conteudo/en/termos.md')).toEqual({ slug: 'termos', idioma: 'en' });
    expect(lerCaminhoLegal('./conteudo/outro.md')).toBeNull();
    expect(lerAtualizado('---\r\ntitulo: X\r\natualizado: 2026-01-02\r\n---\r\n')).toBe('2026-01-02');
    expect(lerAtualizado('sem cabeçalho')).toBe('');
  });

  it('monta e ordena os documentos: privacidade antes de termos, português antes do inglês', () => {
    const docs = montarDocumentos({
      './conteudo/en/termos.md': '---\ntitulo: Terms\n---\n',
      './conteudo/termos.md': '---\ntitulo: Termos\n---\n',
      './conteudo/privacidade.md': '---\n---\n',
    });
    expect(docs.map((d) => d.url)).toEqual(['/privacidade/', '/termos/', '/en/termos/']);
    expect(docs[0].titulo).toBe('privacidade');
    expect(docs[2].arquivo).toBe('openem_site/src/legal/conteudo/en/termos.md');
  });

  it('data por extenso nos dois idiomas, sem depender do fuso', () => {
    expect(dataPorExtenso('2026-10-25', 'pt')).toBe('25 de outubro de 2026');
    expect(dataPorExtenso('2026-10-25', 'en')).toBe('October 25, 2026');
    expect(dataPorExtenso('', 'pt')).toBe('');
  });
});

describe('documentos publicados', () => {
  it('privacidade e termos, em português e em inglês', () => {
    expect(DOCUMENTOS.map((d) => d.url).sort()).toEqual([
      '/en/privacidade/',
      '/en/termos/',
      '/privacidade/',
      '/termos/',
    ]);
    expect(documentoPorUrl('/en/termos')?.titulo).toBe('Terms of Use');
  });

  it('a data de cada página é a versão que o cadastro grava (TERMS_VERSION)', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const d of DOCUMENTOS) expect(d.atualizado, d.arquivo).toBe(TERMS_VERSION);
  });

  it('título, descrição, nenhum travessão e nenhum H1', () => {
    for (const d of DOCUMENTOS) {
      expect(d.titulo, d.arquivo).not.toBe('');
      expect(d.descricao, d.arquivo).not.toBe('');
      expect(d.corpo, d.arquivo).not.toMatch(/[—–]/);
      expect(d.corpo, d.arquivo).not.toMatch(/^# /m);
    }
  });

  it('a tradução tem as mesmas seções do português', () => {
    const secoes = (corpo: string) => (corpo.match(/^#{2,3} /gm) ?? []).join('');
    for (const slug of ['privacidade', 'termos'] as const) {
      const pt = documentoPorUrl(urlDoDocumento(slug, 'pt'))!;
      const en = documentoPorUrl(urlDoDocumento(slug, 'en'))!;
      expect(secoes(en.corpo), slug).toBe(secoes(pt.corpo));
      expect(en.corpo.match(/PLACEHOLDER/g)?.length, slug).toBe(pt.corpo.match(/PLACEHOLDER/g)?.length);
    }
  });

  it('os links internos existem, e a página em inglês só aponta para o inglês', () => {
    const urls = new Set([
      '/',
      '/docs/',
      '/docs/en/',
      ...DOCUMENTOS.map((d) => d.url),
      ...PAGINAS.map((p) => p.url),
      ...PAGINAS_EN.map((p) => p.url),
    ]);
    for (const d of DOCUMENTOS) {
      for (const [, alvo] of d.corpo.matchAll(/\]\((\/[^)#\s]*)/g)) {
        expect(urls.has(alvo), `${d.arquivo} -> ${alvo}`).toBe(true);
        if (d.idioma === 'en') expect(alvo, d.arquivo).toMatch(/^\/(en|docs\/en)\//);
      }
    }
  });
});

describe('o que a Política de Privacidade cobre', () => {
  const politica = documentoPorUrl('/privacidade/')!.corpo;

  it('cada dado coletado diz finalidade, base legal, retenção e com quem é compartilhado', () => {
    const coleta = politica.split(/^## /m).find((s) => s.startsWith('Quais dados coletamos'))!;
    const dados = coleta.split(/^### /m).slice(1);
    expect(dados.length).toBeGreaterThanOrEqual(8);
    for (const dado of dados) {
      const nome = dado.split('\n')[0];
      for (const campo of ['**Para quê:**', '**Base legal:**', '**Por quanto tempo:**', '**Com quem:**']) {
        expect(dado, `${nome}: ${campo}`).toContain(campo);
      }
    }
  });

  it.each([
    'E-mail',
    'Senha',
    'Nome de exibição',
    'Atividade de estudo',
    'Fórum',
    'Endereço IP',
    'nginx',
    'Redis',
    'execução de contrato',
    'legítimo interesse',
    'só o texto da questão',
    'Google Fonts',
    'YouTube',
    'youtube-nocookie',
    'GitHub',
    'art. 18',
    'encarregado',
    '## Adolescentes',
    'Lei 15.211/2025',
  ])('menciona %s', (trecho) => {
    expect(politica).toContain(trecho);
  });

  it('deixa marcados os campos que só quem opera a instalação sabe', () => {
    expect(politica).toContain('Controlador: [PLACEHOLDER');
    expect(politica).toContain('Contato do encarregado: [PLACEHOLDER: e-mail de contato]');
  });
});
