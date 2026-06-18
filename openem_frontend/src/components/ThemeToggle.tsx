import { useTheme } from '../theme';
import { IconMoon, IconSun } from './icons';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
      className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 transition-colors"
    >
      {dark ? (
        <IconSun width={18} height={18} />
      ) : (
        <IconMoon width={18} height={18} />
      )}
    </button>
  );
}
