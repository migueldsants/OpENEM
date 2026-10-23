import {
  accountId,
  bearerToken,
  LOGIN_BLOCK_MAX_MS,
  loginBlockMs,
  loginKeys,
  normalizeEmail,
  rateKeyPrefix,
  rateLimitMessage,
  retryAfterSeconds,
  trackerFor,
} from './rate-limit';

describe('bearerToken', () => {
  it.each([
    ['Bearer abc.def', 'abc.def'],
    ['bearer abc', 'abc'],
    ['Bearer   abc  ', 'abc'],
    [['Bearer x', 'Bearer y'], 'x'],
  ])('%p → %p', (header, esperado) => {
    expect(bearerToken(header)).toBe(esperado);
  });

  it.each([[undefined], [''], ['Basic abc'], ['Bearer'], ['Bearer a b']])(
    '%p não tem token',
    (header) => {
      expect(bearerToken(header)).toBeNull();
    },
  );
});

describe('trackerFor', () => {
  it('com aluno, conta por aluno mesmo tendo IP', () => {
    expect(trackerFor({ userId: 'u1', ip: '10.0.0.1' })).toBe('user:u1');
  });

  it('sem aluno, conta por IP', () => {
    expect(trackerFor({ userId: null, ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('sem IP conhecido, um balde só', () => {
    expect(trackerFor({})).toBe('ip:desconhecido');
  });

  it('aluno e IP nunca colidem', () => {
    expect(trackerFor({ userId: '10.0.0.1' })).not.toBe(
      trackerFor({ ip: '10.0.0.1' }),
    );
  });
});

describe('rateKeyPrefix', () => {
  const id = () => 'abc';

  it('em produção, o mesmo prefixo para todas as instâncias', () => {
    expect(rateKeyPrefix({ NODE_ENV: 'production' }, id)).toBe('openem:v1:rl');
    expect(rateKeyPrefix({}, id)).toBe('openem:v1:rl');
  });

  it('nos testes, contadores próprios por app', () => {
    expect(rateKeyPrefix({ NODE_ENV: 'test' }, id)).toBe(
      'openem:v1:rl:test-abc',
    );
  });

  it('THROTTLE_KEY_PREFIX vale sempre, também nos testes', () => {
    expect(
      rateKeyPrefix({ THROTTLE_KEY_PREFIX: ' escola ', NODE_ENV: 'test' }, id),
    ).toBe('openem:v1:rl:escola');
  });
});

describe('retryAfterSeconds', () => {
  it.each([
    [0, 1],
    [1, 1],
    [999, 1],
    [1000, 1],
    [1001, 2],
    [60_000, 60],
  ])('%p ms → %p s', (ms, s) => {
    expect(retryAfterSeconds(ms)).toBe(s);
  });
});

describe('rateLimitMessage', () => {
  it('em segundos até dois minutos', () => {
    expect(rateLimitMessage(30)).toBe(
      'Muitas tentativas. Tente de novo em 30 s.',
    );
    expect(rateLimitMessage(119)).toContain('119 s');
  });

  it('em minutos a partir daí, arredondando para cima', () => {
    expect(rateLimitMessage(120)).toBe(
      'Muitas tentativas. Tente de novo em 2 min.',
    );
    expect(rateLimitMessage(900)).toContain('15 min');
    expect(rateLimitMessage(901)).toContain('16 min');
  });
});

describe('loginBlockMs', () => {
  const MIN = 60 * 1000;

  it('dobra a cada bloqueio', () => {
    expect(loginBlockMs(1)).toBe(15 * MIN);
    expect(loginBlockMs(2)).toBe(30 * MIN);
    expect(loginBlockMs(3)).toBe(60 * MIN);
  });

  it('para em 24 h', () => {
    expect(loginBlockMs(7)).toBe(16 * 60 * MIN);
    expect(loginBlockMs(8)).toBe(LOGIN_BLOCK_MAX_MS);
    expect(loginBlockMs(1000)).toBe(LOGIN_BLOCK_MAX_MS);
  });

  it('valor fora do esperado conta como primeiro bloqueio', () => {
    expect(loginBlockMs(0)).toBe(15 * MIN);
    expect(loginBlockMs(-3)).toBe(15 * MIN);
  });
});

describe('conta do login', () => {
  it('normaliza o e-mail', () => {
    expect(normalizeEmail('  Aluno@Exemplo.COM ')).toBe('aluno@exemplo.com');
  });

  it('o mesmo e-mail escrito de outro jeito é a mesma conta', () => {
    expect(accountId('Aluno@Exemplo.com')).toBe(
      accountId('aluno@exemplo.com '),
    );
    expect(accountId('a@exemplo.com')).not.toBe(accountId('b@exemplo.com'));
  });

  it('as chaves não guardam o e-mail', () => {
    const k = loginKeys('openem:v1:rl', 'aluno@exemplo.com');
    for (const chave of Object.values(k)) {
      expect(chave).not.toContain('aluno');
      expect(chave.startsWith('openem:v1:rl:login:')).toBe(true);
    }
    expect(new Set(Object.values(k)).size).toBe(3);
  });
});
