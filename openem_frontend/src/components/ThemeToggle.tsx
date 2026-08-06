import { useTheme } from '../theme';
import { IconMoon, IconSun } from './icons';

/** Toggle de tema: alterna claro/escuro. */
export default function ThemeToggle() {
  const { variant, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        variant === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
      }
      title={variant === 'dark' ? 'Tema claro' : 'Tema escuro'}
      className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 transition-colors"
    >
      {variant === 'dark' ? (
        <IconSun width={18} height={18} />
      ) : (
        <IconMoon width={18} height={18} />
      )}
    </button>
  );
}