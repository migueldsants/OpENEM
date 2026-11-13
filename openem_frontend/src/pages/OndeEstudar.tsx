import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type StudyResources } from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { MaterialCard } from '../components/MaterialCard';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import { AREA_DOT, areaKey } from '../lib/areas';
import {
  agrupar,
  filtrar,
  GUIA_MATERIAIS_URL,
  materiasComMaterial,
  TERMOS_LINKS_URL,
} from '../lib/onde-estudar';

/**
 * Onde estudar (discussão #126): cursos, videoaulas, livros e exercícios
 * gratuitos de instituições públicas ou sem fins lucrativos. O catálogo vem
 * do servidor (`GET /study-resources`), que já tira o que foi bloqueado e o
 * que tem conferência vencida. Os links abrem no site da instituição, numa
 * aba nova, sem enviar o endereço do app (`noreferrer`).
 */
export default function OndeEstudar() {
  const [dados, setDados] = useState<StudyResources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [params, setParams] = useSearchParams();
  const [termo, setTermo] = useState('');

  useEffect(() => {
    let vivo = true;
    setError(null);
    api
      .studyResources()
      .then((d) => vivo && setDados(d))
      .catch(
        () =>
          vivo && setError('Não foi possível carregar os materiais. Verifique sua conexão.'),
      );
    return () => {
      vivo = false;
    };
  }, [reloadKey]);

  const materias = useMemo(() => materiasComMaterial(dados?.resources ?? []), [dados]);
  const pedida = params.get('materia') ?? '';
  // Matéria desconhecida no endereço (link velho, digitação) vira "todas".
  const materia = materias.includes(pedida) ? pedida : '';

  const grupos = useMemo(
    () => agrupar(filtrar(dados?.resources ?? [], { termo, materia }), materia),
    [dados, termo, materia],
  );
  const total = useMemo(
    () => new Set(grupos.flatMap((g) => g.recursos.map((r) => r.id))).size,
    [grupos],
  );

  function escolherMateria(m: string) {
    const prox = new URLSearchParams(params);
    if (m) prox.set('materia', m);
    else prox.delete('materia');
    setParams(prox, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Materiais gratuitos"
        title="Onde estudar"
        subtitle="Cursos, videoaulas, livros e exercícios gratuitos de instituições públicas e sem fins lucrativos. Cada link foi conferido pela equipe do OpENEM e abre no site da própria instituição."
      />

      <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />

      {dados === null ? (
        !error && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        )
      ) : (
        <>
          <div className="filterbar -mx-4 space-y-2.5 px-4 py-3 md:-mx-10 md:px-10">
            <input
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por assunto, instituição ou tipo…"
              aria-label="Buscar materiais"
              className="input w-full"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={materia}
                onChange={(e) => escolherMateria(e.target.value)}
                aria-label="Filtrar por matéria"
                className="input min-w-0 basis-full sm:basis-0 sm:flex-1"
              >
                <option value="">Todas as matérias</option>
                {materias.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="shrink-0 text-sm text-muted" aria-live="polite">
                <span className="font-data tabular-nums">{total}</span>{' '}
                {total === 1 ? 'material' : 'materiais'}
              </p>
            </div>
          </div>

          {grupos.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">
              Nenhum material para essa busca. Tente outra palavra ou escolha outra matéria.
            </div>
          ) : (
            grupos.map((g) => (
              <section
                key={g.materia ?? 'todas'}
                aria-labelledby={`grupo-${g.materia ?? 'todas'}`}
                className="space-y-3"
              >
                <h2
                  id={`grupo-${g.materia ?? 'todas'}`}
                  className="flex items-center gap-2 font-display text-lg font-bold"
                >
                  {g.materia && (
                    <span
                      aria-hidden
                      className={`size-2.5 rounded-full ${AREA_DOT[areaKey(g.materia)]}`}
                    />
                  )}
                  {g.materia ?? 'Para todas as matérias'}
                </h2>
                <ul
                  className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                  aria-label={`Materiais de ${g.materia ?? 'todas as matérias'}`}
                >
                  {g.recursos.map((r) => (
                    <li key={r.id}>
                      <MaterialCard recurso={r} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          <ComoEscolhemos dias={dados.maxCheckAgeDays} />
        </>
      )}
    </div>
  );
}

function ComoEscolhemos({ dias }: { dias: number }) {
  return (
    <section className="card space-y-3 p-4 text-sm sm:p-5" aria-labelledby="como-escolhemos">
      <h2 id="como-escolhemos" className="font-display text-lg font-bold">
        Como escolhemos
      </h2>
      <ul className="list-disc space-y-1.5 pl-5 text-muted text-pretty">
        <li>
          Só instituições públicas ou sem fins lucrativos. Cursinhos e plataformas que vendem
          cursos ficam de fora, mesmo quando parte do conteúdo é aberta.
        </li>
        <li>
          Todo material abre sem pagar e sem cadastro. Onde existe conta, ela é opcional e só
          guarda o seu progresso.
        </li>
        <li>
          O link leva ao site da própria instituição, nunca a cópias em outros sites. O OpENEM
          não recebe nada por esses links e não registra em quais você clica.
        </li>
        <li>
          Cada link é conferido por uma pessoa. Se ninguém conferir de novo em {dias} dias, ele
          sai da lista sozinho.
        </li>
        <li>
          Ao clicar, você sai do OpENEM: lá valem as regras e a política de privacidade da
          instituição.
        </li>
      </ul>
      <p className="text-muted text-pretty">
        Achou um link quebrado, que passou a cobrar ou que desrespeita direitos de alguém?{' '}
        <a
          href={TERMOS_LINKS_URL}
          className="font-semibold text-brand underline underline-offset-2"
        >
          Veja como pedir a remoção
        </a>
        . Quer sugerir um material?{' '}
        <a
          href={GUIA_MATERIAIS_URL}
          className="font-semibold text-brand underline underline-offset-2"
        >
          Leia o guia de contribuição
        </a>
        .
      </p>
    </section>
  );
}
