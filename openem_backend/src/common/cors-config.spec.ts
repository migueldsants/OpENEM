import { corsOptions } from './cors-config';

describe('corsOptions', () => {
  it('produção sem CORS_ORIGINS não liga o CORS (mesma origem pelo nginx)', () => {
    expect(corsOptions(undefined, 'production')).toBeNull();
    expect(corsOptions('  ', 'production')).toBeNull();
  });

  it('fora de produção sem a variável libera qualquer origem, como antes', () => {
    expect(corsOptions(undefined, 'development')).toEqual({});
    expect(corsOptions(undefined, undefined)).toEqual({});
  });

  it('com a lista, só as origens dela', () => {
    expect(
      corsOptions(' https://a.exemplo , https://b.exemplo,', 'production'),
    ).toEqual({
      origin: ['https://a.exemplo', 'https://b.exemplo'],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
  });

  it('recusa curinga', () => {
    expect(() => corsOptions('*', 'production')).toThrow(/CORS_ORIGINS/);
  });
});
