import { ArrowRight, ArrowsClockwise, Check, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { APP_URL } from '../config';
import { proximaQuestao, QUESTOES, type QuestaoDemo } from './questoes';

const AREA_TEXTO: Record<QuestaoDemo['area'], string> = {
  mat: 'text-mat',
  nat: 'text-nat',
  hum: 'text-hum',
  lin: 'text-lin',
  red: 'text-red',
};
const AREA_FUNDO: Record<QuestaoDemo['area'], string> = {
  mat: 'bg-mat',
  nat: 'bg-nat',
  hum: 'bg-hum',
  lin: 'bg-lin',
  red: 'bg-red',
};

/**
 * O player de questões do app (pages/Questoes.tsx), em miniatura e sem conta:
 * escolhe, confirma em Responder e vê o gabarito, a resolução e o que o app
 * faria com aquela resposta.
 */
export function QuestaoAoVivo({ inicial = 0 }: { inicial?: number }) {
  const [indice, setIndice] = useState(inicial);
  const [escolha, setEscolha] = useState<string | null>(null);
  const [respondida, setRespondida] = useState(false);
  const q = QUESTOES[indice];
  const acertou = respondida && escolha === q.correta;
  const acoes = useRef<HTMLDivElement>(null);

  // O retorno e a linha de ações (Outra / Começar a estudar) aparecem abaixo
  // das alternativas, às vezes fora da tela do celular: rola só o necessário
  // para a linha de ações ficar à vista, com o retorno logo acima dela.
  useEffect(() => {
    if (!respondida || !acoes.current) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    acoes.current.scrollIntoView({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
  }, [respondida]);

  function outra() {
    setIndice((i) => proximaQuestao(i));
    setEscolha(null);
    setRespondida(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <p className="font-display text-lg font-bold tracking-tight">Questões</p>
        <span className="chip">Sem conta</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        <article className="card card-raised overflow-hidden" aria-label={`${q.prova}, questão ${q.numero}`}>
          <div className="flex items-start gap-3 p-3.5">
            <span className={`mt-1 h-9 w-1 shrink-0 rounded-full ${AREA_FUNDO[q.area]}`} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className={`font-semibold ${AREA_TEXTO[q.area]}`}>{q.materia}</span>
                <span className="rounded-lg bg-surface-2 px-1.5 py-0.5 font-mono tracking-tight text-muted">
                  {q.prova} · {q.numero}
                </span>
              </p>
              {q.enunciado.map((p) => (
                <p key={p} className="mt-2 text-[0.84rem] leading-relaxed">
                  {p}
                </p>
              ))}
              {q.fonte && <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">{q.fonte}</p>}
              <p className="mt-2 text-[0.84rem] font-medium leading-relaxed">{q.comando}</p>
            </div>
          </div>

          <div className="space-y-1.5 px-3.5 pb-3.5">
            {q.alternativas.map((alt) => {
              const escolhida = escolha === alt.letra;
              const certa = respondida && alt.letra === q.correta;
              const errada = respondida && escolhida && !certa;
              const estado = respondida
                ? certa
                  ? 'border-success bg-success/10'
                  : errada
                    ? 'border-danger bg-danger/10'
                    : 'border-line text-muted'
                : escolhida
                  ? 'border-brand bg-brand/8'
                  : 'border-line hover:bg-surface-2';
              return (
                <button
                  key={alt.letra}
                  type="button"
                  disabled={respondida}
                  aria-pressed={respondida ? undefined : escolhida}
                  onClick={() => setEscolha(alt.letra)}
                  className={`aperta flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[0.82rem] disabled:cursor-default ${estado}`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                      escolhida && !respondida ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {alt.letra}
                  </span>
                  <span className="min-w-0 flex-1">{alt.texto}</span>
                  {certa && (
                    <>
                      <Check size={16} weight="bold" className="shrink-0 text-success" />
                      <span className="sr-only">(resposta correta)</span>
                    </>
                  )}
                  {errada && (
                    <>
                      <X size={16} weight="bold" className="shrink-0 text-danger" />
                      <span className="sr-only">(sua resposta)</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <p className="sr-only" aria-live="polite">
            {respondida
              ? acertou
                ? 'Você acertou!'
                : `Não foi dessa vez. A resposta certa é a ${q.correta}.`
              : ''}
          </p>

          {respondida ? (
            <div
              className={`animate-rise border-t px-3.5 py-3 ${
                acertou ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
              }`}
            >
              <p className={`text-sm font-semibold ${acertou ? 'text-success' : 'text-danger'}`}>
                {acertou ? 'Você acertou!' : `Não foi dessa vez. A certa é a ${q.correta}.`}
              </p>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed">{q.resolucao}</p>
              {/* O que o app faria com esta resposta: XP (POINTS em common/gamification.ts)
                  e a revisão espaçada do assunto. */}
              <p className="mt-2 text-[0.8rem] leading-relaxed text-muted">
                <span className="font-data font-medium text-brand">{acertou ? '+10 XP' : '+2 XP'}</span>{' '}
                {acertou
                  ? 'no app, e cada acerto seguido afasta a próxima revisão deste assunto.'
                  : 'no app (errar também é estudar), e o assunto volta na sua revisão de amanhã.'}
              </p>
            </div>
          ) : (
            <div className="border-t border-line px-3.5 py-3">
              <button
                type="button"
                disabled={!escolha}
                onClick={() => setRespondida(true)}
                className="btn btn-primary aperta w-full"
              >
                Responder
              </button>
            </div>
          )}
        </article>

        {respondida && (
          <div ref={acoes} className="animate-rise mt-3 grid scroll-mb-4 grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={outra} className="btn btn-ghost aperta bg-surface">
              <ArrowsClockwise size={16} />
              Outra
            </button>
            <a href={APP_URL} className="btn btn-primary aperta px-3 text-[0.8rem] whitespace-nowrap">
              Começar a estudar
              <ArrowRight size={16} weight="bold" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
