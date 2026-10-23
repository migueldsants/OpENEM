// Testes do núcleo puro da tela de Redações.
import { describe, it, expect } from 'vitest';
import {
  agruparPorAno,
  contarFiguras,
  figura,
  filtrarPropostas,
  FILTROS,
  semAcento,
  tituloDaProposta,
  type PropostaRedacao,
} from './redacoes';

function proposta(extra: Partial<PropostaRedacao>): PropostaRedacao {
  return {
    id: 'x',
    ano: 2020,
    aplicacao: 'regular',
    aplicacaoRotulo: 'Aplicação regular',
    tema: 'Tema',
    proposta: '',
    textos: [],
    paginas: [],
    fonteUrl: 'https://download.inep.gov.br/x.pdf',
    ...extra,
  };
}

const LISTA = [
  proposta({ id: 'a', ano: 2023, tema: 'Trabalho de cuidado realizado pela mulher' }),
  proposta({
    id: 'b',
    ano: 2023,
    aplicacao: 'ppl',
    aplicacaoRotulo: 'PPL / reaplicação',
    tema: 'População em situação de rua',
  }),
  proposta({ id: 'c', ano: 2019, tema: 'Democratização do acesso ao cinema' }),
  proposta({
    id: 'd',
    ano: 2020,
    aplicacao: 'digital',
    aplicacaoRotulo: 'ENEM Digital',
    tema: 'Desigualdades entre as regiões',
  }),
];
const ids = (l: PropostaRedacao[]) => l.map((p) => p.id);

describe('lib/redacoes — semAcento', () => {
  it('tira acentos e maiúsculas', () => {
    expect(semAcento('Redação À Mão')).toBe('redacao a mao');
    expect(semAcento('ÇÃO')).toBe('cao');
    expect(semAcento('')).toBe('');
  });
});

describe('lib/redacoes — filtrarPropostas', () => {
  it('sem filtro nem busca devolve tudo, na mesma ordem', () => {
    expect(ids(filtrarPropostas(LISTA, 'todas', ''))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(filtrarPropostas(LISTA, 'todas', '   '))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('separa a aplicação regular das demais', () => {
    expect(ids(filtrarPropostas(LISTA, 'regular', ''))).toEqual(['a', 'c']);
    expect(ids(filtrarPropostas(LISTA, 'outras', ''))).toEqual(['b', 'd']);
  });

  it('busca pelo tema sem exigir acento nem maiúscula', () => {
    expect(ids(filtrarPropostas(LISTA, 'todas', 'democratizacao'))).toEqual(['c']);
    expect(ids(filtrarPropostas(LISTA, 'todas', 'SITUAÇÃO de rua'))).toEqual(['b']);
  });

  it('busca pelo ano e pelo nome da aplicação', () => {
    expect(ids(filtrarPropostas(LISTA, 'todas', '2023'))).toEqual(['a', 'b']);
    expect(ids(filtrarPropostas(LISTA, 'todas', 'digital'))).toEqual(['d']);
    expect(ids(filtrarPropostas(LISTA, 'todas', '2023 ppl'))).toEqual(['b']);
  });

  it('exige todas as palavras digitadas', () => {
    expect(filtrarPropostas(LISTA, 'todas', 'cinema mulher')).toEqual([]);
    expect(ids(filtrarPropostas(LISTA, 'todas', 'cuidado mulher'))).toEqual(['a']);
  });

  it('combina filtro e busca', () => {
    expect(ids(filtrarPropostas(LISTA, 'regular', '2023'))).toEqual(['a']);
    expect(filtrarPropostas(LISTA, 'outras', 'cinema')).toEqual([]);
  });
});

describe('lib/redacoes — agruparPorAno', () => {
  it('ordena os anos do mais recente para o mais antigo', () => {
    const grupos = agruparPorAno(LISTA);
    expect(grupos.map((g) => g.ano)).toEqual([2023, 2020, 2019]);
    expect(ids(grupos[0].propostas)).toEqual(['a', 'b']);
    expect(ids(grupos[1].propostas)).toEqual(['d']);
    expect(ids(grupos[2].propostas)).toEqual(['c']);
  });

  it('lista vazia não tem grupos', () => {
    expect(agruparPorAno([])).toEqual([]);
  });
});

describe('lib/redacoes — contarFiguras', () => {
  it('conta as figuras de todos os textos', () => {
    const p = proposta({
      textos: [
        {
          rotulo: 'Texto I',
          blocos: [
            { t: 'p', texto: 'a' },
            { t: 'img', src: '/redacoes/a.webp', alt: 'x', w: 1, h: 1 },
          ],
        },
        {
          rotulo: 'Texto II',
          blocos: [
            { t: 'img', src: '/redacoes/b.webp', alt: 'y', w: 1, h: 1 },
            { t: 'img', src: '/redacoes/c.webp', alt: 'z', w: 1, h: 1 },
            { t: 'fonte', texto: 'f' },
          ],
        },
      ],
    });
    expect(contarFiguras(p)).toBe(3);
    expect(contarFiguras(proposta({}))).toBe(0);
  });
});

describe('lib/redacoes — tituloDaProposta', () => {
  it('usa o tema e, sem tema, o próprio comando', () => {
    expect(tituloDaProposta(proposta({ tema: 'Tema X', proposta: 'Redija…' }))).toBe('Tema X');
    expect(tituloDaProposta(proposta({ tema: '', proposta: 'Redija um texto' }))).toBe(
      'Redija um texto',
    );
  });

  it('a busca alcança o comando quando não há tema', () => {
    const semTema = proposta({ id: 's', tema: '', proposta: 'máquina de chuva da Amazônia' });
    expect(ids(filtrarPropostas([...LISTA, semTema], 'todas', 'amazonia'))).toEqual(['s']);
  });
});

describe('lib/redacoes — FILTROS', () => {
  it('oferece os três recortes, começando por "Todas"', () => {
    expect(FILTROS.map((f) => f.key)).toEqual(['todas', 'regular', 'outras']);
    expect(FILTROS.every((f) => f.label.length > 0)).toBe(true);
  });
});

describe('lib/redacoes — figura', () => {
  it('prefixa o caminho com a base do app', () => {
    expect(figura('/redacoes/2025-regular-1.webp', '/app/')).toBe(
      '/app/redacoes/2025-regular-1.webp',
    );
  });

  it('na raiz, o caminho fica igual', () => {
    expect(figura('/redacoes/a.webp', '/')).toBe('/redacoes/a.webp');
  });

  it('endereço completo não é mexido', () => {
    expect(figura('https://exemplo.com/a.webp', '/app/')).toBe(
      'https://exemplo.com/a.webp',
    );
  });
});
