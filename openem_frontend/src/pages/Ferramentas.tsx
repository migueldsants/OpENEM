import { useEffect, useState } from 'react';
import { api, type Tool } from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconGithub, IconStar } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import { numeroEstrelas, rotuloEstrelas } from '../lib/estrelas';

/**
 * Ferramentas: projetos abertos no GitHub que complementam o OpENEM. A lista
 * e a contagem de estrelas vêm do servidor (`GET /tools`), que consulta o
 * GitHub com cache; o botão leva ao repositório, onde fica a estrela.
 */
export default function Ferramentas() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError(null);
    api
      .tools()
      .then((t) => vivo && setTools(t))
      .catch(
        () =>
          vivo &&
          setError('Não foi possível carregar as ferramentas. Verifique sua conexão.'),
      );
    return () => {
      vivo = false;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Código aberto"
        title="Ferramentas"
        subtitle="Projetos abertos que complementam o OpENEM. Gostou? Uma estrela no GitHub ajuda o projeto a chegar a mais estudantes."
      />

      <ErrorBanner
        message={error}
        onRetry={() => setReloadKey((k) => k + 1)}
      />

      {tools === null ? (
        !error && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Repositórios">
          {tools.map((t) => (
            <li key={t.repo}>
              <FerramentaCard tool={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FerramentaCard({ tool: t }: { tool: Tool }) {
  return (
    <article className="card flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {/* No celular o ícone espremia o título e cortava o repositório. */}
        <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand sm:grid">
          <IconGithub width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold leading-snug">{t.name}</h2>
          <p className="mt-0.5 font-data text-xs text-muted sm:truncate">
            <RepoNome repo={t.repo} />
          </p>
        </div>
      </div>

      <p className="text-sm text-muted text-pretty">{t.description}</p>

      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-2" aria-label="Rótulos">
          {t.tags.map((r) => (
            <li key={r} className="chip">
              {r}
            </li>
          ))}
        </ul>
        <BotaoEstrela tool={t} />
      </div>
    </article>
  );
}

/**
 * `dono/repo` que, no celular, quebra depois da barra e não no meio do nome:
 * cada parte é um bloco em linha, que só quebra por dentro se não couber
 * numa linha inteira.
 */
function RepoNome({ repo }: { repo: string }) {
  const barra = repo.indexOf('/');
  if (barra < 0) return <>{repo}</>;
  return (
    <>
      <span className="inline-block">{repo.slice(0, barra + 1)}</span>
      <span className="inline-block max-w-full break-words">
        {repo.slice(barra + 1)}
      </span>
    </>
  );
}

/**
 * Botão no formato do GitHub: "Estrela" abre o repositório (onde fica a
 * estrela) e o número abre a lista de quem já deu. Sem número, só o botão.
 */
function BotaoEstrela({ tool: t }: { tool: Tool }) {
  const parte =
    'inline-flex items-center gap-1.5 px-3 py-2 transition-colors hover:bg-surface-2 sm:py-1.5';
  return (
    <div className="flex w-full shrink-0 overflow-hidden rounded-lg border border-line text-sm font-semibold sm:inline-flex sm:w-auto">
      <a
        href={t.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${parte} flex-1 justify-center hover:text-brand sm:flex-none`}
        aria-label={`Estrela: ${t.name} no GitHub (abre numa nova aba)`}
      >
        <IconStar width={16} height={16} className="text-brand" />
        Estrela
      </a>
      {t.stars !== null && (
        <a
          href={`${t.url}/stargazers`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${parte} border-l border-line tabular-nums`}
          aria-label={`${rotuloEstrelas(t.stars)}: ver quem deu estrela`}
          title={rotuloEstrelas(t.stars)}
        >
          {numeroEstrelas(t.stars)}
        </a>
      )}
    </div>
  );
}
