import { ArrowRight, ArrowsClockwise, Check, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { APP_URL } from '../config';
import { QUESTOES, type QuestaoDemo } from './questoes';

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
 * O player de questões do app (pages/Questoes.tsx) no cartão da hero, sem
 * conta: escolhe, confirma em Responder e vê o gabarito, a resolução e o que o
 * app faria com aquela resposta. Quem escolhe a questão é a faixa de anos;
 * trocar de questão remonta o cartão (key), que entra com a troca por camada.
 */
export function QuestaoAoVivo({ indice, onOutra }: { indice: number; onOutra: () => void }) {
  const q = QUESTOES[indice];
  return <Cartao key={q.id} q={q} onOutra={onOutra} />;
}

function Cartao({ q, onOutra }: { q: QuestaoDemo; onOutra: () => void }) {
  const [escolha, setEscolha] = useState<string | null>(null);
  const [respondida, setRespondida] = useState(false);
  const acertou = respondida && escolha === q.correta;

  return (
    <article
      className="troca card card-raised overflow-hidden rounded-[1.25rem]"
      aria-label={`${q.prova}, questão ${q.numero}`}
    >
      <div className="flex items-start gap-3.5 p-5 lg:pb-4">
        <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_FUNDO[q.area]}`} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.8rem]">
            <span className={`font-semibold ${AREA_TEXTO[q.area]}`}>{q.materia}</span>
            <span className="font-data rounded-lg bg-surface-2 px-2 py-0.5 tracking-tight text-muted">
              {q.prova} · {q.numero}
            </span>
          </p>
          {q.enunciado.map((p) => (
            <p key={p} className="mt-2.5 text-[0.95rem] leading-relaxed">
              {p}
            </p>
          ))}
          {q.fonte && <p className="mt-1.5 text-xs leading-snug text-muted">{q.fonte}</p>}
          <p className="mt-2.5 text-[0.95rem] leading-relaxed font-semibold">{q.comando}</p>
        </div>
      </div>

      <div className="space-y-1.5 px-5 pb-5">
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
              className={`aperta flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[0.92rem] disabled:cursor-default ${estado}`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-lg text-[0.8rem] font-semibold ${
                  escolhida && !respondida ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
                }`}
              >
                {alt.letra}
              </span>
              <span className="min-w-0 flex-1">{alt.texto}</span>
              {certa && (
                <>
                  <Check size={18} weight="bold" className="shrink-0 text-success" />
                  <span className="sr-only">(resposta correta)</span>
                </>
              )}
              {errada && (
                <>
                  <X size={18} weight="bold" className="shrink-0 text-danger" />
                  <span className="sr-only">(sua resposta)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {respondida ? (acertou ? 'Você acertou!' : `Não foi dessa vez. A resposta certa é a ${q.correta}.`) : ''}
      </p>

      {respondida ? (
        <div
          className={`animate-rise border-t px-5 py-4 ${
            acertou ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
          }`}
        >
          <p className={`font-semibold ${acertou ? 'text-success' : 'text-danger'}`}>
            {acertou ? 'Você acertou!' : `Não foi dessa vez. A certa é a ${q.correta}.`}
          </p>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed">{q.resolucao}</p>
          {/* O que o app faria com esta resposta: XP (POINTS em common/gamification.ts)
              e a revisão espaçada do assunto. */}
          <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
            <span className="font-data font-medium text-brand">{acertou ? '+10 XP' : '+2 XP'}</span>{' '}
            {acertou
              ? 'no app, e cada acerto seguido afasta a próxima revisão deste assunto.'
              : 'no app (errar também é estudar), e o assunto volta na sua revisão de amanhã.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onOutra} className="btn btn-ghost aperta bg-surface">
              <ArrowsClockwise size={16} />
              Outra questão
            </button>
            <a href={APP_URL} className="btn btn-primary aperta">
              Continuar no app
              <ArrowRight size={16} weight="bold" />
            </a>
          </div>
        </div>
      ) : (
        <div className="border-t border-line px-5 py-4">
          <button
            type="button"
            disabled={!escolha}
            onClick={() => setRespondida(true)}
            className={`btn aperta w-full py-3 text-base ${
              escolha ? 'btn-primary' : 'border-line bg-surface-2 text-muted disabled:opacity-100'
            }`}
          >
            {escolha ? 'Responder' : 'Escolha uma alternativa'}
          </button>
        </div>
      )}
    </article>
  );
}
