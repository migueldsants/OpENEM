import {
  classifyResponse,
  followRedirect,
  isChallenge,
  isGatePath,
} from './link-check';

const BASES = ['https://pt.khanacademy.org/'];

describe('classifyResponse', () => {
  it('200 sem desafio é ok', () => {
    expect(classifyResponse(200, '<title>Matemática</title>').outcome).toBe(
      'ok',
    );
  });

  it('404, 410, 401 e 402 são falha', () => {
    expect(classifyResponse(404, '').outcome).toBe('falha');
    expect(classifyResponse(410, '').outcome).toBe('falha');
    expect(classifyResponse(401, '').reason).toMatch(/login/);
    expect(classifyResponse(402, '').reason).toMatch(/pagamento/);
  });

  it('desafio anti-robô é inconclusivo, com 200, 403 ou 503', () => {
    for (const status of [200, 403, 503]) {
      expect(
        classifyResponse(status, '<title>Just a moment...</title>').outcome,
      ).toBe('inconclusivo');
    }
    expect(classifyResponse(403, 'Acesso negado').outcome).toBe('inconclusivo');
    expect(classifyResponse(429, '').outcome).toBe('inconclusivo');
  });

  it('erro de servidor é falha', () => {
    expect(classifyResponse(500, '').outcome).toBe('falha');
    expect(classifyResponse(503, 'Service Unavailable').outcome).toBe('falha');
  });
});

describe('isChallenge', () => {
  it('reconhece Cloudflare e o desafio da Khan Academy', () => {
    expect(isChallenge('<title>Client Challenge</title>')).toBe(true);
    expect(isChallenge('Attention Required! | Cloudflare')).toBe(true);
    expect(isChallenge('<title>Química</title>')).toBe(false);
  });
});

describe('isGatePath', () => {
  it('reconhece login, cadastro e pagamento no caminho', () => {
    expect(isGatePath('https://x.org/login')).toBe(true);
    expect(isGatePath('https://x.org/entrar?next=/')).toBe(true);
    expect(isGatePath('https://x.org/checkout/123')).toBe(true);
    expect(isGatePath('https://x.org/pricing')).toBe(true);
    expect(isGatePath('https://x.org/math/login-teorema')).toBe(false);
    expect(isGatePath('https://x.org/math')).toBe(false);
  });
});

describe('followRedirect', () => {
  it('segue redirecionamento relativo dentro da instituição', () => {
    expect(
      followRedirect('https://pt.khanacademy.org/math', '/math/', BASES),
    ).toEqual({
      next: 'https://pt.khanacademy.org/math/',
    });
  });

  it('recusa sair da instituição, cair em http ou em login', () => {
    const fora = followRedirect(
      'https://pt.khanacademy.org/a',
      'https://outro.com/',
      BASES,
    );
    expect('reason' in fora && fora.reason).toMatch(/fora da instituição/);
    const http = followRedirect(
      'https://pt.khanacademy.org/a',
      'http://pt.khanacademy.org/a',
      BASES,
    );
    expect('reason' in http && http.reason).toMatch(/https/);
    const login = followRedirect(
      'https://pt.khanacademy.org/a',
      '/login',
      BASES,
    );
    expect('reason' in login && login.reason).toMatch(/login/);
    const vazio = followRedirect('https://pt.khanacademy.org/a', null, BASES);
    expect('outcome' in vazio && vazio.outcome).toBe('falha');
  });
});
