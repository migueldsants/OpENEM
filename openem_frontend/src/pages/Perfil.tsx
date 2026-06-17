import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Perfil() {
  const { me, refreshMe } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = me?.profile;

  async function update(patch: { focusMode?: boolean; minutesPerDay?: number }) {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile(patch);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Perfil</h1>

      <div className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4 space-y-1 text-sm">
        <p>
          <span className="text-slate-400">E-mail:</span> {me?.email}
        </p>
        <p>
          <span className="text-slate-400">Objetivo:</span>{' '}
          {profile?.goal ?? '—'}
        </p>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4 space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={profile?.focusMode ?? false}
            disabled={saving}
            onChange={(e) => update({ focusMode: e.target.checked })}
            className="size-4 accent-emerald-500"
          />
          <span className="text-sm">
            Modo sem distrações
            <span className="block text-xs text-slate-500">
              Esconde a navegação e elementos decorativos para você focar.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-xs text-slate-400">
            Minutos de estudo por dia
          </span>
          <input
            type="number"
            min={5}
            max={1440}
            defaultValue={profile?.minutesPerDay ?? 60}
            disabled={saving}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (value && value !== profile?.minutesPerDay) {
                void update({ minutesPerDay: value });
              }
            }}
            className="mt-1 w-32 rounded-lg bg-slate-950 ring-1 ring-slate-800 px-3 py-2 text-sm outline-none focus:ring-emerald-500"
          />
        </label>
      </div>
    </div>
  );
}
