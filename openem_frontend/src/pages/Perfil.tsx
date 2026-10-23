import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { NavLink } from 'react-router-dom';
import { ThemePreview } from '../components/ThemePreview';
import { ErrorBanner } from '../components/ErrorBanner';
import { FAMILIES, useTheme } from '../theme';
import { PageHeader } from '../components/PageHeader';
import { DOCS_URL, docsAlunos } from '../lib/site';

const GOALS = [
  { value: 'SISU', label: 'SISU' },
  { value: 'PROUNI', label: 'ProUni' },
  { value: 'TREINEIRO', label: 'Treineiro' },
] as const;

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-surface-2 border border-line'
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[1.45rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function Perfil() {
  const { me, refreshMe } = useAuth();
  const { family, variant, custom, setVariant } = useTheme();
  const currentName =
    family === 'custom'
      ? (custom?.name ?? 'Personalizado')
      : (FAMILIES.find((f) => f.key === family)?.label ?? 'Padrão');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = me?.profile;

  // Inputs controlados, re-semeados quando o perfil carrega de forma assíncrona,
  // para que um blur sem digitação não sobrescreva o que estava salvo.
  const [displayName, setDisplayName] = useState('');
  const [minutes, setMinutes] = useState(60);
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
      setMinutes(profile.minutesPerDay);
    }
    // Re-semeia só quando os campos exibidos mudam (não em qualquer update do profile).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.displayName, profile?.minutesPerDay]);

  async function update(patch: {
    focusMode?: boolean;
    gamificationEnabled?: boolean;
    minutesPerDay?: number;
    goal?: string;
    displayName?: string | null;
    foreignLanguage?: string;
  }) {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile(patch);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Perfil" />

      {error && (
        <ErrorBanner message={error} />
      )}

      <div className="card card-raised p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-brand/12 font-display text-lg font-extrabold text-brand">
            {(profile?.displayName ?? me?.email ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {profile?.displayName ?? me?.email}
            </p>
            <p className="truncate text-xs text-muted">{me?.email}</p>
          </div>
          <span className="chip ml-auto">
            {GOALS.find((g) => g.value === profile?.goal)?.label ?? 'SISU'}
          </span>
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <label className="block">
          <span className="eyebrow">Como quer ser chamado</span>
          <input
            type="text"
            maxLength={80}
            value={displayName}
            disabled={saving}
            placeholder="Seu nome"
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={() => {
              const value = displayName.trim();
              if (value !== (profile?.displayName ?? '')) {
                // Vazio volta a null para o fallback de e-mail funcionar.
                void update({ displayName: value || null });
              }
            }}
            className="input mt-1.5"
          />
        </label>
        <div>
          <span className="eyebrow">Seu objetivo</span>
          <p className="mb-2 text-xs text-muted">
            Ajusta as recomendações ao seu foco.
          </p>
          <div className="seg">
            {GOALS.map((g) => (
              <button
                key={g.value}
                data-active={(profile?.goal ?? 'SISU') === g.value}
                disabled={saving}
                onClick={() => update({ goal: g.value })}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <ThemePreview
            theme={family === 'custom' ? undefined : `${family}-${variant}`}
            tokens={family === 'custom' ? custom?.[variant] : undefined}
            variant={variant}
            className="w-32 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Aparência</p>
            <p className="mt-0.5 text-xs text-muted">
              Tema atual: <span className="font-semibold text-fg">{currentName}</span>
            </p>
            <NavLink
              to="/temas"
              className="mt-1.5 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Ver todos os temas
            </NavLink>
          </div>
          {/* Toggle claro/escuro rápido */}
          <div className="seg">
            <button
              data-active={variant === 'light'}
              onClick={() => setVariant('light')}
            >
              Claro
            </button>
            <button
              data-active={variant === 'dark'}
              onClick={() => setVariant('dark')}
            >
              Escuro
            </button>
          </div>
        </div>
      </div>

      <div className="card p-2">
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Modo sem distrações</p>
            <p className="text-xs text-muted">
              Esconde a navegação para você focar.
            </p>
          </div>
          <div className="ml-auto">
            <Switch
              checked={profile?.focusMode ?? false}
              disabled={saving}
              onChange={(v) => update({ focusMode: v })}
              label="Alternar modo sem distrações"
            />
          </div>
        </div>

        <div className="border-t border-line" />

        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Gamificação</p>
            <p className="text-xs text-muted">
              XP, níveis, sequência e conquistas ao responder questões.
            </p>
          </div>
          <div className="ml-auto">
            <Switch
              checked={profile?.gamificationEnabled ?? true}
              disabled={saving}
              onChange={(v) => update({ gamificationEnabled: v })}
              label="Alternar gamificação"
            />
          </div>
        </div>

        <div className="border-t border-line" />

        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Língua estrangeira</p>
            <p className="text-xs text-muted">
              Qual versão das questões de língua estrangeira aparece para você,
              nas questões e nos simulados das provas.
            </p>
          </div>
          <div className="seg ml-auto" role="group" aria-label="Língua estrangeira">
            {[
              { valor: 'ingles', nome: 'Inglês' },
              { valor: 'espanhol', nome: 'Espanhol' },
            ].map(({ valor, nome }) => (
              <button
                key={valor}
                type="button"
                disabled={saving}
                data-active={(profile?.foreignLanguage ?? 'ingles') === valor}
                onClick={() => void update({ foreignLanguage: valor })}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <label className="block">
          <span className="eyebrow">Minutos de estudo por dia</span>
          <p className="mb-2 text-xs text-muted">
            Quanto tempo você pretende estudar por dia.
          </p>
          <input
            type="number"
            min={5}
            max={1440}
            value={minutes}
            disabled={saving}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={() => {
              if (minutes && minutes !== profile?.minutesPerDay) {
                void update({ minutesPerDay: minutes });
              }
            }}
            className="input w-32"
          />
        </label>
      </div>

      <div className="card p-4">
        <p className="eyebrow">Ajuda</p>
        <p className="mt-1 text-sm text-muted">
          Como usar cada tela do app, o que acontece com os seus dados e as
          perguntas mais comuns.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={DOCS_URL} className="btn btn-ghost">
            Abrir a documentação
          </a>
          <a href={docsAlunos('perguntas-frequentes')} className="btn btn-ghost">
            Perguntas frequentes
          </a>
        </div>
      </div>
    </div>
  );
}
