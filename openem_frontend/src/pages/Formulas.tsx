import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type Formula,
  type Subject,
} from '../api';
import { Katex } from '../board/Katex';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { FormulaSheet } from '../components/FormulaSheet';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconExpand,
  IconFormula,
  IconStar,
} from '../components/icons';
import Reveal from '../components/Reveal';
import { SkeletonCard } from '../components/Skeleton';
import {
  areaKey,
  AREA_DOT,
  AREA_TEXT,
  compareSubjects,
  shortSubject,
} from '../lib/areas';

/** Copia um LaTeX e sinaliza o sucesso por ~1,5s. */
function useCopyLatex(): [string | null, (f: Formula) => void] {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedId]);

  const copy = useCallback((f: Formula) => {
    navigator.clipboard
      ?.writeText(f.latex)
      .then(() => setCopiedId(f.id))
      // clipboard indisponível (http, permissão negada): silencioso.
      .catch(() => {});
  }, []);

  return [copiedId, copy];
}

/** Card de uma fórmula: a expressão é o conteúdo-herói, não o título. */
function FormulaCard({
  formula,
  copied,
  onCopy,
  onOpen,
  onToggleFavorite,
}: {
  formula: Formula;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <li className="card lift flex flex-col p-3.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-pretty">
          {formula.title}
        </p>
        <button
          type="button"
          onClick={onCopy}
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
        <button
          type="button"
          onClick={onToggleFavorite}
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

      {/* A expressão abre o detalhe com a legenda dos símbolos. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${formula.title}`}
        className="slab mt-2.5 min-h-14 w-full overflow-x-auto px-3 py-2.5 text-center text-lg transition-colors hover:border-brand/40 hover:bg-surface"
      >
        <span className="inline-block whitespace-nowrap">
          <Katex latex={formula.latex} />
        </span>
      </button>

      {formula.description && (
        <p className="mt-2 text-xs leading-relaxed text-muted text-pretty">
          {formula.description}
        </p>
      )}
      {/* O assunto já titula o grupo; repetir aqui era ruído. */}
      <div className="mt-auto flex items-center gap-2 pt-2.5">
        <button type="button" onClick={onOpen} className="chip shrink-0">
          <IconExpand width={12} height={12} />
          Expandir
        </button>
      </div>
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
  const [openId, setOpenId] = useState<string | null>(null);
  // Matérias começam abertas (viram um índice de assuntos); assuntos começam
  // fechados, senão a cola inteira vira uma página quilométrica.
  const [subjectOpen, setSubjectOpen] = useState<Record<string, boolean>>({});
  const [topicOpen, setTopicOpen] = useState<Record<string, boolean>>({});
  const [copiedId, copyLatex] = useCopyLatex();
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

  /**
   * Agrupamento em dois níveis: matéria › assunto (mantém a ordenação da
   * API). Sem o segundo nível, Matemática virava uma lista corrida de 18
   * fórmulas sem nenhuma pista de onde cada uma se encaixa.
   */
  const bySubject = useMemo(() => {
    const subjects = new Map<string, Map<string, Formula[]>>();
    for (const f of formulas ?? []) {
      const topics = subjects.get(f.subjectName) ?? new Map<string, Formula[]>();
      // Fórmulas sem assunto cadastrado caem num grupo próprio, no fim.
      const key = f.topicName ?? '';
      topics.set(key, [...(topics.get(key) ?? []), f]);
      subjects.set(f.subjectName, topics);
    }
    return [...subjects.entries()]
      // Física e Matemática abrem a cola; Biologia e Redação fecham.
      .sort(([a], [b]) => compareSubjects(a, b))
      .map(([subjectName, topics]) => ({
      subjectName,
      count: [...topics.values()].reduce((n, list) => n + list.length, 0),
      topics: [...topics.entries()]
        .map(([topicName, list]) => ({ topicName, list }))
        .sort((a, b) => {
          if (a.topicName === '') return 1;
          if (b.topicName === '') return -1;
          return a.topicName.localeCompare(b.topicName, 'pt-BR');
        }),
    }));
  }, [formulas]);

  const open = formulas?.find((f) => f.id === openId) ?? null;
  const total = formulas?.length ?? 0;
  const hasFilters = q !== '' || subjectId !== '' || onlyFavorites;

  // Com filtro ativo tudo abre: resultado escondido atrás de um grupo fechado
  // faz a busca parecer quebrada.
  const isSubjectOpen = (name: string) =>
    hasFilters || (subjectOpen[name] ?? true);
  const isTopicOpen = (key: string) => hasFilters || (topicOpen[key] ?? false);

  function toggleSubject(name: string) {
    setSubjectOpen((cur) => ({ ...cur, [name]: !(cur[name] ?? true) }));
  }
  function toggleTopic(key: string) {
    setTopicOpen((cur) => ({ ...cur, [key]: !(cur[key] ?? false) }));
  }

  /** Abre ou fecha matérias e assuntos de uma vez. */
  function setAll(open: boolean) {
    const subjects: Record<string, boolean> = {};
    const topics: Record<string, boolean> = {};
    for (const group of bySubject) {
      subjects[group.subjectName] = open;
      for (const t of group.topics) {
        topics[`${group.subjectName}::${t.topicName}`] = open;
      }
    }
    setSubjectOpen(subjects);
    setTopicOpen(topics);
  }

  // "Expandir tudo" só faz sentido enquanto houver algo fechado.
  const allExpanded =
    bySubject.length > 0 &&
    bySubject.every(
      (g) =>
        (subjectOpen[g.subjectName] ?? true) &&
        g.topics.every(
          (t) => topicOpen[`${g.subjectName}::${t.topicName}`] ?? false,
        ),
    );

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
            <>
              <button
                type="button"
                onClick={() => setAll(!allExpanded)}
                disabled={hasFilters}
                title={
                  hasFilters
                    ? 'Com filtro ativo os grupos ficam abertos'
                    : undefined
                }
                className="chip ml-auto shrink-0"
              >
                {allExpanded ? (
                  <IconChevronDown width={12} height={12} />
                ) : (
                  <IconChevronRight width={12} height={12} />
                )}
                {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
              </button>
              <span className="shrink-0 font-data text-xs text-muted">
                {total} {total === 1 ? 'fórmula' : 'fórmulas'}
              </span>
            </>
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
        <div className="space-y-3">
          {bySubject.map(({ subjectName, count, topics }, i) => {
            const area = areaKey(subjectName);
            const subjectShown = isSubjectOpen(subjectName);
            return (
              <Reveal as="section" key={subjectName} delay={i * 40}>
                {/* Matéria: cabeçalho colapsável, ancorado na cor da área. */}
                <button
                  type="button"
                  onClick={() => toggleSubject(subjectName)}
                  aria-expanded={subjectShown}
                  className="flex w-full items-center gap-2.5 rounded-lg py-1 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={`shrink-0 transition-transform ${AREA_TEXT[area]} ${
                      subjectShown ? 'rotate-90' : ''
                    }`}
                    aria-hidden
                  >
                    <IconChevronRight width={13} height={13} />
                  </span>
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
                    {count}
                  </span>
                </button>

                {subjectShown && (
                  <div className="mt-1.5 space-y-1 pl-1.5">
                    {topics.map(({ topicName, list }) => {
                      const key = `${subjectName}::${topicName}`;
                      const topicShown = isTopicOpen(key);
                      return (
                        <div key={topicName || 'sem-assunto'}>
                          {/* Assunto: hierarquia mais leve que a da matéria. */}
                          <button
                            type="button"
                            onClick={() => toggleTopic(key)}
                            aria-expanded={topicShown}
                            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span
                              className="shrink-0 text-muted"
                              aria-hidden
                            >
                              {topicShown ? (
                                <IconChevronDown width={11} height={11} />
                              ) : (
                                <IconChevronRight width={11} height={11} />
                              )}
                            </span>
                            <h3 className="eyebrow shrink-0">
                              {topicName || 'Outras'}
                            </h3>
                            <span className="h-px flex-1 bg-line" aria-hidden />
                            <span className="shrink-0 font-data text-[0.65rem] text-muted">
                              {list.length}
                            </span>
                          </button>
                          {topicShown && (
                            <ul className="mb-3 mt-2 grid gap-3 pl-4 sm:grid-cols-2">
                              {list.map((f) => (
                                <FormulaCard
                                  key={f.id}
                                  formula={f}
                                  copied={copiedId === f.id}
                                  onCopy={() => copyLatex(f)}
                                  onOpen={() => setOpenId(f.id)}
                                  onToggleFavorite={() => void toggleFavorite(f)}
                                />
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Reveal>
            );
          })}
        </div>
      )}

      {open && (
        <FormulaSheet
          formula={open}
          copied={copiedId === open.id}
          onCopy={() => copyLatex(open)}
          onToggleFavorite={() => void toggleFavorite(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
