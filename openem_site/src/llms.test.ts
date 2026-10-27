import { describe, expect, it } from 'vitest';
import { llmsFullTxt, llmsTxt, RESUMO_LLMS } from './llms';

const secoes = [
  {
    titulo: 'Para estudantes',
    entradas: [
      { titulo: 'Questões', url: '/docs/alunos/questoes/', descricao: 'Como responder.' },
      { titulo: 'Sem descrição', url: '/docs/alunos/x/', descricao: '' },
    ],
  },
  { titulo: 'Vazia', entradas: [] },
];
const opcionais = [
  { titulo: 'Código-fonte', url: 'https://github.com/migueldsants/OpENEM', descricao: 'AGPL-3.0.' },
];

describe('llmsTxt', () => {
  it('segue o formato: H1, resumo em citação, seções H2 com listas de links', () => {
    const txt = llmsTxt(null, secoes, opcionais);
    const linhas = txt.split('\n');
    expect(linhas[0]).toBe('# OpENEM');
    expect(linhas[2]).toBe(`> ${RESUMO_LLMS}`);
    expect(txt).toContain('## Para estudantes\n\n- [Questões](/docs/alunos/questoes/): Como responder.');
    // Sem descrição, a linha termina no link.
    expect(txt).toContain('- [Sem descrição](/docs/alunos/x/)\n');
    // Seção vazia não aparece; os opcionais vão em "Optional", no fim.
    expect(txt).not.toContain('## Vazia');
    expect(txt.trimEnd().endsWith('- [Código-fonte](https://github.com/migueldsants/OpENEM): AGPL-3.0.')).toBe(true);
    expect(txt).toContain('## Optional');
    expect(txt.endsWith('\n')).toBe(true);
  });

  it('com SITE_URL, os links internos saem completos e os externos ficam como estão', () => {
    const txt = llmsTxt('https://openem.exemplo', secoes, opcionais);
    expect(txt).toContain('(https://openem.exemplo/docs/alunos/questoes/)');
    expect(txt).toContain('(https://github.com/migueldsants/OpENEM)');
    expect(txt).not.toContain('https://openem.exemplohttps');
  });
});

describe('llmsFullTxt', () => {
  it('traz cada página com título, fonte, descrição e o corpo', () => {
    const txt = llmsFullTxt('https://openem.exemplo', [
      {
        titulo: 'Simulados',
        url: '/docs/alunos/simulados/',
        descricao: 'Provas no tempo do ENEM.',
        corpo: '## Como começar\r\n\r\nEscolha a prova.\r\n',
      },
    ]);
    expect(txt.startsWith('# OpENEM: documentação completa')).toBe(true);
    expect(txt).toContain(
      '# Simulados\n\nFonte: https://openem.exemplo/docs/alunos/simulados/\n\n> Provas no tempo do ENEM.\n\n## Como começar\n\nEscolha a prova.\n',
    );
    expect(txt).not.toContain('\r');
  });
});
