import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ABOUT_OPENEM,
  COVER_HIGHLIGHTS,
  COVER_ORIGIN,
  formatDuration,
  INSTRUCTIONS,
  PdfQuestion,
  resolveImagePath,
  shortArea,
  simuladoPdfBuffer,
} from './simulado-pdf';
import {
  contrastInk,
  darken,
  isHexColor,
  normalizeHex,
  PDF_THEMES,
  resolveTheme,
  themeWithBrand,
} from './themes';

function question(overrides: Partial<PdfQuestion> = {}): PdfQuestion {
  return {
    number: 1,
    code: 'ENEM-2023-136',
    areaName: 'Matemática e suas Tecnologias',
    subjectName: 'Matemática',
    topicName: 'Funções',
    statement: 'Um artista esculpe um cone reto de 36 cm de altura.',
    questionPrompt: 'Qual é a massa, em grama, dessa escultura?',
    explanation: 'O volume do cone é (1/3)·π·r²·h.',
    alternatives: [
      { letter: 'A', text: '1.198,8', imageUrl: null, isCorrect: false },
      { letter: 'B', text: '1.296,0', imageUrl: null, isCorrect: true },
      { letter: 'C', text: '1.360,8', imageUrl: null, isCorrect: false },
      { letter: 'D', text: '1.399,7', imageUrl: null, isCorrect: false },
      { letter: 'E', text: '1.490,4', imageUrl: null, isCorrect: false },
    ],
    ...overrides,
  };
}

describe('resolveImagePath', () => {
  const media = join(tmpdir(), `openem-pdf-spec-${process.pid}`);

  beforeAll(() => {
    mkdirSync(join(media, '2023', '136'), { recursive: true });
    writeFileSync(join(media, '2023', '136', 'fig.png'), 'x');
  });

  it('resolve o caminho servido em /media/enem', () => {
    expect(resolveImagePath('/media/enem/2023/136/fig.png', media)).toBe(
      join(media, '2023', '136', 'fig.png'),
    );
  });

  it('arquivo que não existe devolve null', () => {
    expect(resolveImagePath('/media/enem/2023/136/nao.png', media)).toBeNull();
  });

  it('recusa sair do diretório de mídia', () => {
    expect(
      resolveImagePath('/media/enem/../../../etc/passwd.png', media),
    ).toBeNull();
  });

  it('recusa URL externa — o PDF é gerado offline', () => {
    expect(resolveImagePath('https://enem.dev/x/fig.png', media)).toBeNull();
  });

  it('recusa formato que o PDFKit não embute', () => {
    expect(resolveImagePath('/media/enem/2023/136/fig.bmp', media)).toBeNull();
  });

  it('sem diretório configurado, nenhuma imagem é lida', () => {
    expect(resolveImagePath('/media/enem/2023/136/fig.png', null)).toBeNull();
  });
});

describe('texto da capa', () => {
  const textos = [
    ABOUT_OPENEM,
    COVER_ORIGIN,
    ...INSTRUCTIONS,
    ...COVER_HIGHLIGHTS.flat(),
  ];

  it('cobre as provas de 1998 a 2025', () => {
    expect(ABOUT_OPENEM).toContain('de 1998 a 2025');
    expect(COVER_HIGHLIGHTS.flat().join(' ')).toContain('de 1998 a 2025');
  });

  it('não promete o que o app não tem mais', () => {
    for (const texto of textos) {
      // A tela de correção de redação saiu do app; a contagem de questões e o
      // recorte "2009 a 2025" ficaram velhos com as provas de 1998 a 2008.
      expect(texto).not.toMatch(/reda[çc][ãa]o/i);
      expect(texto).not.toMatch(/2009 a 2025|mil questões/);
    }
  });

  it('não cita domínio que o projeto não tem', () => {
    for (const texto of textos) expect(texto).not.toMatch(/openem\.org/i);
  });

  it('não usa travessão', () => {
    for (const texto of textos) expect(texto).not.toContain('—');
  });
});

describe('formatDuration', () => {
  it('330 min viram 5h30', () => {
    expect(formatDuration(330)).toBe('5h30');
  });

  it('hora cheia sai sem os minutos', () => {
    expect(formatDuration(300)).toBe('5h');
  });

  it('menos de uma hora sai em minutos', () => {
    expect(formatDuration(45)).toBe('45 min');
  });
});

