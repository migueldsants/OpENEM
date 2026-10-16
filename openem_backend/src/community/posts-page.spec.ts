import {
  afterCursor,
  clampPageSize,
  decodePostCursor,
  encodePostCursor,
  POSTS_PAGE_DEFAULT,
  POSTS_PAGE_MAX,
  slicePage,
} from './posts-page';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

describe('cursor das respostas do fórum', () => {
  it('codifica e decodifica createdAt + id', () => {
    const post = {
      createdAt: new Date('2026-10-16T12:34:56.789Z'),
      id: 'cmabc123_x-y',
    };
    const cursor = encodePostCursor(post);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePostCursor(cursor)).toEqual(post);
  });

  it.each([
    ['vazio', ''],
    ['lixo', 'não é base64 nem cursor'],
    ['sem separador', b64('2026-10-16T12:34:56.789Z')],
    ['data inválida', b64('ontem|abc')],
    ['data fora do formato ISO', b64('2026-10-16|abc')],
    ['id vazio', b64('2026-10-16T12:34:56.789Z|')],
    ['id com caractere estranho', b64("2026-10-16T12:34:56.789Z|a' OR 1=1")],
    ['id longo demais', b64(`2026-10-16T12:34:56.789Z|${'a'.repeat(65)}`)],
  ])('recusa cursor malformado (%s)', (_nome, cursor) => {
    expect(decodePostCursor(cursor)).toBeNull();
  });

  it('filtra o que vem depois: data maior, ou mesma data e id maior', () => {
    const createdAt = new Date('2026-10-16T00:00:00.000Z');
    expect(afterCursor({ createdAt, id: 'b' })).toEqual({
      OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: 'b' } }],
    });
  });
});

describe('tamanho da página', () => {
  it.each([
    [undefined, POSTS_PAGE_DEFAULT],
    [Number.NaN, POSTS_PAGE_DEFAULT],
    [0, 1],
    [-5, 1],
    [7.9, 7],
    [POSTS_PAGE_MAX, POSTS_PAGE_MAX],
    [5000, POSTS_PAGE_MAX],
  ])('%p vira %p', (limit, esperado) => {
    expect(clampPageSize(limit)).toBe(esperado);
  });
});

describe('slicePage', () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    createdAt: new Date(Date.UTC(2026, 9, 16, 0, 0, i)),
  }));

  it('sem linha a mais, é a última página', () => {
    expect(slicePage(rows.slice(0, 3), 3)).toEqual({
      items: rows.slice(0, 3),
      nextCursor: null,
    });
  });

  it('com a linha a mais, corta e aponta o cursor para a última que fica', () => {
    const page = slicePage(rows, 3);
    expect(page.items).toEqual(rows.slice(0, 3));
    expect(decodePostCursor(page.nextCursor!)).toEqual(rows[2]);
  });
});
