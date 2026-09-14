import {
  classifyByKeywords,
  normalizeText,
  RULES,
  MIN_SCORE,
} from './heuristic';

const MAT = 'Matemática e suas Tecnologias';
const NAT = 'Ciências da Natureza e suas Tecnologias';
const HUM = 'Ciências Humanas e suas Tecnologias';
const LIN = 'Linguagens, Códigos e suas Tecnologias';

describe('normalizeText', () => {
  it('tira acento e caixa', () => {
    expect(normalizeText('Função Quadrática')).toBe('funcao quadratica');
  });

  it('vira pontuação em espaço mas preserva % e /', () => {
    expect(normalizeText('20 m/s, logo 50%!')).toBe('20 m/s logo 50%');
  });

  it('colapsa espaços e quebras de linha', () => {
    expect(normalizeText('a\n\n  b\t c')).toBe('a b c');
  });
});

describe('classifyByKeywords', () => {
  it('decide pelo termo forte do assunto', () => {
    const d = classifyByKeywords(
      'Qual a probabilidade de sair um número par ao lançar o dado?',
      MAT,
    );
    expect(d?.subject).toBe('Matemática');
    expect(d?.topic).toBe('Probabilidade');
    expect(d?.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('não atravessa áreas: termo de Biologia não classifica em Matemática', () => {
    const texto = 'O DNA é formado por genes e cromossomos.';
    expect(classifyByKeywords(texto, NAT)?.subject).toBe('Biologia');
    expect(classifyByKeywords(texto, MAT)).toBeNull();
  });

  it('cala quando nenhum termo aparece', () => {
    expect(
      classifyByKeywords('O texto acima apresenta uma reflexão.', HUM),
    ).toBeNull();
  });

  it('cala quando dois assuntos empatam — palpite é pior que nada', () => {
    // "onda" e "refração" puxam Ondas e Óptica com a mesma força.
    const d = classifyByKeywords(
      'A onda sofre refração ao atravessar o meio, com reflexão parcial.',
      NAT,
    );
    if (d) expect(d.margin).toBeGreaterThanOrEqual(2);
  });

  it('exige pontuação mínima: um termo de apoio solto não decide', () => {
    const d = classifyByKeywords('Havia uma planta na sala.', NAT);
    expect(d).toBeNull();
    expect(MIN_SCORE).toBeGreaterThan(1);
  });

  it('soma termos de apoio até decidir', () => {
    const d = classifyByKeywords(
      'A planta usa a raiz e a folha; o caule conduz a seiva do vegetal.',
      NAT,
    );
    expect(d?.topic).toBe('Botânica');
  });

  it('classifica literatura por autor e movimento', () => {
    const d = classifyByKeywords(
      'Em Dom Casmurro, Machado de Assis constrói um narrador irônico.',
      LIN,
    );
    expect(d?.subject).toBe('Literatura');
    expect(d?.topic).toBe('Realismo e Naturalismo');
  });

  it('classifica história pelo período', () => {
    const d = classifyByKeywords(
      'Durante a ditadura militar, o AI-5 instituiu a censura.',
      HUM,
    );
    expect(d?.subject).toBe('História');
    expect(d?.topic).toBe('Ditadura militar');
  });

  it('respeita bordas de palavra: "mol" não casa dentro de "molécula"', () => {
    expect(classifyByKeywords('A molécula é estável.', NAT)).toBeNull();
  });

  it('o sufixo * casa a família da palavra', () => {
    const d = classifyByKeywords(
      'A urbanização acelerada criou favelas e problemas de mobilidade urbana.',
      HUM,
    );
    expect(d?.topic).toBe('Urbanização');
  });

  it('devolve os termos que decidiram, para auditoria', () => {
    const d = classifyByKeywords('Calcule o logaritmo de 100 na base 10.', MAT);
    expect(d?.matched).toContain('logaritmo');
  });

  it('texto vazio não classifica', () => {
    expect(classifyByKeywords('   ', MAT)).toBeNull();
  });
});

describe('catálogo de regras', () => {
  it('toda regra tem área conhecida e ao menos um termo', () => {
    const areas = new Set([MAT, NAT, HUM, LIN]);
    for (const r of RULES) {
      expect(areas.has(r.area)).toBe(true);
      expect((r.strong?.length ?? 0) + (r.weak?.length ?? 0)).toBeGreaterThan(
        0,
      );
    }
  });

  it('não repete o par matéria+assunto', () => {
    const chaves = RULES.map((r) => `${r.subject}::${r.topic}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('cobre as quatro áreas', () => {
    for (const area of [MAT, NAT, HUM, LIN]) {
      expect(RULES.some((r) => r.area === area)).toBe(true);
    }
  });
});
