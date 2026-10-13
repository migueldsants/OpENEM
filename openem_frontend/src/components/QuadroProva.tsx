import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconExpand, IconTimer } from './icons';
import { Portal, useDialog } from './Modal';
import { fmtClock } from '../lib/pomodoro';
import {
  avisos,
  clampSessao,
  DURACOES,
  estadoDoQuadro,
  fmtHora,
  fmtMarca,
  INTERVALOS,
  lerSessao,
  marcas,
  MAX_DURACAO,
  MIN_DURACAO,
  type QuadroSessao,
} from '../lib/quadro-prova';
import { chime } from '../sound';

const STORAGE_KEY = 'openem.quadro-prova';

function carregar(): QuadroSessao | null {
  try {
    return lerSessao(localStorage.getItem(STORAGE_KEY), Date.now());
  } catch {
    return null;
  }
}

function salvar(s: QuadroSessao | null): void {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem armazenamento o quadro ainda funciona, só não sobrevive ao reload */
  }
}

/**
 * Segura a tela acesa enquanto o quadro está aberto: são horas de prova sem
 * ninguém tocar no aparelho. O navegador solta a trava quando a aba some,
 * então ela é pedida de novo ao voltar.
 */
function useTelaAcesa() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    let montado = true;
    const pedir = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((t) => {
          if (montado) trava = t;
          else void t.release();
        })
        .catch(() => {
          /* bateria fraca ou permissão negada: segue sem a trava */
        });
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      montado = false;
      document.removeEventListener('visibilitychange', pedir);
      void trava?.release();
    };
  }, []);
}

