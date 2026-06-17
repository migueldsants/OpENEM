import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Cronograma from './pages/Cronograma';
import Favoritos from './pages/Favoritos';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Redacao from './pages/Redacao';

const NAV = [
  { to: '/cronograma', label: 'Cronograma' },
  { to: '/favoritos', label: 'Favoritos' },
  { to: '/redacao', label: 'Redação' },
  { to: '/perfil', label: 'Perfil' },
];

function Home() {
  const { me } = useAuth();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">
        Olá{me?.profile?.displayName ? `, ${me.profile.displayName}` : ''}!
      </h1>
      <p className="text-sm text-slate-400">
        Use o menu para montar seu cronograma, revisar favoritos, treinar
        redação ou ajustar seu perfil.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {NAV.slice(0, 3).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4 hover:ring-emerald-500/50 transition"
          >
            <span className="font-semibold">{n.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { authenticated, me, logout } = useAuth();
  const focusMode = me?.profile?.focusMode ?? false;

  if (!authenticated) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* No modo sem distrações, a navegação e elementos decorativos somem. */}
      {!focusMode && (
        <header className="border-b border-slate-800 px-4 py-3">
          <div className="mx-auto max-w-3xl flex items-center gap-3">
            <NavLink to="/" className="text-lg font-black tracking-tight">
              Op<span className="text-emerald-400">ENEM</span>
            </NavLink>
            <nav className="ml-auto flex flex-wrap gap-1 text-sm">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-1.5 transition ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              <button
                onClick={logout}
                className="rounded-md px-2.5 py-1.5 text-slate-400 hover:text-rose-300 transition"
              >
                Sair
              </button>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {focusMode && (
            <div className="mb-4 text-xs text-slate-500">
              Modo sem distrações ativo —{' '}
              <NavLink to="/perfil" className="underline">
                desativar no perfil
              </NavLink>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cronograma" element={<Cronograma />} />
            <Route path="/favoritos" element={<Favoritos />} />
            <Route path="/redacao" element={<Redacao />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
