import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type Formula,
  type Subject,
} from '../api';
import { Katex } from '../board/Katex';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconCheck, IconCopy, IconFormula, IconStar } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { areaKey, AREA_TEXT, shortSubject } from '../lib/areas';

/** Botão de copiar o LaTeX da fórmula (com confirmação efêmera). */
function CopyLatex({ formula }: { formula: Formula }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(formula.latex);
      setCopied(true);
    } catch {
      /* clipboard indisponível (http, permissão negada): silencioso */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copiar LaTeX de ${formula.title}`}
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
        copied ? 'bg-nat/12 text-nat' : 'text-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      {copied ? (
        <IconCheck width={16} height={16} />
      ) : (
        <IconCopy width={16} height={16} />
      )}
    </button>
  );
}

/**
 * Cheat sheet de fórmulas (issue #38): busca por texto, filtro por matéria,
 * favoritos e render LaTeX (KaTeX já global no bundle).
 */
export default function Formulas() {
  const [formulas, setFormulas] = useState<Formula[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState('');
  // Só a digitação precisa de debounce; selecionar matéria ou alternar
  // "Favoritas" respondia com 250ms de atraso sem motivo.
  const [debouncedQ, setDebouncedQ] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Descarta respostas de buscas antigas que cheguem fora de ordem.
  const requestIdRef = useRef(0);

  // Catálogo de matérias (uma vez).
  useEffect(() => {
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const data = await api.formulas({
        q: debouncedQ || undefined,
        subjectId: subjectId || undefined,
        onlyFavorites,
      });
      if (requestId !== requestIdRef.current) return; // resposta obsoleta
      setFormulas(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as fórmulas.',
      );
      setFormulas([]);
    }
  }, [debouncedQ, subjectId, onlyFavorites]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFavorite(f: Formula) {
    const nextFavorited = !f.favorited;
    // Otimista: inverte já, corrige em falha. No modo "só favoritas", a linha
    // sai da lista — antes ficava com a estrela vazia até um reload.
    setFormulas((cur) => {
      if (!cur) return cur;
      if (onlyFavorites && !nextFavorited) {
        return cur.filter((x) => x.id !== f.id);
      }
      return cur.map((x) =>
        x.id === f.id ? { ...x, favorited: nextFavorited } : x,
      );
    });
    try {
      await api.toggleFormulaFavorite(f.id);
    } catch {
      void load();
    }
  }

  // Agrupamento por matéria (mantém a ordenação da API).
  const bySubject = useMemo(() => {
    const map = new Map<string, Formula[]>();
    for (const f of formulas ?? []) {
      const list = map.get(f.subjectName) ?? [];
      list.push(f);
      map.set(f.subjectName, list);
    }
    return [...map.entries()];
  }, [formulas]);

  const hasFilters = q !== '' || subjectId !== '' || onlyFavorites;

  function clearFilters() {
    setQ('');
    setSubjectId('');
    setOnlyFavorites(false);
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Cheat sheet</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Fórmulas
        </h1>
        <p className="mt-1 text-sm text-muted">
          As fórmulas essenciais de todas as matérias — busque, favorite e
          revise antes da prova.
        </p>
      </header>

      {/* Busca + filtros */}
      <div className="card space-y-3 p-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, contexto ou expressão…"
          aria-label="Buscar fórmulas"
          className="input w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Filtrar por matéria"
            className="input flex-1"
          >
            <option value="">Todas as matérias</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            data-active={onlyFavorites}
            className="chip shrink-0"
            aria-pressed={onlyFavorites}
          >
            <IconStar width={13} height={13} filled={onlyFavorites} />
            Favoritas
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {formulas === null ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : bySubject.length === 0 ? (
        <EmptyState
          icon={IconFormula}
          title={onlyFavorites ? 'Nenhuma favorita ainda' : 'Nada encontrado'}
          description={
            onlyFavorites
              ? 'Toque na estrela de uma fórmula para guardá-la aqui.'
              : 'Tente outro termo ou remova os filtros de matéria.'
          }
          action={
            hasFilters
              ? { onClick: clearFilters, label: 'Limpar filtros' }
              : undefined
          }
          tip="Busque por nome do conteúdo (ex.: Bhaskara) ou pela expressão"
        />
      ) : (
        bySubject.map(([subjectName, list]) => (
          <section key={subjectName} className="card p-5">
            <h2
              className={`font-display text-lg font-bold ${
                AREA_TEXT[areaKey(subjectName)]
              }`}
            >
              {shortSubject(subjectName)}
            </h2>
            <ul className="mt-3 space-y-2.5">
              {list.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{f.title}</p>
                    {/* min-h reserva a linha enquanto o KaTeX carrega. */}
                    <p
                      className="mt-1.5 min-h-6 overflow-x-auto whitespace-nowrap py-0.5 text-base"
                      aria-label={`Fórmula: ${f.title}`}
                    >
                      <Katex latex={f.latex} />
                    </p>
                    {f.description && (
                      <p className="mt-1 text-xs text-muted">{f.description}</p>
                    )}
                    {f.topicName && (
                      <p className="mt-0.5 text-[0.65rem] text-muted">
                        Assunto: {f.topicName}
                      </p>
                    )}
                  </div>
                  <CopyLatex formula={f} />
                  <button
                    type="button"
                    onClick={() => void toggleFavorite(f)}
                    aria-label={
                      f.favorited
                        ? `Remover ${f.title} dos favoritos`
                        : `Favoritar ${f.title}`
                    }
                    aria-pressed={f.favorited}
                    className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                      f.favorited
                        ? 'bg-hum/12 text-hum'
                        : 'text-muted hover:bg-surface-2 hover:text-hum'
                    }`}
                  >
                    <IconStar width={16} height={16} filled={f.favorited} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
