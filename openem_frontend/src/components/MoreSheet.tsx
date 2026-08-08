import { NavLink } from 'react-router-dom';
import { IconX } from './icons';

// Item de navegação compartilhado entre a tabbar e o bottom-sheet "Mais".
export type NavItem = {
  to: string;
  label: string;
  // Ícones Phosphor via shim — aceitam width/height/weight/filled/className.
  Icon: React.ComponentType<Record<string, unknown>>;
  end?: boolean;
  /** 'primary' = atalho visível na tabbar mobile; 'more' = dentro do "Mais". */
  mobile?: 'primary' | 'more';
};

/**
 * Bottom-sheet com as telas secundárias do app, aberto pelo botão "Mais" da
 * tabbar mobile (issue #21). Cobre a tabbar (z-30 > z-20), fecha no backdrop,
 * no botão X e ao navegar (cada item é um NavLink que chama onClose).
 */
export function MoreSheet({
  items,
  onClose,
}: {
  items: NavItem[];
  onClose: () => void;
}) {
  return (
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
        className="animate-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-bg shadow-[var(--shadow)]"
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

        <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-2">
          {items.map(({ to, label, Icon, end }) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}