describe('shortArea', () => {
  it('encurta o nome da área para caber na etiqueta', () => {
    expect(shortArea('Linguagens, Códigos e suas Tecnologias')).toBe(
      'Linguagens',
    );
    expect(shortArea('Ciências da Natureza e suas Tecnologias')).toBe(
      'Natureza',
    );
    expect(shortArea('Matemática e suas Tecnologias')).toBe('Matemática');
  });
});

describe('temas', () => {
  it('chave desconhecida cai no tema padrão', () => {
    expect(resolveTheme('nao-existe').key).toBe('default');
    expect(resolveTheme(null).key).toBe('default');
  });

  it('todo tema tem as cores que o desenho usa', () => {
    for (const t of PDF_THEMES) {
      for (const cor of [t.brand, t.brand2, t.fg, t.muted, t.line, t.surface]) {
        expect(isHexColor(cor)).toBe(true);
      }
    }
  });

  it('cor personalizada vira a marca do caderno', () => {
    const t = themeWithBrand(resolveTheme('default'), '#2563eb');
    expect(t.brand).toBe('#2563eb');
    // A segunda cor do gradiente é derivada, sempre mais escura.
    expect(t.brand2).not.toBe(t.brand);
  });

  it('cor inválida não troca o tema', () => {
    const base = resolveTheme('azure');
    expect(themeWithBrand(base, 'azul')).toBe(base);
    expect(themeWithBrand(base, null)).toBe(base);
  });

  it('#abc vira #aabbcc', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
  });

  it('darken escurece sem sair da faixa', () => {
    expect(darken('#ffffff', 0.5)).toBe('#808080');
    expect(darken('#000000', 0.5)).toBe('#000000');
  });

  it('a tinta sobre a cor segue o contraste, não o gosto', () => {
    expect(contrastInk('#ffcc00')).toBe('#111827');
    expect(contrastInk('#1f2937')).toBe('#ffffff');
  });
});

describe('simuladoPdfBuffer', () => {
  it('gera um PDF válido com capa, cartão-resposta e gabarito', async () => {
    const buf = await simuladoPdfBuffer([question(), question({ number: 2 })], {
      title: 'Simulado de Matemática',
      subtitle: 'Funções · 2 questões',
      timeLimitMin: 30,
      now: new Date('2026-01-15T12:00:00Z'),
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('respeita o tema escolhido sem quebrar o desenho', async () => {
    for (const tema of PDF_THEMES) {
      const buf = await simuladoPdfBuffer([question()], {
        title: `Tema ${tema.label}`,
        theme: tema.key,
      });
      expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('sai em uma coluna quando o aluno pede', async () => {
    const buf = await simuladoPdfBuffer([question()], {
      title: 'Coluna única',
      twoColumns: false,
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('imprime sem capa, sem cartão e sem gabarito quando desligados', async () => {
    const completo = await simuladoPdfBuffer([question()], { title: 'Cheio' });
    const enxuto = await simuladoPdfBuffer([question()], {
      title: 'Cheio',
      cover: false,
      answerSheet: false,
      answerKey: false,
    });
    expect(enxuto.length).toBeLessThan(completo.length);
  });

  it('aguenta enunciado longo, verso, tabela e imagem ausente', async () => {
    const longa = question({
      statement:
        '# Título\n\n' +
        'Parágrafo longo. '.repeat(200) +
        '\n\n![](/media/enem/2023/136/some.png)\n\n' +
        '| Ano | PIB |\n|---|---|\n| 2020 | 1,2 |\n\n' +
        'Verso curto\nOutro verso\n\nDisponível em: exemplo.org. Acesso em: hoje.',
      alternatives: [
        {
          letter: 'A',
          text: 'Alternativa muito longa. '.repeat(40),
          imageUrl: null,
          isCorrect: true,
        },
        {
          letter: 'B',
          text: '',
          imageUrl: '/media/enem/2023/136/alt.png',
          isCorrect: false,
        },
      ],
    });
    const buf = await simuladoPdfBuffer([longa, question({ number: 2 })], {
      title: 'Caderno difícil',
      explanations: true,
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('sem questão nenhuma ainda produz um PDF (capa e avisos)', async () => {
    const buf = await simuladoPdfBuffer([], { title: 'Vazio' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
