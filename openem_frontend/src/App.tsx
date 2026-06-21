import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import {
  IconBolt,
  IconCalendar,
  IconFlame,
  IconHome,
  IconLogout,
  IconPen,
  IconStack,
  IconTrophy,
  IconUser,
} from './components/icons';
import RouteTransition from './components/RouteTransition';
import ThemeToggle from './components/ThemeToggle';
import { useGamification } from './gamification';
import { leagueStyle } from './lib/gamification';
import Cronograma from './pages/Cronograma';
import Favoritos from './pages/Favoritos';
import Home from './pages/Home';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Progresso from './pages/Progresso';
import Questoes from './pages/Questoes';
import Redacao from './pages/Redacao';
import Revisao from './pages/Revisao';

const NAV = [
  { to: '/', label: 'Início', Icon: IconHome, end: true },
  { to: '/questoes', label: 'Questões', Icon: IconStack },
  { to: '/progresso', label: 'Progresso', Icon: IconTrophy },
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
      Op<span className="text-gradient">ENEM</span>
    </NavLink>
  );
}

/** Cartão de progresso na sidebar — nível, barra de XP e streak. */
function SidebarProgress() {
  const { summary } = useGamification();
  const g = summary && summary.enabled ? summary : null;
  if (!g) return null;
  const league = leagueStyle(g.league.key);
  const pct = Math.round(g.progress.pct * 100);

  return (
    <NavLink
      to="/progresso"
      className="lift card mb-3 block p-3 hover:shadow-[var(--shadow)]"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${league.gradient}`}
        >
          <IconTrophy width={18} height={18} filled />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-data text-xs font-bold">
            Nível {g.level}
            <span className="ml-1 font-sans font-medium text-muted">
              · {g.league.name}
            </span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {g.currentStreak > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 font-data text-xs font-bold text-brand">
            <IconFlame width={15} height={15} filled />
            {g.currentStreak}
          </span>
        )}
      </div>
    </NavLink>
  );
}

/** Mini indicador de XP/streak para a barra superior (mobile). */
function TopbarProgress() {
  const { summary } = useGamification();
  const g = summary && summary.enabled ? summary : null;
  if (!g) return null;
  return (
    <NavLink
      to="/progresso"
      className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-data text-xs font-bold"
      aria-label={`Nível ${g.level}, sequência de ${g.currentStreak} dias`}
    >
      <span className="flex items-center gap-1 text-brand">
        <IconBolt width={13} height={13} filled />
        {g.level}
      </span>
      {g.currentStreak > 0 && (
        <span className="flex items-center gap-1 text-red">
          <IconFlame width={13} height={13} filled />
          {g.currentStreak}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ email, onLogout }: { email?: string; onLogout: () => void }) {
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
                <Icon
                  width={20}
                  height={20}
                  weight={isActive ? 'fill' : 'duotone'}
                  className={isActive ? 'text-brand' : ''}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <SidebarProgress />
        <div className="flex items-center gap-2 border-t border-line pt-4">
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
      <Route path="/revisao" element={<Revisao />} />
      <Route path="/progresso" element={<Progresso />} />
      <Route path="/cronograma" element={<Cronograma />} />
      <Route path="/redacao" element={<Redacao />} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/favoritos" element={<Favoritos />} />
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
          <RouteTransition>{content}</RouteTransition>
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
            <TopbarProgress />
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
          <div className="mx-auto max-w-3xl">
            <RouteTransition>{content}</RouteTransition>
          </div>
        </main>
      </div>

      {/* Navegação inferior — padrão mobile (Android). */}
      <nav className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur md:hidden">
        <div
          className="grid grid-cols-6"
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
                    weight={isActive ? 'fill' : 'duotone'}
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
