import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Subject,
  type WeeklyGoal,
} from '../api';
import { IconCheck, IconTarget, IconTrash } from './icons';
import { Skeleton } from './Skeleton';

/** Rótulo do escopo da meta: tópico > matéria > área > geral. */
function goalScope(g: WeeklyGoal): string {
  return (
    g.topicName ??
    (g.subjectName
      ? g.subjectName.replace(' e suas Tecnologias', '')
      : null) ??
    (g.subjectAreaName
      ? g.subjectAreaName.replace(' e suas Tecnologias', '')
      : null) ??
    'Semana'
  );
}

function GoalBar({ g }: { g: WeeklyGoal }) {
  const pct =
    g.targetQuestions > 0
      ? Math.min(100, Math.round((g.questionsDone / g.targetQuestions) * 100))
      : Math.min(100, Math.round((g.minutesDone / g.targetMinutes) * 100));
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full transition-[width] ${
          g.completed ? 'bg-nat' : 'bg-gradient-to-r from-brand to-brand-2'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Mini-form de nova meta (matéria opcional + alvo). */
function NewGoalForm({
  subjects,
  onCreated,
  onCancel,
}: {
  subjects: Subject[];
  onCreated: (g: WeeklyGoal) => void;
  onCancel: () => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [questions, setQuestions] = useState(20);
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const created = await api.createWeeklyGoal({
        subjectId: subjectId || undefined,
        targetQuestions: questions || 0,
        targetMinutes: minutes || 0,
      });
      onCreated(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível criar a meta.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2.5 border-t border-line pt-3">
      {error && <p className="text-xs text-red">{error}</p>}
      <label className="block text-xs font-medium text-muted">
        Matéria (opcional)
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg"
        >
          <option value="">Semana inteira (todas)</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-muted">
          Questões
          <input
            type="number"
            min={0}
            max={999}
            value={questions}
            onChange={(e) => setQuestions(Number(e.target.value))}
            className="input mt-1 w-full"
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Minutos
          <input
            type="number"
            min={0}
            max={9999}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="input mt-1 w-full"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={saving || (!questions && !minutes)}
          className="btn btn-primary flex-1"
        >
          {saving ? 'Salvando…' : 'Criar meta'}
        </button>
        <button onClick={onCancel} className="btn btn-ghost">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Metas semanais na Home (issue #44): progresso das metas da semana com
 * barra, criação rápida (matéria + questões/minutos) e remoção.
 */
export function WeeklyGoalsCard() {
  const [goals, setGoals] = useState<WeeklyGoal[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals(await api.weeklyGoals());
    } catch {
      setGoals([]); // sem metas ou API indisponível: widget some quietinho
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (goals === null) return;
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [goals === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function removeGoal(id: string) {
    setGoals((cur) => cur?.filter((g) => g.id !== id) ?? cur);
    try {
      await api.deleteWeeklyGoal(id);
    } catch {
      void load(); // falhou: recarrega o estado real
    }
  }

  if (goals === null) {
    return (
      <div className="card card-raised p-4" aria-busy>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-9" />
      </div>
    );
  }

  return (
    <div className="card card-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display font-bold">
          <IconTarget width={18} height={18} className="text-brand" />
          Metas da semana
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            + Nova
          </button>
        )}
      </div>

      {adding && (
        <NewGoalForm
          subjects={subjects}
          onCreated={(g) => {
            setGoals((cur) => [...(cur ?? []), g]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {goals.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-muted">
          Defina uma meta — ex.: resolver 20 questões de Matemática nesta
          semana.
        </p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {g.completed && (
                    <IconCheck width={14} height={14} className="text-nat" />
                  )}
                  <span
                    className={`truncate font-medium ${
                      g.completed ? 'text-nat' : ''
                    }`}
                  >
                    {goalScope(g)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  {g.targetQuestions > 0 && (
                    <span className="tabular-nums">
                      {g.questionsDone}/{g.targetQuestions} questões
                    </span>
                  )}
                  {g.targetMinutes > 0 && (
                    <span className="tabular-nums">
                      {g.minutesDone}/{g.targetMinutes} min
                    </span>
                  )}
                  <button
                    onClick={() => void removeGoal(g.id)}
                    aria-label={`Remover meta ${goalScope(g)}`}
                    className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-red/10 hover:text-red"
                  >
                    <IconTrash width={13} height={13} />
                  </button>
                </span>
              </div>
              <GoalBar g={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}