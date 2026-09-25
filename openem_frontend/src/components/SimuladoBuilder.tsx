import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type SimulationFilters,
  type SimulationPreview,
  type Subject,
} from '../api';
import { areaCurta, areaKey, AREA_DOT } from '../lib/areas';
import { IconCheck, IconFilter, IconPlus, IconStack, IconX } from './icons';
import { Skeleton } from './Skeleton';

/**
 * Montador do simulado personalizado — "por tema".
 *
 * A regra que orienta a tela: área, matéria e assunto SOMAM. O aluno junta
 * "Matemática inteira" com "Genética" e leva as duas coisas, porque a maior
 * parte do banco oficial ainda não tem assunto classificado e cruzar os
 * filtros devolveria uma prova vazia — que era exatamente o defeito da versão
 * anterior desta tela. O contador ao vivo existe pelo mesmo motivo: o aluno vê
 * quantas questões o recorte tem ANTES de apertar iniciar.
 */

const QUICK_COUNTS = [5, 10, 15, 20, 30, 45];
const CURRENT_YEAR = new Date().getFullYear();

/** Um item escolhido pelo aluno, seja área, matéria ou assunto. */
interface Escolha {
  kind: 'area' | 'subject' | 'topic';
  id: string;
  label: string;
  /** Nome da matéria/área, para a cor do chip. */
  colorSource: string;
}

export interface BuilderState {
  filters: SimulationFilters;
  escolhas: Escolha[];
}

/** Filtros a partir das escolhas e das opções. */
function toFilters(
  escolhas: Escolha[],
  opts: {
    questionCount: number;
    timeLimitMin?: number;
    pareto: boolean;
    unseenOnly: boolean;
    wrongOnly: boolean;
    onlyFavorites: boolean;
    yearFrom?: number;
    yearTo?: number;
  },
): SimulationFilters {
  const porTipo = (kind: Escolha['kind']) =>
    escolhas.filter((e) => e.kind === kind).map((e) => e.id);
  const areas = porTipo('area');
  const subjects = porTipo('subject');
  const topics = porTipo('topic');
  return {
    ...(areas.length ? { subjectAreaIds: areas } : {}),
    ...(subjects.length ? { subjectIds: subjects } : {}),
    ...(topics.length ? { topicIds: topics } : {}),
    questionCount: opts.questionCount,
    ...(opts.timeLimitMin ? { timeLimitMin: opts.timeLimitMin } : {}),
    ...(opts.pareto ? { pareto: true } : {}),
    ...(opts.unseenOnly ? { unseenOnly: true } : {}),
    ...(opts.wrongOnly ? { wrongOnly: true } : {}),
    ...(opts.onlyFavorites ? { onlyFavorites: true } : {}),
    ...(opts.yearFrom ? { yearFrom: opts.yearFrom } : {}),
    ...(opts.yearTo ? { yearTo: opts.yearTo } : {}),
  };
}

/** Áreas do catálogo, deduzidas da lista de matérias. */
function areasDe(subjects: Subject[]): { id: string; name: string }[] {
  const mapa = new Map<string, string>();
  for (const s of subjects) {
    if (s.subjectArea) mapa.set(s.subjectArea.id, s.subjectArea.name);
  }
  return [...mapa.entries()].map(([id, name]) => ({ id, name }));
}

