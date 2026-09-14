import {
  alternativeText,
  extractImages,
  stripInlineMarks,
  toPdfBlocks,
} from './markdown-blocks';

describe('stripInlineMarks', () => {
  it('tira negrito e itálico', () => {
    expect(stripInlineMarks('um **texto** com *ênfase*')).toBe(
      'um texto com ênfase',
    );
  });

  it('mantém o texto do link e descarta a URL', () => {
    expect(stripInlineMarks('veja [o mapa](http://x/y)')).toBe('veja o mapa');
  });

  it('preserva LaTeX — é a fórmula que o aluno vê na tela', () => {
    expect(stripInlineMarks('a área é $\\pi r^2$ nesse caso')).toBe(
      'a área é $\\pi r^2$ nesse caso',
    );
  });

  it('não come asterisco de multiplicação solto', () => {
    expect(stripInlineMarks('2 * 3 = 6')).toBe('2 * 3 = 6');
  });
});

describe('extractImages', () => {
  it('devolve as imagens na ordem, com alt', () => {
    expect(
      extractImages('![fig 1](/media/a.png) texto ![](/media/b.png)'),
    ).toEqual([
      { alt: 'fig 1', url: '/media/a.png' },
      { alt: '', url: '/media/b.png' },
    ]);
  });

  it('sem imagem devolve lista vazia', () => {
    expect(extractImages('só texto')).toEqual([]);
  });
});

describe('toPdfBlocks', () => {
  it('nada entra, nada sai', () => {
    expect(toPdfBlocks(null)).toEqual([]);
    expect(toPdfBlocks('')).toEqual([]);
  });

  it('junta a quebra rígida do dataset em parágrafo corrido', () => {
    const blocos = toPdfBlocks(
      'Nasci numa família de camponeses sem terra, em Azinhaga, uma pequena\n' +
        'povoação situada na província do Ribatejo, na margem direita do rio.',
    );
    expect(blocos).toHaveLength(1);
    expect(blocos[0]).toEqual({
      kind: 'paragraph',
      text:
        'Nasci numa família de camponeses sem terra, em Azinhaga, uma pequena ' +
        'povoação situada na província do Ribatejo, na margem direita do rio.',
    });
  });

  it('linha em branco separa parágrafos', () => {
    expect(toPdfBlocks('Primeiro.\n\nSegundo.')).toEqual([
      { kind: 'paragraph', text: 'Primeiro.' },
      { kind: 'paragraph', text: 'Segundo.' },
    ]);
  });

  it('verso mantém as próprias quebras', () => {
    const blocos = toPdfBlocks('Minha terra tem palmeiras\nOnde canta o sabiá');
    expect(blocos[0]).toEqual({
      kind: 'lines',
      lines: ['Minha terra tem palmeiras', 'Onde canta o sabiá'],
    });
  });

  it('imagem sozinha é um bloco, na ordem em que aparece', () => {
    const blocos = toPdfBlocks('Antes\n\n![g](/media/g.png)\n\nDepois');
    expect(blocos.map((b) => b.kind)).toEqual([
      'paragraph',
      'image',
      'paragraph',
    ]);
    expect(blocos[1]).toEqual({ kind: 'image', url: '/media/g.png', alt: 'g' });
  });

  it('imagem no meio da linha sai do texto e vira bloco', () => {
    const blocos = toPdfBlocks('O gráfico ![](/media/g.png) mostra a curva.');
    expect(blocos[0]).toEqual({
      kind: 'paragraph',
      text: 'O gráfico  mostra a curva.'.replace('  ', ' '),
    });
    expect(blocos[1]).toEqual({ kind: 'image', url: '/media/g.png', alt: '' });
  });

  it('tabela vira células, sem a linha separadora', () => {
    const blocos = toPdfBlocks('| Ano | PIB |\n|---|---|\n| 2020 | 1,2 |');
    expect(blocos).toEqual([
      {
        kind: 'table',
        rows: [
          ['Ano', 'PIB'],
          ['2020', '1,2'],
        ],
      },
    ]);
  });

  it('título vira parágrafo com estilo de título', () => {
    expect(toPdfBlocks('## Autobiografia')).toEqual([
      { kind: 'paragraph', text: 'Autobiografia', style: 'heading' },
    ]);
  });

  it('citação é marcada para ser impressa em itálico', () => {
    const blocos = toPdfBlocks('> a vida é assim mesmo e sempre será assim');
    expect(blocos[0]).toEqual({
      kind: 'paragraph',
      text: 'a vida é assim mesmo e sempre será assim',
      style: 'quote',
    });
  });

  it('crédito em linha própria vira bloco de fonte', () => {
    const blocos = toPdfBlocks(
      'O texto fala do assunto e desenvolve o argumento por extenso aqui.\n' +
        'Disponível em: www.exemplo.org. Acesso em: 7 dez. 2017 (adaptado).',
    );
    expect(blocos[1]).toEqual({
      kind: 'source',
      text: 'Disponível em: www.exemplo.org. Acesso em: 7 dez. 2017 (adaptado).',
    });
  });

  it('crédito colado no fim do parágrafo é separado dele', () => {
    const blocos = toPdfBlocks(
      'Um texto de apoio comprido o bastante para o crédito cair no trecho ' +
        'final dele, como acontece na prova. Disponível em: www.exemplo.org.',
    );
    expect(blocos).toHaveLength(2);
    expect(blocos[0].kind).toBe('paragraph');
    expect(blocos[1]).toEqual({
      kind: 'source',
      text: 'Disponível em: www.exemplo.org.',
    });
  });

  it('"disponível em" no meio da frase não é crédito', () => {
    const blocos = toPdfBlocks(
      'O gráfico disponível em: cada estação mostra a variação da maré ao ' +
        'longo do ano inteiro, com picos em janeiro e em julho de cada ano.',
    );
    expect(blocos).toHaveLength(1);
    expect(blocos[0].kind).toBe('paragraph');
  });

  it('o crédito sai da estrofe em vez de virar verso', () => {
    const blocos = toPdfBlocks(
      'Minha terra tem palmeiras\nOnde canta o sabiá\nFonte: Canção do exílio',
    );
    expect(blocos).toEqual([
      {
        kind: 'lines',
        lines: ['Minha terra tem palmeiras', 'Onde canta o sabiá'],
      },
      { kind: 'source', text: 'Fonte: Canção do exílio' },
    ]);
  });

  it('item de lista não cola no parágrafo anterior', () => {
    const blocos = toPdfBlocks('Considere:\n- primeiro item\n- segundo item');
    expect(blocos).toEqual([
      { kind: 'paragraph', text: 'Considere:' },
      { kind: 'paragraph', text: '• primeiro item' },
      { kind: 'paragraph', text: '• segundo item' },
    ]);
  });
});

describe('alternativeText', () => {
  it('vira uma linha só, sem marcação', () => {
    expect(alternativeText('o **valor**\nde 1,20')).toBe('o valor de 1,20');
  });

  it('alternativa de imagem não tem texto', () => {
    expect(alternativeText(null)).toBe('');
    expect(alternativeText('')).toBe('');
  });
});