const GIZ = 'text-[#f4f1e6]';
const BOTAO =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-[#f4f1e6] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f1e6]';

/**
 * O quadro em tela cheia. As cores são fixas (lousa verde, giz) e não seguem
 * o tema do app: a ideia é parecer o quadro da sala, não uma tela do OpENEM.
 */
function Quadro({
  sessao,
  onMinimizar,
  onEncerrar,
}: {
  sessao: QuadroSessao;
  onMinimizar: () => void;
  onEncerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [relogio, setRelogio] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  useDialog(ref, onMinimizar);
  useTelaAcesa();

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 5000);
    return () => clearTimeout(t);
  }, [confirmando]);

  const estado = estadoDoQuadro(sessao, agora);
  const lista = marcas(sessao.durationMin, sessao.intervalMin);
  const fim = sessao.startedAt + sessao.durationMin * 60_000;
  const proxima = lista[estado.apagadas + 1];
  const proximaEm =
    proxima != null
      ? sessao.startedAt + (sessao.durationMin - proxima) * 60_000
      : fim;

  // Toca só na virada: reabrir um quadro que já acabou não apita de novo.
  const tocou = useRef(estado.encerrado);
  useEffect(() => {
    if (estado.encerrado && !tocou.current) {
      tocou.current = true;
      chime(true);
    }
  }, [estado.encerrado]);

  function telaCheia() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen?.().catch(() => {});
  }

  function minimizar() {
    if (document.fullscreenElement) void document.exitFullscreen();
    onMinimizar();
  }

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Quadro da sala"
        tabIndex={-1}
        className={`fixed inset-0 z-[70] flex flex-col overflow-y-auto border-[10px] border-[#5b3d22] bg-[#17352b] bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.07),transparent_55%),radial-gradient(ellipse_at_75%_80%,rgba(255,255,255,0.05),transparent_50%)] outline-none ${GIZ}`}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-[4vh] px-5 py-6 text-center">
          <dl className="flex flex-wrap items-end justify-center gap-x-[8vw] gap-y-3 font-display">
            <div>
              <dt className="text-xs font-semibold tracking-[0.2em] text-[#f4f1e6]/60 uppercase sm:text-sm">
                Início
              </dt>
              <dd className="text-[clamp(1.75rem,5vw,3.5rem)] leading-tight font-bold tabular-nums">
                {fmtHora(sessao.startedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.2em] text-[#f4f1e6]/60 uppercase sm:text-sm">
                Término
              </dt>
              <dd className="text-[clamp(1.75rem,5vw,3.5rem)] leading-tight font-bold tabular-nums">
                {fmtHora(fim)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#f4f1e6]/60 uppercase sm:text-sm">
              {estado.encerrado ? 'Fim de prova' : 'Tempo restante'}
            </p>
            <p className="font-display text-[clamp(3.5rem,17vw,11rem)] leading-none font-extrabold tabular-nums">
              {estado.marcaAtual != null
                ? fmtMarca(estado.marcaAtual)
                : 'Tempo esgotado'}
            </p>
            <p className="mt-2 text-sm text-[#f4f1e6]/70 sm:text-base">
              {estado.encerrado
                ? 'Caneta na mesa. Hora de conferir o gabarito.'
                : `Atualizado às ${fmtHora(estado.atualizadoEm)} · próxima atualização às ${fmtHora(proximaEm)}`}
            </p>
            {/* Leitores de tela ouvem só a troca de marca, não cada segundo. */}
            <p role="status" className="sr-only">
              {estado.marcaAtual != null
                ? `Tempo restante: ${fmtMarca(estado.marcaAtual)}`
                : 'Tempo esgotado'}
            </p>
          </div>

          {/* As marcas que o fiscal escreveu no início e vai apagando. */}
          <ul
            aria-hidden="true"
            className="flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 font-display text-[clamp(1rem,2.6vw,1.75rem)] font-bold tabular-nums"
          >
            {lista.map((m, i) => {
              const apagada = i < estado.apagadas;
              const atual = i === estado.apagadas;
              return (
                <li
                  key={m}
                  data-apagada={apagada}
                  className={`rounded-full px-3 py-0.5 transition-all duration-1000 motion-reduce:transition-none ${
                    apagada
                      ? 'bg-white/[0.07] text-[#f4f1e6]/10 blur-[1.5px]'
                      : atual
                        ? 'ring-2 ring-[#f4f1e6]/80'
                        : 'text-[#f4f1e6]/55'
                  }`}
                >
                  {fmtMarca(m)}
                </li>
              );
            })}
          </ul>

          {avisos(sessao, agora).length > 0 && (
            <ul className="space-y-1 text-sm sm:text-base">
              {avisos(sessao, agora).map((a) => (
                <li
                  key={a.key}
                  className={`flex items-center justify-center gap-2 ${
                    a.liberado ? '' : 'text-[#f4f1e6]/70'
                  }`}
                >
                  {a.liberado && <IconCheck width={16} height={16} />}
                  {a.texto}:{' '}
                  {a.liberado
                    ? 'liberado'
                    : `a partir das ${fmtHora(a.em)}`}
                </li>
              ))}
            </ul>
          )}

          {relogio && !estado.encerrado && (
            <p className="font-data text-lg text-[#f4f1e6]/80 tabular-nums">
              {fmtClock(estado.restanteSec)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-4">
          <button type="button" onClick={minimizar} className={BOTAO}>
            Minimizar
          </button>
          {document.fullscreenEnabled && (
            <button type="button" onClick={telaCheia} className={BOTAO}>
              <IconExpand width={14} height={14} /> Tela cheia
            </button>
          )}
          {!estado.encerrado && (
            <button
              type="button"
              onClick={() => setRelogio((v) => !v)}
              aria-pressed={relogio}
              className={BOTAO}
            >
              {relogio ? 'Esconder relógio' : 'Mostrar relógio'}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              estado.encerrado || confirmando
                ? onEncerrar()
                : setConfirmando(true)
            }
            className={BOTAO}
          >
            {estado.encerrado
              ? 'Fechar quadro'
              : confirmando
                ? 'Encerrar mesmo?'
                : 'Encerrar prova'}
          </button>
        </div>
      </div>
    </Portal>
  );
}

/**
 * Card da lista de simulados: configura e abre o quadro da sala para quem vai
 * fazer a prova impressa. A sessão fica no localStorage — o horário de término
 * não muda se a página recarregar no meio da prova.
 */
export function QuadroProvaCard() {
  const [sessao, setSessao] = useState<QuadroSessao | null>(carregar);
  const [aberto, setAberto] = useState(false);
  const [duracao, setDuracao] = useState(DURACOES[0].min);
  const [outra, setOutra] = useState(false);
  const [intervalo, setIntervalo] = useState(30);

  function comecar() {
    const nova = clampSessao({
      startedAt: Date.now(),
      durationMin: duracao,
      intervalMin: intervalo,
    });
    salvar(nova);
    setSessao(nova);
    setAberto(true);
  }

  function encerrar() {
    if (document.fullscreenElement) void document.exitFullscreen();
    salvar(null);
    setSessao(null);
    setAberto(false);
  }

  return (
    <div className="card card-raised p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          <IconTimer width={20} height={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Quadro da sala</p>
          <p className="mt-0.5 text-xs text-muted">
            Imprimiu o caderno? Deixe esta tela à vista no lugar do relógio: ela
            mostra início, término e o tempo restante, que vai sendo apagado
            como o fiscal faz no quadro.
          </p>
        </div>
      </div>

      {sessao ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <p className="min-w-0 flex-1 text-sm">
            Quadro ativo · das {fmtHora(sessao.startedAt)} às{' '}
            {fmtHora(sessao.startedAt + sessao.durationMin * 60_000)}
          </p>
          <button onClick={encerrar} className="btn btn-ghost">
            Encerrar
          </button>
          <button onClick={() => setAberto(true)} className="btn btn-primary">
            Abrir quadro
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div>
            <p className="text-xs font-semibold text-muted">Tempo de prova</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {DURACOES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setOutra(false);
                    setDuracao(d.min);
                  }}
                  data-active={!outra && duracao === d.min}
                  aria-pressed={!outra && duracao === d.min}
                  className="chip"
                >
                  {d.label} · {fmtMarca(d.min)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOutra(true)}
                data-active={outra}
                aria-pressed={outra}
                className="chip"
              >
                Outro
              </button>
              {outra && (
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label="Tempo de prova em minutos"
                    min={MIN_DURACAO}
                    max={MAX_DURACAO}
                    value={duracao}
                    onChange={(e) => setDuracao(Number(e.target.value))}
                    className="input w-20 text-center font-data tabular-nums"
                  />
                  <span className="text-xs text-muted">min</span>
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted">
              Atualizar o quadro a cada
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {INTERVALOS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntervalo(i)}
                  data-active={intervalo === i}
                  aria-pressed={intervalo === i}
                  className="chip"
                >
                  {fmtMarca(i)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={comecar} className="btn btn-primary">
            Começar prova
          </button>
        </div>
      )}

      {sessao && aberto && (
        <Quadro
          sessao={sessao}
          onMinimizar={() => setAberto(false)}
          onEncerrar={encerrar}
        />
      )}
    </div>
  );
}
