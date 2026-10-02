import { fetchGithubStars, StarsCache, type FetchStars } from './github-stars';

describe('fetchGithubStars', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  function mockFetch(impl: () => Promise<Partial<Response>>) {
    const fn = jest.fn(impl);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  const resposta = (ok: boolean, body: unknown): Promise<Partial<Response>> =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) });

  it('lê stargazers_count da API do repositório', async () => {
    const fn = mockFetch(() => resposta(true, { stargazers_count: 42 }));
    await expect(fetchGithubStars('dono/repo')).resolves.toBe(42);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/dono/repo');
    expect(init.signal).toBeDefined();
  });

  it('chama a API pública sem autenticação e sem nada do aluno', async () => {
    const fn = mockFetch(() => resposta(true, { stargazers_count: 1 }));
    await fetchGithubStars('dono/repo');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    // Exatamente estes cabeçalhos: nada de token, cookie ou dado de quem pediu.
    expect(init.headers).toEqual({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OpENEM',
    });
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBeUndefined();
  });

  it('resposta de erro do GitHub vira null', async () => {
    // Mesmo que o corpo traga um número, status de erro não vale.
    mockFetch(() => resposta(false, { stargazers_count: 5 }));
    await expect(fetchGithubStars('dono/repo')).resolves.toBeNull();
  });

  it('falha de rede vira null', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    await expect(fetchGithubStars('dono/repo')).resolves.toBeNull();
  });

  it.each([[-1], [1.5], ['42'], [undefined]])(
    'valor inválido (%p) vira null',
    async (value) => {
      mockFetch(() => resposta(true, { stargazers_count: value }));
      await expect(fetchGithubStars('dono/repo')).resolves.toBeNull();
    },
  );

  it('zero estrelas é um valor válido', async () => {
    mockFetch(() => resposta(true, { stargazers_count: 0 }));
    await expect(fetchGithubStars('dono/repo')).resolves.toBe(0);
  });
});

describe('StarsCache', () => {
  const HORA = 60 * 60 * 1000;
  const CINCO_MIN = 5 * 60 * 1000;

  function setup(results: (number | null | Error)[]) {
    let t = 0;
    const queue = [...results];
    const fetchStars = jest.fn<ReturnType<FetchStars>, [string]>(() => {
      const r = queue.shift();
      return r instanceof Error
        ? Promise.reject(r)
        : Promise.resolve(r ?? null);
    });
    const cache = new StarsCache(fetchStars, () => t);
    return {
      cache,
      fetchStars,
      avanca: (ms: number) => {
        t += ms;
      },
    };
  }

  /** Deixa a renovação em segundo plano terminar. */
  const flush = () => new Promise((r) => setImmediate(r));

  it('a primeira busca espera o GitHub', async () => {
    const { cache } = setup([7]);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 7 });
  });

  it('dentro de uma hora não chama o GitHub de novo', async () => {
    const { cache, fetchStars, avanca } = setup([7, 8]);
    await cache.get(['a/b']);
    avanca(HORA - 1);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 7 });
    expect(fetchStars).toHaveBeenCalledTimes(1);
  });

  it('depois de uma hora responde o valor velho e renova por trás', async () => {
    const { cache, fetchStars, avanca } = setup([7, 8]);
    await cache.get(['a/b']);
    avanca(HORA);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 7 });
    await flush();
    expect(fetchStars).toHaveBeenCalledTimes(2);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 8 });
  });

  it('falha mantém o último valor e tenta de novo em cinco minutos', async () => {
    const { cache, fetchStars, avanca } = setup([7, null, 9]);
    await cache.get(['a/b']);
    avanca(HORA);
    await cache.get(['a/b']);
    await flush();
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 7 });
    avanca(CINCO_MIN - 1);
    await cache.get(['a/b']);
    expect(fetchStars).toHaveBeenCalledTimes(2);
    avanca(1);
    await cache.get(['a/b']);
    await flush();
    expect(fetchStars).toHaveBeenCalledTimes(3);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 9 });
  });

  it('sem nenhum valor ainda, falha devolve null', async () => {
    const { cache } = setup([null]);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': null });
  });

  it('erro lançado pela busca conta como falha, sem derrubar a resposta', async () => {
    const { cache } = setup([new Error('boom')]);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': null });
  });

  it('erro lançado também agenda a nova tentativa para cinco minutos', async () => {
    const { cache, fetchStars, avanca } = setup([new Error('boom'), 4]);
    await cache.get(['a/b']);
    avanca(CINCO_MIN);
    await cache.get(['a/b']);
    await flush();
    expect(fetchStars).toHaveBeenCalledTimes(2);
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 4 });
  });

  it('depois de uma primeira busca sem sucesso, as próximas não esperam o GitHub', async () => {
    const { cache, avanca } = setup([null, 9]);
    await cache.get(['a/b']);
    avanca(CINCO_MIN);
    // Responde na hora com o que tem (nada) e renova por trás.
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': null });
    await flush();
    await expect(cache.get(['a/b'])).resolves.toEqual({ 'a/b': 9 });
  });

  it('pedidos simultâneos dividem a mesma busca', async () => {
    const { cache, fetchStars } = setup([7]);
    const [x, y] = await Promise.all([cache.get(['a/b']), cache.get(['a/b'])]);
    expect(x).toEqual({ 'a/b': 7 });
    expect(y).toEqual({ 'a/b': 7 });
    expect(fetchStars).toHaveBeenCalledTimes(1);
  });

  it('cada repositório tem a sua contagem', async () => {
    const { cache } = setup([3, 5]);
    await expect(cache.get(['a/b', 'c/d'])).resolves.toEqual({
      'a/b': 3,
      'c/d': 5,
    });
  });
});
