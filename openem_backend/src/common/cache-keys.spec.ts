import {
  cacheKey,
  deserialize,
  effectiveTtl,
  MEMORY_NAMESPACE_TTL_MS,
  namespaceVersionKey,
  parseVersion,
  serialize,
  shouldLog,
  ttlWithJitter,
} from './cache-keys';

describe('cacheKey', () => {
  it('sem namespace, só o prefixo e as partes', () => {
    expect(cacheKey(['stars', 'dono/repo'])).toBe(
      'openem:v1:stars:dono%2Frepo',
    );
  });

  it('com namespace, a versão entra na chave', () => {
    expect(
      cacheKey(['question', 'abc'], { name: 'catalog', version: '7' }),
    ).toBe('openem:v1:catalog:7:question:abc');
  });

  it('versões diferentes dão chaves diferentes', () => {
    const v1 = cacheKey(['exams'], { name: 'catalog', version: '1' });
    const v2 = cacheKey(['exams'], { name: 'catalog', version: '2' });
    expect(v1).not.toBe(v2);
  });

  it('um ":" vindo de fora não vira separador', () => {
    expect(cacheKey(['question', 'a:b'])).not.toBe(
      cacheKey(['question', 'a', 'b']),
    );
  });

  it('aceita número como parte', () => {
    expect(cacheKey(['top', 10])).toBe('openem:v1:top:10');
  });

  it('recusa chave vazia', () => {
    expect(() => cacheKey([])).toThrow();
  });

  it('a chave da versão fica fora das chaves versionadas', () => {
    expect(namespaceVersionKey('catalog')).toBe('openem:v1:ns:catalog');
  });
});

describe('parseVersion', () => {
  it.each([
    [null, '0'],
    [undefined, '0'],
    ['', '0'],
    ['abc', '0'],
    ['-1', '0'],
    ['12', '12'],
  ])('%p vira %p', (raw, esperado) => {
    expect(parseVersion(raw)).toBe(esperado);
  });
});

describe('ttlWithJitter', () => {
  it('sem sorteio, o TTL inteiro', () => {
    expect(ttlWithJitter(60_000, () => 0)).toBe(60_000);
  });

  it('corta no máximo 10%', () => {
    expect(ttlWithJitter(60_000, () => 0.999999)).toBe(54_001);
    expect(ttlWithJitter(60_000, () => 0.5)).toBe(57_000);
  });

  it('nunca fica abaixo de 1 ms', () => {
    expect(ttlWithJitter(1, () => 0.99)).toBe(1);
  });

  it.each([[0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'recusa TTL %p',
    (ttl) => {
      expect(() => ttlWithJitter(ttl)).toThrow();
    },
  );
});

describe('effectiveTtl', () => {
  it('no Redis, o TTL pedido', () => {
    expect(effectiveTtl(3_600_000, { memory: false, namespaced: true })).toBe(
      3_600_000,
    );
  });

  it('em memória, chave de namespace dura no máximo um minuto', () => {
    expect(effectiveTtl(3_600_000, { memory: true, namespaced: true })).toBe(
      MEMORY_NAMESPACE_TTL_MS,
    );
    expect(effectiveTtl(5_000, { memory: true, namespaced: true })).toBe(5_000);
  });

  it('em memória, chave sem namespace mantém o TTL', () => {
    expect(effectiveTtl(3_600_000, { memory: true, namespaced: false })).toBe(
      3_600_000,
    );
  });
});

describe('serialize / deserialize', () => {
  it('ida e volta', () => {
    const valor = { a: 1, lista: ['x'], nada: null };
    expect(deserialize(serialize(valor))).toEqual({ hit: true, value: valor });
  });

  it('null guardado é acerto, não ausência', () => {
    expect(deserialize(serialize(null))).toEqual({ hit: true, value: null });
  });

  it('Date vira texto ISO, como na resposta HTTP', () => {
    const d = new Date('2026-10-22T12:00:00.000Z');
    expect(deserialize(serialize({ d }))).toEqual({
      hit: true,
      value: { d: '2026-10-22T12:00:00.000Z' },
    });
  });

  it('undefined não vai para o cache', () => {
    expect(() => serialize(undefined)).toThrow();
  });

  it.each([[null], [undefined], ['não é json'], ['{"x":1}'], ['3'], ['null']])(
    'conteúdo %p conta como ausente',
    (raw) => {
      expect(deserialize(raw)).toEqual({ hit: false });
    },
  );
});

describe('shouldLog', () => {
  it('o primeiro aviso sai sempre', () => {
    expect(shouldLog(1000, null)).toBe(true);
  });

  it('dentro do intervalo, não repete', () => {
    expect(shouldLog(59_999, 0, 60_000)).toBe(false);
  });

  it('passado o intervalo, avisa de novo', () => {
    expect(shouldLog(60_000, 0, 60_000)).toBe(true);
  });
});
