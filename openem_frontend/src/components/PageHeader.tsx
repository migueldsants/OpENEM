import type { ReactNode } from 'react';

/**
 * Cabeçalho de página: um só tamanho de título e o mesmo ritmo em todas as
 * telas. `actions` fica à direita no desktop e desce para baixo do texto no
 * celular; `children` entra abaixo (filtros, abas) sem perder o alinhamento.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-prose text-sm text-muted text-pretty">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
