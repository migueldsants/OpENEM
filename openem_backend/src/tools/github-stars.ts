/**
 * Estrelas dos repositórios da tela Ferramentas, buscadas pelo servidor.
 *
 * Pelo servidor, e não pelo navegador do aluno, pelo mesmo motivo das imagens
 * do ENEM: o CSP do app só libera a própria origem, e o GitHub não precisa
 * saber o IP de cada aluno. O cache faz o número de chamadas ao GitHub não
 * depender do número de alunos (a API sem token aceita 60 por hora por IP).
 *
 * A chamada é anônima de propósito: nenhum token ou credencial do projeto
 * sai daqui, e o GitHub só vê o IP do servidor. Um teste trava os cabeçalhos.
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

/** O que fica guardado por repositório. */
export interface StoredStars {
  /** null = buscado sem sucesso. */
  value: number | null;
  /** Quando buscar de novo (ms desde a época). */
  next: number;
}

/**
 * Onde as contagens ficam. Na API é o `CacheService` (Redis, compartilhado
 * entre instâncias); sem nada, um Map do próprio processo.
 */
export interface StarsStore {
  get(repo: string): Promise<StoredStars | undefined>;
  set(repo: string, value: StoredStars): Promise<void>;
}

export function memoryStarsStore(): StarsStore {
  const map = new Map<string, StoredStars>();
  return {
    get: (repo) => Promise.resolve(map.get(repo)),
    set: (repo, value) => {
      map.set(repo, value);
      return Promise.resolve();
    },
  };
}

/**
 * Cache com renovação em segundo plano: depois da primeira busca, quem pede
 * recebe o último valor na hora, e a renovação acontece por trás. Falha não
 * apaga o valor conhecido; só agenda nova tentativa mais cedo.
 */
export class StarsCache {
  /** Buscas em andamento neste processo, por repositório. */
  private readonly inflight = new Map<string, Promise<StoredStars>>();

  constructor(
    private readonly fetchStars: FetchStars,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly retryMs = 5 * 60 * 1000,
    private readonly store: StarsStore = memoryStarsStore(),
  ) {}

  async get(repos: string[]): Promise<Record<string, number | null>> {
    const entries = await Promise.all(repos.map((r) => this.store.get(r)));
    const values = await Promise.all(
      repos.map(async (repo, i) => {
        const entry = entries[i];
        if (!entry || this.now() >= entry.next) {
          const refresh = this.refresh(repo, entry);
          // Só a primeira busca segura a resposta; as outras correm por trás.
          if (!entry) return (await refresh).value;
        }
        return entry.value;
      }),
    );
    return Object.fromEntries(repos.map((r, i) => [r, values[i]]));
  }

  private refresh(
    repo: string,
    previous: StoredStars | undefined,
  ): Promise<StoredStars> {
    // Pedidos simultâneos dividem a mesma busca.
    let tarefa = this.inflight.get(repo);
    if (!tarefa) {
      tarefa = this.fetchStars(repo)
        .catch(() => null)
        .then(async (stars) => {
          const next: StoredStars =
            stars === null
              ? {
                  value: previous?.value ?? null,
                  next: this.now() + this.retryMs,
                }
              : { value: stars, next: this.now() + this.ttlMs };
          await this.store.set(repo, next).catch(() => undefined);
          return next;
        })
        .finally(() => this.inflight.delete(repo));
      this.inflight.set(repo, tarefa);
    }
    return tarefa;
  }
}
