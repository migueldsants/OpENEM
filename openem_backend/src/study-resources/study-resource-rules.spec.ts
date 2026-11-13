import {
  baseProblems,
  commercialWord,
  daysSince,
  isExpired,
  isForbiddenHost,
  MAX_CHECK_AGE_DAYS,
  parseBlocked,
  urlProblems,
  validateCatalog,
  visibleResources,
  type StudyProvider,
  type StudyResource,
} from './study-resource-rules';

const BASES = ['https://www.gov.br/inep/'];
const HOJE = new Date('2026-11-13T15:00:00Z');

const provedor: StudyProvider = {
  id: 'inep',
  name: 'Inep',
  kind: 'publico',
  about: 'Autarquia do Ministério da Educação que elabora e aplica o ENEM.',
  bases: BASES,
};

function recurso(extra: Partial<StudyResource> = {}): StudyResource {
  return {
    id: 'provas',
    title: 'Provas e gabaritos',
    url: 'https://www.gov.br/inep/pt-br/provas',
    provider: 'inep',
    types: ['documento'],
    subjects: ['Matemática'],
    topics: ['Probabilidade'],
    description: 'Cadernos de prova e gabaritos oficiais das edições do ENEM.',
    language: 'pt',
    checkedAt: '2026-11-13',
    ...extra,
  };
}

const TAXONOMIA = new Map<string, string[]>([
  ['Matemática', ['Probabilidade', 'Estatística']],
  ['Física', ['Ondas']],
]);

describe('urlProblems', () => {
  it('aceita um link https dentro do site da instituição', () => {
    expect(urlProblems('https://www.gov.br/inep/pt-br/provas', BASES)).toEqual(
      [],
    );
  });

  it('recusa http, outro órgão do mesmo domínio e host parecido', () => {
    expect(urlProblems('http://www.gov.br/inep/x', BASES)).toContain(
      'URL sem https',
    );
    expect(urlProblems('https://www.gov.br/saude/x', BASES)).toContain(
      'URL fora do site da instituição',
    );
    expect(urlProblems('https://www.gov.br.evil.com/inep/x', BASES)).toContain(
      'URL fora do site da instituição',
    );
  });

  it('recusa usuário/senha embutidos (https://www.gov.br@outro.com)', () => {
    const p = urlProblems('https://www.gov.br@evil.com/inep/', BASES);
    expect(p).toContain('URL com usuário ou senha');
    expect(p).toContain('URL fora do site da instituição');
  });

  it('recusa parâmetro de rastreio e de afiliado', () => {
    expect(
      urlProblems('https://www.gov.br/inep/x?utm_source=a', BASES).join(),
    ).toMatch(/rastreio.*utm_source/);
    expect(
      urlProblems('https://www.gov.br/inep/x?ref=abc', BASES).join(),
    ).toMatch(/ref/);
    expect(
      urlProblems('https://www.gov.br/inep/x?afiliado=1', BASES).join(),
    ).toMatch(/afiliado/);
    // Parâmetro de conteúdo (o ano do portal da OBMEP) pode.
    expect(urlProblems('https://www.gov.br/inep/x?a=3', BASES)).toEqual([]);
  });

  it('recusa plataforma aberta e encurtador mesmo se a base deixasse', () => {
    expect(
      urlProblems('https://www.youtube.com/watch?v=x', [
        'https://www.youtube.com/',
      ]),
    ).toContain('host proibido: www.youtube.com');
    expect(urlProblems('https://bit.ly/abc', ['https://bit.ly/'])).toContain(
      'host proibido: bit.ly',
    );
  });

  it('recusa URL fora da forma normalizada', () => {
    expect(urlProblems('https://WWW.gov.br/inep/x', BASES).join()).toMatch(
      /normalizada/,
    );
  });

  it('URL inválida', () => {
    expect(urlProblems('não é url', BASES)).toEqual(['URL inválida']);
  });
});

describe('baseProblems', () => {
  it('aceita https://host/caminho/', () => {
    expect(baseProblems('https://www.gov.br/inep/')).toEqual([]);
  });

  it('exige https, barra no fim e nada de plataforma aberta', () => {
    expect(baseProblems('http://www.gov.br/inep/').join()).toMatch(/sem https/);
    expect(baseProblems('https://www.gov.br/inep').join()).toMatch(
      /terminar em/,
    );
    expect(baseProblems('https://docs.google.com/').join()).toMatch(
      /plataforma aberta/,
    );
    expect(baseProblems('https://www.gov.br/inep/?x=1').join()).toMatch(
      /parâmetro/,
    );
    expect(baseProblems('lixo')).toEqual(['base inválida: lixo']);
  });
});

describe('isForbiddenHost', () => {
  it('pega o domínio e os subdomínios', () => {
    expect(isForbiddenHost('youtube.com')).toBe(true);
    expect(isForbiddenHost('m.youtube.com')).toBe(true);
    expect(isForbiddenHost('fulano.blogspot.com')).toBe(true);
    expect(isForbiddenHost('notyoutube.com')).toBe(false);
    expect(isForbiddenHost('pt.khanacademy.org')).toBe(false);
  });
});

