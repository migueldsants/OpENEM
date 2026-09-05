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
import Reveal from '../components/Reveal';
import { SkeletonCard } from '../components/Skeleton';
import {
  areaKey,
  AREA_DOT,
  AREA_TEXT,
  shortSubject,
} from '../lib/areas';

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

/** Card de uma fórmula: a expressão é o conteúdo-herói, não o título. */
function FormulaCard({
  formula,
  onToggleFavorite,
}: {
  formula: Formula;
  onToggleFavorite: (f: Formula) => void;
}) {
  return (
    <li className="card lift flex flex-col p-3.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-pretty">
          {formula.title}
        </p>
        <CopyLatex formula={formula} />
        <button
          type="button"
          onClick={() => onToggleFavorite(formula)}
          aria-label={
            formula.favorited
              ? `Remover ${formula.title} dos favoritos`
              : `Favoritar ${formula.title}`
          }
          aria-pressed={formula.favorited}
          className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
            formula.favorited
              ? 'bg-hum/12 text-hum'
              : 'text-muted hover:bg-surface-2 hover:text-hum'
          }`}
        >
          <IconStar width={16} height={16} filled={formula.favorited} />
        </button>
      </div>

      {/* A expressão ganha superfície própria e o maior peso visual do card. */}
      <div
        className="slab mt-2.5 min-h-14 overflow-x-auto px-3 py-2.5 text-center text-lg"
        aria-label={`Fórmula: ${formula.title}`}
      >
        <span className="inline-block whitespace-nowrap">
          <Katex latex={formula.latex} />
        </span>
      </div>

      {formula.description && (
        <p className="mt-2 text-xs leading-relaxed text-muted text-pretty">
          {formula.description}
        </p>
      )}
      {formula.topicName && (
        <p className="mt-auto pt-2 text-[0.65rem] text-muted">
          Assunto: {formula.topicName}
        </p>
      )}
    </li>
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

  const total = formulas?.length ?? 0;
  const hasFilters = q !== '' || subjectId !== '' || onlyFavorites;

  function clearFilters() {
    setQ('');
    setSubjectId('');
    setOnlyFavorites(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Cheat sheet</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Fórmulas
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted text-pretty">
          As fórmulas essenciais de todas as matérias — busque, favorite e
          revise antes da prova.
        </p>
      </header>

      {/* Busca + filtros: acompanham a rolagem, é a ação principal da tela. */}
      <div className="filterbar -mx-4 space-y-2.5 px-4 py-3 md:-mx-10 md:px-10">
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
            className="input min-w-0 basis-full sm:basis-0 sm:flex-1"
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
          {formulas !== null && total > 0 && (
            <span className="ml-auto shrink-0 font-data text-xs text-muted">
              {total} {total === 1 ? 'fórmula' : 'fórmulas'}
            </span>
          )}
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
        <div className="space-y-7">
          {bySubject.map(([subjectName, list], i) => {
            const area = areaKey(subjectName);
            return (
              <Reveal as="section" key={subjectName} delay={i * 60}>
                {/* Cabeçalho ancorado na cor da área, sem caixa em volta. */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${AREA_DOT[area]}`}
                    aria-hidden
                  />
                  <h2
                    className={`font-display text-lg font-bold ${AREA_TEXT[area]}`}
                  >
                    {shortSubject(subjectName)}
                  </h2>
                  <span
                    className={`rule-area h-px flex-1 opacity-25 ${AREA_TEXT[area]}`}
                    aria-hidden
                  />
                  <span className="shrink-0 font-data text-xs text-muted">
                    {list.length}
                  </span>
                </div>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {list.map((f) => (
                    <FormulaCard
                      key={f.id}
                      formula={f}
                      onToggleFavorite={(x) => void toggleFavorite(x)}
                    />
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
