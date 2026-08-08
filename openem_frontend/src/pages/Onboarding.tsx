import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { IconCheck, IconSparkle, IconStar, IconTarget, IconTimer } from '../components/icons';

const GOALS = [
  {
    value: 'SISU',
    label: 'SISU',
    desc: 'Vaga em universidade pública federal.',
  },
  {
    value: 'PROUNI',
    label: 'ProUni',
    desc: 'Bolsa em faculdade particular.',
  },
  {
    value: 'TREINEIRO',
    label: 'Treineiro',
    desc: 'Testar meus conhecimentos.',
  },
] as const;

const MINUTES_OPTIONS = [30, 60, 120, 180, 240];

export default function Onboarding() {
  const { me, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);
  const [goal, setGoal] = useState<string>(me?.profile?.goal ?? 'SISU');
  const [minutesPerDay, setMinutesPerDay] = useState<number>(
    me?.profile?.minutesPerDay ?? 60,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ goal, minutesPerDay, onboarded: true });
      await refreshMe();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-10 text-center animate-pop">
        <span className="mx-auto grid size-24 place-items-center rounded-3xl bg-brand/12 text-brand animate-pop">
          <IconCheck width={56} height={56} filled />
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
          Bem-vindo(a) ao OpENEM!
        </h1>
        <p className="mt-2 text-sm text-muted">
          Seu plano está pronto. Bora estudar?
        </p>
        <div className="mt-4 flex justify-center gap-1.5 text-brand">
          <IconSparkle width={20} height={20} />
          <IconStar width={20} height={20} filled />
          <IconSparkle width={20} height={20} />
        </div>
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="btn btn-primary mt-6 w-full"
        >
          Começar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-7">
        <p className="eyebrow">Bem-vindo(a)</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Vamos personalizar seu estudo
        </h1>
        <p className="mt-2 text-sm text-muted">
          Duas perguntas rápidas para adaptar recomendações e cronograma ao seu
          contexto.
        </p>
      </header>

      {/* Indicador de passo */}
      <div className="mb-6 flex items-center gap-2">
        {[0, 1].map((s) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-brand' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-brand">
            <IconTarget width={20} height={20} />
            <span className="eyebrow">Seu objetivo</span>
          </div>
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              className={`card w-full p-4 text-left transition-colors ${
                goal === g.value
                  ? 'border-brand ring-1 ring-brand'
                  : 'hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{g.label}</p>
                  <p className="text-xs text-muted">{g.desc}</p>
                </div>
                {goal === g.value && (
                  <IconCheck
                    width={20}
                    height={20}
                    filled
                    className="ml-auto text-brand"
                  />
                )}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn btn-primary mt-4 w-full"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-brand">
            <IconTimer width={20} height={20} />
            <span className="eyebrow">Tempo por dia</span>
          </div>
          <p className="text-sm text-muted">
            Quanto tempo você tem, em média, para estudar por dia?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MINUTES_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutesPerDay(m)}
                className={`card p-4 text-center transition-colors ${
                  minutesPerDay === m
                    ? 'border-brand ring-1 ring-brand'
                    : 'hover:bg-surface-2'
                }`}
              >
                <span className="font-data text-lg font-bold">
                  {m >= 60 ? m / 60 : m}
                  <span className="ml-1 text-xs text-muted">
                    {m >= 60 ? 'h' : 'min'}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="eyebrow">Ou personalize (min)</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={minutesPerDay}
              onChange={(e) => setMinutesPerDay(Number(e.target.value))}
              className="input mt-1.5 w-32"
            />
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="btn flex-1"
              disabled={saving}
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={finish}
              className="btn btn-primary flex-1"
              disabled={saving || minutesPerDay < 5}
            >
              {saving ? 'Salvando…' : 'Concluir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}