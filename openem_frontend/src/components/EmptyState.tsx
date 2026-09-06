import type { ComponentType, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { IconSparkle } from './icons';

type IconProps = { width?: number; height?: number; className?: string };
type IconCmp = ComponentType<IconProps>;

interface EmptyStateAction {
  /** Quando informado, renderiza um NavLink. */
  to?: string;
  /** Alternativa ao `to`: ação customizada (ex.: abrir modal, gerar plano). */
  onClick?: () => void;
  label: string;
}

export interface EmptyStateProps {
  /** Ícone Phosphor (shim) duotone — serve como ilustração leve. */
  icon: IconCmp;
  /** Título curto em destaque. */
  title: string;
  /** Descrição contextual; aceita NavLink/ícones embutidos. */
  description: ReactNode;
  /** CTA primário (link ou botão). */
  action?: EmptyStateAction;
  /** Dica contextual (linha secundária com sparkle). */
  tip?: string;
  /** Override raro (ex.: "mt-4" quando dentro de outro card). */
  className?: string;
  /** Variante compacta para seções internas. */
  dense?: boolean;
  /** Sem o wrapper .card — para uso dentro de outro card/seção. */
  bare?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tip,
  className = '',
  dense = false,
  bare = false,
}: EmptyStateProps) {
  const wrapper = bare
    ? `text-center ${className}`
    : `card ${dense ? 'p-5' : 'p-6'} text-center ${className}`;
  return (
    <div className={wrapper}>
      <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-brand/12 text-brand animate-pop">
        <Icon width={56} height={56} />
      </span>
      <p className="mt-4 font-display text-base font-bold">{title}</p>
      <div className="mt-1 text-sm text-muted">{description}</div>
      {/* CTA e dica num flex explícito: os dois são inline-flex e acabavam
          fluindo na mesma linha, separados só por um espaço de texto. */}
      {(action || tip) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          {action &&
            (action.to ? (
              <NavLink to={action.to} className="btn btn-primary">
                {action.label}
              </NavLink>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="btn btn-primary"
              >
                {action.label}
              </button>
            ))}
          {tip && (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted">
              <IconSparkle
                width={14}
                height={14}
                className="shrink-0 text-brand"
                aria-hidden
              />
              {tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}