describe('commercialWord', () => {
  it('acha palavra de venda', () => {
    expect(commercialWord('Assine o plano premium')).toBe('Assine');
    expect(commercialWord('7 dias de teste grátis')).toBe('teste grátis');
    expect(commercialWord('Por apenas R$ 9,90')).toBe('R$');
    expect(commercialWord('use o cupom ENEM')).toBe('cupom');
  });

  it('não confunde palavras inocentes', () => {
    expect(commercialWord('Para compreender a matéria')).toBeNull();
    expect(commercialWord('Cursos gratuitos de matemática')).toBeNull();
  });
});

describe('validade da conferência', () => {
  it('conta os dias pelo calendário UTC', () => {
    expect(daysSince('2026-11-13', HOJE)).toBe(0);
    expect(daysSince('2026-11-12', HOJE)).toBe(1);
    expect(daysSince('2026-11-14', HOJE)).toBe(-1);
  });

  it(`vence depois de ${MAX_CHECK_AGE_DAYS} dias`, () => {
    expect(isExpired('2025-11-13', HOJE)).toBe(false); // 365 dias
    expect(isExpired('2025-11-12', HOJE)).toBe(true); // 366 dias
  });
});

describe('parseBlocked', () => {
  it('aceita vírgula, espaço e quebra de linha, sem caixa', () => {
    expect([...parseBlocked(' Khan-X, obmep-y\nfoo ;bar')]).toEqual([
      'khan-x',
      'obmep-y',
      'foo',
      'bar',
    ]);
    expect(parseBlocked(undefined).size).toBe(0);
    expect(parseBlocked('').size).toBe(0);
  });
});

describe('visibleResources', () => {
  it('tira os bloqueados e os de conferência vencida', () => {
    const a = recurso({ id: 'a' });
    const b = recurso({ id: 'b' });
    const velho = recurso({ id: 'velho', checkedAt: '2024-01-01' });
    expect(
      visibleResources([a, b, velho], HOJE, new Set(['b'])).map((r) => r.id),
    ).toEqual(['a']);
  });
});

describe('validateCatalog', () => {
  it('um catálogo correto não tem problema', () => {
    expect(validateCatalog([provedor], [recurso()], TAXONOMIA, HOJE)).toEqual(
      [],
    );
  });

  it('acusa instituição de tipo não aceito (empresa)', () => {
    const empresa = {
      ...provedor,
      kind: 'empresa',
    } as unknown as StudyProvider;
    expect(
      validateCatalog([empresa], [recurso()], TAXONOMIA, HOJE).join(),
    ).toMatch(/tipo empresa não aceito/);
  });

  it('acusa link fora do site da instituição', () => {
    const r = recurso({ url: 'https://outro.org/provas' });
    expect(validateCatalog([provedor], [r], TAXONOMIA, HOJE).join()).toMatch(
      /fora do site da instituição/,
    );
  });

  it('acusa instituição inexistente e instituição sem recurso', () => {
    const problemas = validateCatalog(
      [provedor],
      [recurso({ provider: 'x' })],
      TAXONOMIA,
      HOJE,
    );
    expect(problemas.join()).toMatch(/instituição x não existe/);
    expect(problemas.join()).toMatch(/instituição inep: nenhum recurso/);
  });

  it('acusa id e URL repetidos', () => {
    const problemas = validateCatalog(
      [provedor],
      [recurso(), recurso()],
      TAXONOMIA,
      HOJE,
    ).join();
    expect(problemas).toMatch(/id repetido/);
    expect(problemas).toMatch(/URL repetida/);
  });

  it('acusa matéria e assunto fora da taxonomia', () => {
    const problemas = validateCatalog(
      [provedor],
      [
        recurso({
          id: 'a',
          url: 'https://www.gov.br/inep/a',
          subjects: ['Astrologia'],
          topics: [],
        }),
        recurso({
          id: 'b',
          url: 'https://www.gov.br/inep/b',
          topics: ['Ondas'],
        }),
        recurso({
          id: 'c',
          url: 'https://www.gov.br/inep/c',
          subjects: [],
          topics: ['Ondas'],
        }),
      ],
      TAXONOMIA,
      HOJE,
    ).join();
    expect(problemas).toMatch(/matéria Astrologia não existe/);
    expect(problemas).toMatch(/assunto Ondas não é das matérias citadas/);
    expect(problemas).toMatch(/assunto sem matéria/);
  });

  it('acusa palavra de venda, descrição curta e data no futuro', () => {
    const problemas = validateCatalog(
      [provedor],
      [
        recurso({
          description:
            'Curso premium com 7 dias de teste grátis para assinantes.',
          checkedAt: '2026-12-01',
        }),
        recurso({
          id: 'b',
          url: 'https://www.gov.br/inep/b',
          description: 'Curto.',
        }),
      ],
      TAXONOMIA,
      HOJE,
    ).join();
    expect(problemas).toMatch(/palavra de venda/);
    expect(problemas).toMatch(/descrição com 6 caracteres/);
    expect(problemas).toMatch(/no futuro/);
  });

  it('acusa tipo, idioma e data inválidos', () => {
    const r = recurso({
      types: ['podcast' as never],
      language: 'fr' as never,
      checkedAt: '13/11/2026',
    });
    const problemas = validateCatalog([provedor], [r], TAXONOMIA, HOJE).join();
    expect(problemas).toMatch(/tipo podcast não existe/);
    expect(problemas).toMatch(/idioma fr/);
    expect(problemas).toMatch(/data de conferência inválida/);
  });
});
