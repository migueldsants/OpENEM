import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import {
  IconBolt,
  IconBoard,
  IconBook,
  IconCalendar,
  IconChat,
  IconClock,
  IconFlame,
  IconFormula,
  IconChart,
  IconClipboard,
  IconHome,
  IconHourglass,
  IconLogout,
  IconMore,
  IconToolbox,
  IconPath,
  IconPlay,
  IconRepeat,
  IconStack,
  IconStar,
  IconTimer,
  IconTrophy,
  IconUser,
  IconPalette,
  IconPen,
  IconQuestion,
  IconTabelaPeriodica,
} from './components/icons';
import { AchievementToastHost } from './components/AchievementToast';
import { ConvitePatrocinio } from './components/ConvitePatrocinio';
import { MoreSheet, porSecao, type NavItem } from './components/MoreSheet';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PomodoroFloating } from './components/PomodoroFloating';
import { TimerAlarme } from './components/TimerAlarme';
import RouteTransition from './components/RouteTransition';
import ThemeToggle from './components/ThemeToggle';
import { useGamification } from './gamification';
import { useIsImmersive } from './immersive';
import { PomodoroProvider } from './pomodoro';
import { CONTENT_MAX_W, contentWidth } from './lib/content-width';
import { leagueStyle } from './lib/gamification';
import { DOCS_URL } from './lib/site';
import Comunidade from './pages/Comunidade';
import Temas from './pages/Temas';
import Conquistas from './pages/Conquistas';
import Cronograma from './pages/Cronograma';
import Desempenho from './pages/Desempenho';
import Ferramentas from './pages/Ferramentas';
import Favoritos from './pages/Favoritos';
import Flashcards from './pages/Flashcards';
import Formulas from './pages/Formulas';
import Home from './pages/Home';
import Materia from './pages/Materia';
import Materias from './pages/Materias';
import Painel from './pages/Painel';
import Login from './pages/Login';
import EntrarGoogle from './pages/EntrarGoogle';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import Onboarding from './pages/Onboarding';
import EscolherApelido from './pages/EscolherApelido';
import Perfil from './pages/Perfil';
import Pomodoro from './pages/Pomodoro';
import Redacoes from './pages/Redacoes';
import Cronometros from './pages/Cronometros';
import PerfilPublico from './pages/PerfilPublico';
import Progresso from './pages/Progresso';
import Questoes from './pages/Questoes';
import Quadro from './pages/Quadro';
import Revisao from './pages/Revisao';
import Simulados from './pages/Simulados';
import TabelaPeriodica from './pages/TabelaPeriodica';
import Videos from './pages/Videos';

// Editor do Quadro é lazy: mantém mathlive+katex num chunk separado (issue #32).
const QuadroEditorPage = lazy(() => import('./pages/QuadroEditorPage'));

// Menu agrupado pelo que o aluno quer fazer. A sidebar mostra tudo, com o
// título de cada seção; no mobile, `mobile: 'primary'` são os 5 atalhos da
// tabbar (cabem em 360px) e o resto vai para o "Mais" (issue #21), nos
// mesmos grupos. Revisão e Desempenho ficavam fora de qualquer menu.
const NAV: NavItem[] = [
  { to: '/', label: 'Início', Icon: IconHome, end: true, mobile: 'primary' },
  { to: '/painel', label: 'Painel', Icon: IconClipboard, mobile: 'primary' },

  { to: '/questoes', label: 'Questões', Icon: IconStack, mobile: 'primary', section: 'Estudar' },
  { to: '/materias', label: 'Matérias', Icon: IconPath, mobile: 'more', section: 'Estudar' },
  { to: '/simulados', label: 'Simulados', Icon: IconTimer, mobile: 'primary', section: 'Estudar' },
  { to: '/revisao', label: 'Revisão', Icon: IconRepeat, mobile: 'primary', section: 'Estudar' },
  { to: '/redacoes', label: 'Redações', Icon: IconPen, mobile: 'more', section: 'Estudar' },
  { to: '/flashcards', label: 'Flashcards', Icon: IconBook, mobile: 'more', section: 'Estudar' },
  { to: '/ferramentas', label: 'Ferramentas', Icon: IconToolbox, mobile: 'more', section: 'Estudar' },
  { to: '/favoritos', label: 'Favoritos', Icon: IconStar, mobile: 'more', section: 'Estudar' },

  { to: '/cronograma', label: 'Cronograma', Icon: IconCalendar, mobile: 'more', section: 'Planejar' },
  { to: '/pomodoro', label: 'Pomodoro', Icon: IconClock, mobile: 'more', section: 'Planejar' },
  { to: '/cronometros', label: 'Cronômetros', Icon: IconHourglass, mobile: 'more', section: 'Planejar' },
  { to: '/formulas', label: 'Fórmulas', Icon: IconFormula, mobile: 'more', section: 'Planejar' },
  { to: '/tabela-periodica', label: 'Tabela periódica', Icon: IconTabelaPeriodica, mobile: 'more', section: 'Planejar' },
  { to: '/videos', label: 'Vídeos', Icon: IconPlay, mobile: 'more', section: 'Planejar' },
  { to: '/quadro', label: 'Quadro', Icon: IconBoard, mobile: 'more', section: 'Planejar' },

  { to: '/desempenho', label: 'Desempenho', Icon: IconChart, mobile: 'more', section: 'Acompanhar' },
  // Conquistas mora dentro do Progresso ("Ver todas"): duas entradas para o
  // mesmo assunto só dividiam a atenção.
  { to: '/progresso', label: 'Progresso', Icon: IconTrophy, mobile: 'more', section: 'Acompanhar' },

  { to: '/comunidade', label: 'Comunidade', Icon: IconChat, mobile: 'more', section: 'Social' },

  { to: '/perfil', label: 'Perfil', Icon: IconUser, mobile: 'more', section: 'Conta' },
  { to: '/temas', label: 'Temas', Icon: IconPalette, mobile: 'more', section: 'Conta' },
  // Documentação (openem_site, em /docs/): fora do app, link comum.
  { to: 'ajuda', href: DOCS_URL, label: 'Ajuda', Icon: IconQuestion, mobile: 'more', section: 'Conta' },
];

