import { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { IconX } from './icons';
import { Portal, useDialog } from './Modal';

// Item de navegação compartilhado entre a sidebar, a tabbar e o "Mais".
export type NavItem = {
  to: string;
  label: string;
  // Ícones Phosphor via shim — aceitam width/height/weight/filled/className.
  Icon: React.ComponentType<Record<string, unknown>>;
  end?: boolean;
  /** 'primary' = atalho visível na tabbar mobile; 'more' = dentro do "Mais". */
  mobile?: 'primary' | 'more';
  /** Grupo no menu (Estudar, Planejar…). Sem grupo = topo, sem título. */
  section?: string;
  /**
   * Endereço fora do app (ex.: a documentação em /docs/). Vira um link comum
   * em vez de rota do router, que só conhece o que está sob /app/.
   */
  href?: string;
};

/** Agrupa mantendo a ordem em que cada seção aparece pela primeira vez. */
// eslint-disable-next-line react-refresh/only-export-components
export function porSecao(items: NavItem[]): [string | undefined, NavItem[]][] {
  const grupos = new Map<string | undefined, NavItem[]>();
  for (const item of items) {
    const g = grupos.get(item.section) ?? [];
    g.push(item);
    grupos.set(item.section, g);
  }
  return [...grupos.entries()];
}

/**
 * Bottom-sheet com as telas secundárias do app, aberto pelo botão "Mais" da
 * tabbar mobile (issue #21), agrupadas como na sidebar. Cobre a tabbar
 * (z-30 > z-20), fecha no backdrop, no X, no Esc e ao navegar.
 */
export function MoreSheet({
  items,
  onClose,
}: {
  items: NavItem[];
  onClose: () => void;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  useDialog(painelRef, onClose);
  return (
    <Portal>
      <div
        className="fixed inset-0 z-30 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Mais telas"
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade"
          onClick={onClose}
          aria-hidden
        />
        <div
          ref={painelRef}
          tabIndex={-1}
          className="animate-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-bg shadow-[var(--shadow)] outline-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <header className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="font-display text-base font-bold">Mais</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <IconX width={18} height={18} />
            </button>
          </header>

          <div className="space-y-4 px-4 pb-6 pt-2">
            {porSecao(items).map(([secao, grupo]) => (
              <section key={secao ?? '_'}>
                {secao && <h3 className="eyebrow mb-2 px-1">{secao}</h3>}
                <div className="grid grid-cols-3 gap-2">
                  {grupo.map(({ to, label, Icon, end, href }) =>
                    href ? (
                      <a
                        key={to}
                        href={href}
                        onClick={onClose}
                        className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-2 py-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                      >
                        <span className="grid size-11 place-items-center rounded-xl bg-brand/12 text-brand">
                          <Icon width={24} height={24} weight="duotone" />
                        </span>
                        {label}
                      </a>
                    ) : (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                            isActive
                              ? 'border-brand bg-brand/8 text-brand'
                              : 'border-line bg-surface text-fg hover:bg-surface-2'
                          }`
                        }
                      >
                        <span className="grid size-11 place-items-center rounded-xl bg-brand/12 text-brand">
                          <Icon width={24} height={24} weight="duotone" />
                        </span>
                        {label}
                      </NavLink>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
