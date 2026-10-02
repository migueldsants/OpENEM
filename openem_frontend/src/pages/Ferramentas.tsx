import { useEffect, useState } from 'react';
import { api, type Tool } from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconGithub, IconStar, IconToolbox } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import { rotuloEstrelas } from '../lib/estrelas';

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
        subtitle="Projetos abertos que complementam o OpENEM. Todos no GitHub, para usar, estudar e contribuir."
      />

      <div className="flex items-start gap-3 rounded-2xl bg-brand/10 px-4 py-3 ring-1 ring-brand/20">
        <IconStar filled width={20} height={20} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-sm text-pretty">
          <span className="font-semibold">Gostou de algum?</span> Deixe uma estrela
          no GitHub: é de graça, leva dois cliques e ajuda o projeto a chegar a
          mais estudantes.
        </p>
      </div>

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
    <article className="card flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <IconToolbox width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold leading-snug">{t.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 font-data text-xs text-muted">
            <IconGithub width={14} height={14} className="shrink-0" />
            <span className="truncate">{t.repo}</span>
          </p>
        </div>
      </div>

      <p className="text-sm text-muted text-pretty">{t.description}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Rótulos">
        {t.tags.map((r) => (
          <li key={r} className="chip">
            {r}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        {t.stars !== null ? (
          <a
            href={`${t.url}/stargazers`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-brand"
            title="Ver quem deu estrela"
          >
            <IconStar filled width={16} height={16} className="text-brand" />
            {rotuloEstrelas(t.stars)}
          </a>
        ) : (
          <span />
        )}
        <a
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          aria-label={`Dar estrela a ${t.name} no GitHub (abre numa nova aba)`}
        >
          <IconStar width={18} height={18} />
          Dar estrela
        </a>
      </div>
    </article>
  );
}
