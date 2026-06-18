import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import {
  IconCalendar,
  IconHome,
  IconLogout,
  IconPen,
  IconStack,
  IconUser,
} from './components/icons';
import ThemeToggle from './components/ThemeToggle';
import Cronograma from './pages/Cronograma';
import Home from './pages/Home';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Questoes from './pages/Questoes';
import Redacao from './pages/Redacao';

const NAV = [
  { to: '/', label: 'Início', Icon: IconHome, end: true },
  { to: '/questoes', label: 'Questões', Icon: IconStack },
  { to: '/cronograma', label: 'Cronograma', Icon: IconCalendar },
  { to: '/redacao', label: 'Redação', Icon: IconPen },
  { to: '/perfil', label: 'Perfil', Icon: IconUser },
];

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <NavLink
      to="/"
      className={`font-display text-xl font-extrabold tracking-tight ${className}`}
    >
      Op
      <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
        ENEM
      </span>
    </NavLink>
  );
}

function Sidebar({
  email,
  onLogout,
}: {
  email?: string;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r md:border-line md:px-4 md:py-5">
      <Wordmark className="px-2" />
      <nav className="mt-7 flex flex-col gap-1">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-surface-2 text-fg'
                  : 'text-muted hover:bg-surface-2 hover:text-fg'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`h-5 w-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-brand' : 'bg-transparent'
                  }`}
                />
                <Icon width={20} height={20} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
        <div className="grid size-9 place-items-center rounded-full bg-brand/12 font-display text-sm font-bold text-brand">
          {(email ?? '?').charAt(0).toUpperCase()}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {email}
        </span>
        <ThemeToggle />
        <button
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
          className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-red"
        >
          <IconLogout width={18} height={18} />
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const { authenticated, logout, me } = useAuth();
  const focusMode = me?.profile?.focusMode ?? false;

  if (!authenticated) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const content = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/questoes" element={<Questoes />} />
      <Route path="/cronograma" element={<Cronograma />} />
      <Route path="/redacao" element={<Redacao />} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/favoritos" element={<Navigate to="/questoes" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  // Modo sem distrações: sem sidebar, top bar ou tabs — só o conteúdo.
  if (focusMode) {
    return (
      <div className="min-h-screen bg-bg text-fg">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-5 flex items-center justify-between text-xs text-muted">
            <span>Modo sem distrações ativo</span>
            <NavLink to="/perfil" className="font-medium text-brand">
              Desativar no perfil
            </NavLink>
          </div>
          <div className="animate-rise">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg md:flex">
      <Sidebar email={me?.email} onLogout={logout} />

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Barra superior — só no mobile. */}
        <header className="topbar sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur md:hidden">
          <Wordmark />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-red"
            >
              <IconLogout width={18} height={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-12 md:pt-10">
          {/* Sidebar fica à esquerda; o conteúdo da página é centralizado. */}
          <div className="mx-auto max-w-3xl animate-rise">{content}</div>
        </main>
      </div>

      {/* Navegação inferior — padrão mobile (Android). */}
      <nav className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur md:hidden">
        <div
          className="grid grid-cols-5"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors ${
                  isActive ? 'text-brand' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    width={22}
                    height={22}
                    strokeWidth={isActive ? 2.1 : 1.8}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
