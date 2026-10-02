/**
 * Estrelas dos repositórios da tela Ferramentas, buscadas pelo servidor.
 *
 * Pelo servidor, e não pelo navegador do aluno, pelo mesmo motivo das imagens
 * do ENEM: o CSP do app só libera a própria origem, e o GitHub não precisa
 * saber o IP de cada aluno. O cache faz o número de chamadas ao GitHub não
 * depender do número de alunos (a API sem token aceita 60 por hora por IP).
 */

/** Contagem de estrelas, ou null quando o GitHub não respondeu. */
export type FetchStars = (repo: string) => Promise<number | null>;

export const fetchGithubStars: FetchStars = async (repo) => {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OpENEM',
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { stargazers_count?: unknown };
    const n = json.stargazers_count;
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    // Sem rede, timeout ou limite de chamadas: a tela segue sem o número.
    return null;
  }
};

interface Entry {
  /** undefined = nunca buscado; null = buscado sem sucesso. */
  value: number | null | undefined;
  /** Quando buscar de novo (ms desde a época). */
  next: number;
  inflight?: Promise<void>;
}

/**
 * Cache com renovação em segundo plano: depois da primeira busca, quem pede
 * recebe o último valor na hora, e a renovação acontece por trás. Falha não
 * apaga o valor conhecido; só agenda nova tentativa mais cedo.
 */
export class StarsCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly fetchStars: FetchStars,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly retryMs = 5 * 60 * 1000,
  ) {}

  async get(repos: string[]): Promise<Record<string, number | null>> {
    const pending: Promise<void>[] = [];
    for (const repo of repos) {
      const entry = this.entry(repo);
      if (this.now() >= entry.next) {
        const refresh = this.refresh(repo, entry);
        // Só a primeira busca segura a resposta; as outras correm por trás.
        if (entry.value === undefined) pending.push(refresh);
      }
    }
    await Promise.all(pending);
    return Object.fromEntries(
      repos.map((r) => [r, this.entries.get(r)?.value ?? null]),
    );
  }

  private entry(repo: string): Entry {
    let e = this.entries.get(repo);
    if (!e) {
      e = { value: undefined, next: 0 };
      this.entries.set(repo, e);
    }
    return e;
  }

  private refresh(repo: string, entry: Entry): Promise<void> {
    // Pedidos simultâneos dividem a mesma busca.
    entry.inflight ??= this.fetchStars(repo)
      .catch(() => null)
      .then((stars) => {
        if (stars === null) {
          if (entry.value === undefined) entry.value = null;
          entry.next = this.now() + this.retryMs;
        } else {
          entry.value = stars;
          entry.next = this.now() + this.ttlMs;
        }
      })
      .finally(() => {
        entry.inflight = undefined;
      });
    return entry.inflight;
  }
}