export function SimuladoBuilder({
  starting,
  onStart,
  onPdf,
  onSave,
}: {
  starting: boolean;
  onStart: (filters: SimulationFilters) => void;
  onPdf: (filters: SimulationFilters, titulo: string) => void;
  onSave: (name: string, filters: SimulationFilters) => Promise<void>;
}) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [escolhas, setEscolhas] = useState<Escolha[]>([]);
  const [subjectAberta, setSubjectAberta] = useState<string>('');
  const [count, setCount] = useState(10);
  const [tempo, setTempo] = useState<number | ''>('');
  const [pareto, setPareto] = useState(true);
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [yearFrom, setYearFrom] = useState<number | ''>('');
  const [yearTo, setYearTo] = useState<number | ''>('');
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nomeSalvar, setNomeSalvar] = useState('');
  const [salvarAberto, setSalvarAberto] = useState(false);

  useEffect(() => {
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  const filters = useMemo(
    () =>
      toFilters(escolhas, {
        questionCount: count,
        timeLimitMin: tempo === '' ? undefined : tempo,
        pareto,
        unseenOnly,
        wrongOnly,
        onlyFavorites,
        yearFrom: yearFrom === '' ? undefined : yearFrom,
        yearTo: yearTo === '' ? undefined : yearTo,
      }),
    [
      escolhas,
      count,
      tempo,
      pareto,
      unseenOnly,
      wrongOnly,
      onlyFavorites,
      yearFrom,
      yearTo,
    ],
  );

  // Contagem ao vivo, com atraso: o aluno mexe em vários chips seguidos e não
  // faz sentido consultar o servidor a cada clique.
  // O efeito depende da SERIALIZAÇÃO dos filtros, não do objeto: recalcular o
  // mesmo recorte não dispara outra consulta, e o efeito continua idempotente.
  // Guardar a última chave num ref seria a forma óbvia, e estava errada — no
  // StrictMode o React monta, desmonta e monta de novo; a limpeza da primeira
  // montagem cancelava o timer e a segunda caía no `return` do ref, deixando a
  // contagem em "Calculando…" para sempre.
  const chaveFiltros = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    let cancelado = false;
    setCarregandoPreview(true);
    const id = setTimeout(() => {
      void api
        .simulationPreview(JSON.parse(chaveFiltros) as SimulationFilters)
        .then((p) => {
          if (!cancelado) setPreview(p);
        })
        .catch(() => {
          if (!cancelado) setPreview(null);
        })
        .finally(() => {
          if (!cancelado) setCarregandoPreview(false);
        });
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
  }, [chaveFiltros]);

  const areas = useMemo(() => areasDe(subjects ?? []), [subjects]);
  const materiasVisiveis = useMemo(() => {
    const areasEscolhidas = escolhas
      .filter((e) => e.kind === 'area')
      .map((e) => e.id);
    if (!subjects) return [];
    // Com área escolhida, o seletor mostra só as matérias dela — é o caminho
    // natural de "quero Matemática" para "quero Funções".
    return areasEscolhidas.length
      ? subjects.filter(
          (s) => s.subjectArea && areasEscolhidas.includes(s.subjectArea.id),
        )
      : subjects;
  }, [subjects, escolhas]);

  const toggle = useCallback((item: Escolha) => {
    setEscolhas((atual) => {
      const existe = atual.some(
        (e) => e.kind === item.kind && e.id === item.id,
      );
      return existe
        ? atual.filter((e) => !(e.kind === item.kind && e.id === item.id))
        : [...atual, item];
    });
  }, []);

  const escolhido = (kind: Escolha['kind'], id: string) =>
    escolhas.some((e) => e.kind === kind && e.id === id);

  const materia = subjects?.find((s) => s.id === subjectAberta);
  const semQuestao = preview !== null && preview.available === 0;
  const naoCabe =
    preview !== null && preview.available > 0 && preview.available < count;

  async function salvar() {
    const nome = nomeSalvar.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      await onSave(nome, filters);
      setNomeSalvar('');
      setSalvarAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card card-raised overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          <IconFilter width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Monte o seu por tema</h3>
          <p className="text-xs text-muted">
            Junte áreas, matérias e assuntos: eles se somam, nunca se anulam.
          </p>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Temas escolhidos */}
        {escolhas.length > 0 && (
          <div>
            <span className="block text-xs font-medium text-muted">
              No seu simulado
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {escolhas.map((e) => (
                <button
                  key={`${e.kind}:${e.id}`}
                  type="button"
                  onClick={() => toggle(e)}
                  className="chip"
                  data-active="true"
                  aria-label={`Remover ${e.label}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${AREA_DOT[areaKey(e.colorSource)]}`}
                  />
                  {e.label}
                  <IconX width={11} height={11} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEscolhas([])}
                className="chip text-muted"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Áreas */}
        <div>
          <span className="block text-xs font-medium text-muted">
            Áreas do conhecimento
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {subjects === null ? (
              <span className="flex gap-1.5" aria-busy>
                {[88, 72, 96, 80].map((w) => (
                  <Skeleton key={w} className="h-8" style={{ width: w }} />
                ))}
              </span>
            ) : (
              areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    toggle({
                      kind: 'area',
                      id: a.id,
                      label: areaCurta(a.name),
                      colorSource: a.name,
                    })
                  }
                  data-active={escolhido('area', a.id)}
                  className="chip"
                >
                  <span
                    className={`size-1.5 rounded-full ${AREA_DOT[areaKey(a.name)]}`}
                  />
                  {areaCurta(a.name)}
                  {escolhido('area', a.id) && (
                    <IconCheck width={11} height={11} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Matéria → assuntos */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block text-xs font-medium text-muted">
            Matéria
            <select
              value={subjectAberta}
              onChange={(e) => setSubjectAberta(e.target.value)}
              className="input mt-1"
            >
              <option value="">Escolha para ver os assuntos</option>
              {materiasVisiveis.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {materia && (
            <button
              type="button"
              onClick={() =>
                toggle({
                  kind: 'subject',
                  id: materia.id,
                  label: materia.name,
                  colorSource: materia.name,
                })
              }
              data-active={escolhido('subject', materia.id)}
              className="chip h-9 justify-center"
            >
              <IconPlus width={12} height={12} />
              Matéria inteira
            </button>
          )}
        </div>

        {materia && (
          <div>
            <span className="block text-xs font-medium text-muted">
              Assuntos de {materia.name}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {materia.topics.length === 0 ? (
                <span className="text-xs text-muted">
                  Esta matéria ainda não tem assuntos cadastrados.
                </span>
              ) : (
                materia.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      toggle({
                        kind: 'topic',
                        id: t.id,
                        label: t.name,
                        colorSource: materia.name,
                      })
                    }
                    data-active={escolhido('topic', t.id)}
                    className="chip"
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quantidade */}
        <div>
          <span className="block text-xs font-medium text-muted">
            Quantidade de questões
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {QUICK_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                data-active={count === n}
                className="chip"
              >
                {n}
                {n <= 10 && <span className="text-xs text-muted">rápido</span>}
              </button>
            ))}
            <input
              type="number"
              min={3}
              max={180}
              value={count}
              onChange={(e) =>
                setCount(
                  Math.min(180, Math.max(3, Number(e.target.value) || 3)),
                )
              }
              aria-label="Quantidade de questões"
              className="input w-20 px-2 py-1 text-center font-data tabular-nums"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMaisFiltros((v) => !v)}
          aria-expanded={maisFiltros}
          className="text-xs font-medium text-brand"
        >
          {maisFiltros ? 'Menos opções' : 'Mais opções (tempo, anos, revisão)'}
        </button>

        {maisFiltros && (
          <div className="space-y-3 rounded-xl border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-muted">
                Tempo (min)
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={tempo}
                  placeholder="automático"
                  onChange={(e) =>
                    setTempo(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                De (ano)
                <input
                  type="number"
                  min={2009}
                  max={CURRENT_YEAR}
                  value={yearFrom}
                  placeholder="2009"
                  onChange={(e) =>
                    setYearFrom(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  className="input mt-1"
                />
              </label>
              <label className="block text-xs font-medium text-muted">
                Até (ano)
                <input
                  type="number"
                  min={2009}
                  max={CURRENT_YEAR}
                  value={yearTo}
                  placeholder={String(CURRENT_YEAR)}
                  onChange={(e) =>
                    setYearTo(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  className="input mt-1"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPareto((v) => !v)}
                data-active={pareto}
                className="chip"
              >
                Assuntos mais cobrados primeiro
              </button>
              <button
                type="button"
                onClick={() => setUnseenOnly((v) => !v)}
                data-active={unseenOnly}
                className="chip"
              >
                Só inéditas
              </button>
              <button
                type="button"
                onClick={() => setWrongOnly((v) => !v)}
                data-active={wrongOnly}
                className="chip"
              >
                Só as que errei
              </button>
              <button
                type="button"
                onClick={() => setOnlyFavorites((v) => !v)}
                data-active={onlyFavorites}
                className="chip"
              >
                Só favoritas
              </button>
            </div>
          </div>
        )}

        {/* Prévia */}
        <div
          className={`rounded-xl border p-3 text-xs ${
            semQuestao
              ? 'border-danger/40 bg-danger/8'
              : 'border-line bg-surface-2/50'
          }`}
          aria-live="polite"
        >
          {carregandoPreview && preview === null ? (
            <span className="text-muted">Calculando…</span>
          ) : semQuestao ? (
            <span className="text-danger">
              Nenhuma questão combina com esse recorte. Tire um filtro ou
              escolha a área inteira.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <IconStack width={13} height={13} />
                {preview?.available ?? '...'} questões disponíveis
              </span>
              <span className="text-muted">
                {Math.min(count, preview?.available ?? count)} no simulado ·{' '}
                {preview?.timeLimitMin ?? '...'} min
              </span>
              {naoCabe && (
                <span className="text-muted">
                  (o recorte tem menos questões do que você pediu)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStart(filters)}
            disabled={starting || semQuestao}
            className="btn btn-primary flex-1"
          >
            {starting ? 'Iniciando…' : 'Iniciar simulado'}
          </button>
          <button
            type="button"
            onClick={() =>
              onPdf(
                filters,
                escolhas.length
                  ? `Simulado de ${escolhas.map((e) => e.label).join(', ')}`
                  : 'Simulado OpENEM',
              )
            }
            disabled={semQuestao}
            className="btn btn-ghost"
          >
            Baixar PDF
          </button>
          <button
            type="button"
            onClick={() => setSalvarAberto((v) => !v)}
            className="btn btn-ghost"
          >
            Salvar
          </button>
        </div>

        {salvarAberto && (
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted">
                Nome do simulado
              </span>
              <input
                value={nomeSalvar}
                onChange={(e) => setNomeSalvar(e.target.value)}
                placeholder="Ex.: Funções e Estatística"
                maxLength={60}
                className="input mt-1.5"
              />
            </label>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando || !nomeSalvar.trim()}
              className="btn btn-primary shrink-0"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
