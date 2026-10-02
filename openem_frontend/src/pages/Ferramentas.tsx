import { IconArrow, IconGithub, IconToolbox } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { FERRAMENTAS, githubUrl, type Ferramenta } from '../lib/tools';

/**
 * Ferramentas: projetos abertos no GitHub que complementam o OpENEM. A lista
 * vive em `lib/tools.ts`; cada cartão abre o repositório numa aba nova.
 */
export default function Ferramentas() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Código aberto"
        title="Ferramentas"
        subtitle="Projetos abertos que complementam o OpENEM. Todos no GitHub, para usar, estudar e contribuir."
      />

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Repositórios">
        {FERRAMENTAS.map((f) => (
          <li key={f.repo}>
            <FerramentaCard ferramenta={f} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FerramentaCard({ ferramenta: f }: { ferramenta: Ferramenta }) {
  return (
    <a
      href={githubUrl(f.repo)}
      target="_blank"
      rel="noopener noreferrer"
      className="card group flex h-full flex-col gap-3 p-5 transition-colors hover:border-brand/40 hover:bg-surface-2"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <IconToolbox width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold leading-snug">{f.nome}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 font-data text-xs text-muted">
            <IconGithub width={14} height={14} className="shrink-0" />
            <span className="truncate">{f.repo}</span>
          </p>
        </div>
        <IconArrow
          width={18}
          height={18}
          className="shrink-0 text-muted transition-colors group-hover:text-brand"
          aria-hidden
        />
      </div>

      <p className="text-sm text-muted text-pretty">{f.descricao}</p>

      <ul className="mt-auto flex flex-wrap gap-2" aria-label="Rótulos">
        {f.rotulos.map((r) => (
          <li key={r} className="chip">
            {r}
          </li>
        ))}
      </ul>
      <span className="sr-only">(abre o GitHub numa nova aba)</span>
    </a>
  );
}
