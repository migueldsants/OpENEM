import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import {
  deveMostrar,
  gravarEstado,
  lerEstado,
  marcarMostrado,
  responder,
  sessaoDoToken,
  type Resposta,
} from '../lib/patrocinio';
import { SPONSOR_URL } from '../lib/site';
import { IconHeart, IconX } from './icons';
import { Portal, useDialog } from './Modal';

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Logins em que o convite já abriu nesta aba. Segura a regra quando o
 * `localStorage` falha ao gravar: sem isso, cada remontagem abriria de novo.
 */
const mostradoNaAba = new Set<string>();

/**
 * Convite para patrocinar o OpENEM pelo GitHub Sponsors. Abre ao entrar no
 * app, no máximo uma vez por login (`src/lib/patrocinio.ts`); o App só o monta
 * depois do onboarding e fora do modo sem distrações. `pausado` (simulado
 * correndo) adia a abertura sem gastar a vez.
 */
export function ConvitePatrocinio({ pausado = false }: { pausado?: boolean }) {
  const { token, me } = useAuth();
  const [aberto, setAberto] = useState(false);
  const sessao = sessaoDoToken(token);

  useEffect(() => {
    if (aberto || pausado || !me || !sessao || mostradoNaAba.has(sessao)) return;
    const estado = lerEstado(storage());
    const mostrar = deveMostrar({
      estado,
      sessao,
      agora: Date.now(),
      contaCriadaEm: Date.parse(me.createdAt),
    });
    if (!mostrar) return;
    mostradoNaAba.add(sessao);
    gravarEstado(storage(), marcarMostrado(estado, sessao));
    setAberto(true);
  }, [aberto, pausado, me, sessao]);

  if (!aberto) return null;
  return <Dialogo onResponder={() => setAberto(false)} />;
}

function Dialogo({ onResponder }: { onResponder: () => void }) {
  const painelRef = useRef<HTMLDivElement>(null);

  function fechar(resposta: Resposta) {
    const s = storage();
    gravarEstado(s, responder(lerEstado(s), resposta, Date.now()));
    onResponder();
  }

  useDialog(painelRef, () => fechar('fechar'));

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] animate-fade sm:items-center"
        onClick={() => fechar('fechar')}
      >
        <div
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="patrocinio-titulo"
          aria-describedby="patrocinio-texto"
          tabIndex={-1}
          className="card card-raised relative w-full max-w-md overflow-hidden outline-none animate-rise"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fechar('fechar')}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconX width={18} height={18} />
          </button>

          <div className="bg-brand/10 px-6 pb-5 pt-7">
            <div className="grid size-14 place-items-center rounded-2xl bg-brand text-brand-ink shadow-sm">
              <IconHeart width={28} height={28} weight="fill" />
            </div>
            <h2
              id="patrocinio-titulo"
              className="mt-4 pr-8 font-display text-2xl font-extrabold leading-tight tracking-tight"
            >
              Ajude a manter o OpENEM no ar
            </h2>
          </div>

          <div className="px-6 pb-6 pt-4">
            <div id="patrocinio-texto" className="space-y-2 text-sm leading-relaxed text-muted">
              <p>
                O OpENEM é gratuito, sem anúncios e de código aberto. O servidor, o
                domínio e o tempo de quem desenvolve são pagos por quem pode
                contribuir.
              </p>
              <p>
                Se o app tem ajudado nos seus estudos, considere patrocinar pelo
                GitHub Sponsors. Qualquer valor ajuda, e tudo continua de graça
                para todo mundo.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <a
                href={SPONSOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fechar('patrocinar')}
                className="btn btn-primary flex-1"
              >
                <IconHeart width={18} height={18} weight="fill" />
                Patrocinar no GitHub
              </a>
              <button
                type="button"
                onClick={() => fechar('agora-nao')}
                className="btn btn-ghost"
              >
                Agora não
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              O GitHub Sponsors abre numa aba nova.
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