const MOBILE_PRIMARY = NAV.filter((n) => n.mobile === 'primary');
const MOBILE_MORE = NAV.filter((n) => n.mobile === 'more');

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
      className="sidebar-progress lift card mb-3 block p-3 hover:shadow-[var(--shadow)]"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl shadow-sm ${league.gradient}`}
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
        <span className="flex items-center gap-1 text-warning">
          <IconFlame width={13} height={13} filled />
          {g.currentStreak}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ email, onLogout }: { email?: string; onLogout: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  // Em janela baixa a lista de telas rola, mas o Windows usa barra de rolagem
  // sobreposta (só aparece no hover): sem um esmaecimento no pé, o menu parece
  // simplesmente acabar no item cortado.
  const [navHasMore, setNavHasMore] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () =>
      setNavHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => el.removeEventListener('scroll', check);
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);

  return (
    <aside className="sidebar hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-hidden md:border-r md:border-line md:bg-sidebar md:px-4 md:py-5">
      <Wordmark className="shrink-0 px-2" />
      {/* A lista rola sozinha e o ritmo vertical encolhe em janela baixa (ver
          index.css): as telas e os títulos de seção pedem ~850px, um notebook 1366x768 tem 768 e
          com a escala de 125% do Windows sobram 614. Sem isso, Perfil, o
          cartão de XP e o botão Sair ficavam fora da tela. */}
      <nav
        ref={navRef}
        data-more={navHasMore ? '' : undefined}
        className="sidebar-nav mt-7 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {porSecao(NAV).map(([secao, grupo]) => (
          <div key={secao ?? '_'} className="flex flex-col gap-1">
            {secao && (
              <p className="sidebar-section eyebrow px-3 pb-0.5 pt-4">{secao}</p>
            )}
            {grupo.map(({ to, label, Icon, end, href }) =>
              href ? (
                <a
                  key={to}
                  href={href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <span className="h-5 w-0.5 rounded-full bg-transparent" />
                  <Icon width={20} height={20} weight="duotone" />
                  {label}
                </a>
              ) : (
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
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0 pt-3">
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
            className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-danger"
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
  // Simulado correndo etc.: some com a navegação sem remontar a página.
  const immersive = useIsImmersive();
  // Bottom-sheet "Mais" da tabbar mobile (issue #21).
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  // Botão "Mais" fica destacado quando a rota atual é uma tela secundária.
  const moreActive =
    location.pathname === '/conquistas' ||
    MOBILE_MORE.some((n) => n.to === location.pathname);
  const maxWidth = CONTENT_MAX_W[contentWidth(location.pathname)];
  // Usuários recém-cadastrados (onboarded=false) passam pelo onboarding antes do app.
  const needsOnboarding = authenticated && me && me.profile !== null && !me.profile.onboarded;
  // Sem apelido (conta antiga ou nova pelo Google), o aluno escolhe um antes de tudo.
  const needsNickname = authenticated && me && !me.profile?.nickname;

  if (!authenticated) {
    return (
      <Routes>
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/entrar/google" element={<EntrarGoogle />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (needsNickname) {
    // Sem rota própria: a tela vale para qualquer endereço e, salvo o
    // apelido, o aluno segue para onde ia.
    return <EscolherApelido />;
  }

  if (needsOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  const content = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/questoes" element={<Questoes />} />
      <Route path="/materias" element={<Materias />} />
      <Route path="/materias/:subjectId" element={<Materia />} />
      <Route path="/simulados" element={<Simulados />} />
      <Route path="/desempenho" element={<Desempenho />} />
      <Route path="/revisao" element={<Revisao />} />
      <Route path="/progresso" element={<Progresso />} />
      <Route path="/conquistas" element={<Conquistas />} />
      <Route path="/cronograma" element={<Cronograma />} />
      <Route path="/pomodoro" element={<Pomodoro />} />
      <Route path="/cronometros" element={<Cronometros />} />
      <Route path="/ferramentas" element={<Ferramentas />} />
      <Route path="/redacoes" element={<Redacoes />} />
      <Route path="/comunidade" element={<Comunidade />} />
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/temas" element={<Temas />} />
      <Route path="/usuarios/:id" element={<PerfilPublico />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/flashcards" element={<Flashcards />} />
      <Route path="/formulas" element={<Formulas />} />
      <Route path="/tabela-periodica" element={<TabelaPeriodica />} />
      <Route path="/videos" element={<Videos />} />
      <Route
        path="/quadro"
        element={
          <Suspense
            fallback={
              <div className="grid min-h-[60vh] place-items-center text-sm text-muted">
                Carregando…
              </div>
            }
          >
            <Quadro />
          </Suspense>
        }
      />
      <Route
        path="/quadro/:id"
        element={
          <Suspense
            fallback={
              <div className="grid min-h-[60vh] place-items-center text-sm text-muted">
                Carregando editor…
              </div>
            }
          >
            <QuadroEditorPage />
          </Suspense>
        }
      />
      {/* O link do e-mail aberto num aparelho já logado. */}
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  // Modo sem distrações: sem sidebar, top bar ou tabs — só o conteúdo.
  // O pop-up do Pomodoro fica: cronometrar o foco é o ponto do modo.
  if (focusMode) {
    return (
      <PomodoroProvider>
        <div className="min-h-dvh bg-bg text-fg">
          <div className="mx-auto max-w-2xl px-5 py-8">
            <div className="mb-5 flex items-center justify-between text-xs text-muted">
              <span>Modo sem distrações ativo</span>
              <NavLink to="/perfil" className="font-medium text-brand">
                Desativar no perfil
              </NavLink>
            </div>
            <RouteTransition>{content}</RouteTransition>
          </div>
          <PomodoroFloating />
          <TimerAlarme />
          <AchievementToastHost />
        </div>
      </PomodoroProvider>
    );
  }

  return (
    <PomodoroProvider>
    <div className="min-h-dvh bg-bg text-fg md:flex">
      <OfflineIndicator />
      {!immersive && <Sidebar email={me?.email} onLogout={logout} />}

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Barra superior — só no mobile. */}
        {!immersive && (
        <header className="topbar sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur md:hidden">
          <Wordmark />
          <div className="ml-auto flex items-center gap-2">
            <TopbarProgress />
            <ThemeToggle />
            <button
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <IconLogout width={18} height={18} />
            </button>
          </div>
        </header>
        )}

        <main className="flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-12 md:pt-10">
          <div className={`mx-auto ${maxWidth}`}>
            <RouteTransition>{content}</RouteTransition>
          </div>
        </main>
      </div>

      {/* Navegação inferior — padrão mobile (Android). 5 atalhos + botão "Mais"
          que abre um bottom-sheet com as telas secundárias (issue #21). */}
      {!immersive && (
      <nav className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur md:hidden">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${MOBILE_PRIMARY.length + 1}, minmax(0, 1fr))`,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {MOBILE_PRIMARY.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
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

          {/* Botão "Mais": abre o bottom-sheet com Progresso, Comunidade,
              Cronograma, Ferramentas e Favoritos (todas a 2 taps). */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Mais telas"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              moreActive ? 'text-brand' : 'text-muted'
            }`}
          >
            <IconMore
              width={22}
              height={22}
              weight={moreActive ? 'fill' : 'duotone'}
            />
            Mais
          </button>
        </div>
      </nav>
      )}

      {moreOpen && (
        <MoreSheet items={MOBILE_MORE} onClose={() => setMoreOpen(false)} />
      )}

      {/* Pop-up do cronômetro — segue o usuário por todas as telas. */}
      <PomodoroFloating />
      {/* Aviso de fim dos timers de /cronometros, em qualquer tela. */}
      <TimerAlarme />
      {/* Conquistas desbloqueadas: acima de tudo, fora da tela que as disparou. */}
      <AchievementToastHost />
      {/* Convite ao GitHub Sponsors: uma vez por login, depois do onboarding e
          fora do modo sem distrações; com simulado correndo, espera. */}
      <ConvitePatrocinio pausado={immersive} />
    </div>
    </PomodoroProvider>
  );
}
