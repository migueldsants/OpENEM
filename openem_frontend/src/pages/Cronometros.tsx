import { useEffect, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import {
  IconHourglass,
  IconPause,
  IconPlay,
  IconPlus,
  IconTimer,
  IconTrash,
} from '../components/icons';
import {
  decorridoMs,
  duracaoDe,
  fimEm,
  fmtCronometro,
  fmtDuracao,
  fmtTimer,
  iniciar,
  marcarVolta,
  MAX_NOME,
  MAX_RELOGIOS,
  nomeLimpo,
  novoCronometro,
  novoTimer,
  parciais,
  pausar,
  PRESETS_TIMER_MIN,
  restanteMs,
  rodando,
  terminou,
  zerar,
  type Relogio,
} from '../lib/relogios';
import { relogios, useRelogios } from '../relogios';

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formulário de um timer novo: nome opcional, minutos, segundos e atalhos. */
function NovoTimer({
  onCriar,
  onCancelar,
}: {
  onCriar: (nome: string, duracaoMs: number) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [min, setMin] = useState('5');
  const [seg, setSeg] = useState('0');
  const vazio = Number(min) * 60 + Number(seg) <= 0;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!vazio) onCriar(nome, duracaoDe(min, seg));
  }

  return (
    <form onSubmit={enviar} className="card card-raised space-y-4 p-4">
      <p className="font-display text-sm font-bold">Novo timer</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS_TIMER_MIN.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setMin(String(p));
              setSeg('0');
            }}
            data-active={Number(min) === p && Number(seg) === 0}
            className="chip"
          >
            {fmtDuracao(p * 60_000)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-muted">Minutos</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="input mt-1 block w-24 text-center font-data tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">Segundos</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={seg}
            onChange={(e) => setSeg(e.target.value)}
            className="input mt-1 block w-24 text-center font-data tabular-nums"
          />
        </label>
        <label className="block min-w-40 flex-1">
          <span className="text-xs font-semibold text-muted">
            Nome (opcional)
          </span>
          <input
            type="text"
            maxLength={MAX_NOME}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Redação, intervalo"
            className="input mt-1 block w-full"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={vazio} className="btn btn-primary">
          Criar timer
        </button>
        <button type="button" onClick={onCancelar} className="btn btn-ghost">
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Um cronômetro ou timer: visor, controles e, no cronômetro, as voltas. */
function CartaoRelogio({ r, agora }: { r: Relogio; agora: number }) {
  const ehTimer = r.tipo === 'timer';
  const correndo = rodando(r, agora);
  const acabou = terminou(r, agora);
  const decorrido = decorridoMs(r, agora);
  const comecou = decorrido > 0 || r.rodandoDesde != null;
  const voltas = parciais(r.voltas);
  const fim = correndo ? fimEm(r) : null;

  return (
    <li
      className={`card card-raised flex flex-col p-4 ${
        acabou ? 'border-brand' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          {ehTimer ? (
            <IconHourglass width={16} height={16} />
          ) : (
            <IconTimer width={16} height={16} />
          )}
        </span>
        <input
          type="text"
          aria-label={`Nome de ${r.nome}`}
          maxLength={MAX_NOME}
          value={r.nome}
          onChange={(e) =>
            relogios.atualizar(r.id, (x) => ({ ...x, nome: e.target.value }))
          }
          onBlur={(e) =>
            relogios.atualizar(r.id, (x) => ({
              ...x,
              nome: nomeLimpo(
                e.target.value,
                ehTimer ? 'Timer' : 'Cronômetro',
              ),
            }))
          }
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
        />
        <button
          type="button"
          onClick={() => relogios.remover(r.id)}
          aria-label={`Remover ${r.nome}`}
          className="btn btn-ghost px-2 py-1"
        >
          <IconTrash width={14} height={14} />
        </button>
      </div>

      <p
        role="timer"
        aria-label={r.nome}
        className={`mt-3 text-center font-data text-5xl font-bold tabular-nums ${
          acabou ? 'text-brand' : ''
        }`}
      >
        {ehTimer ? fmtTimer(restanteMs(r, agora)) : fmtCronometro(decorrido)}
      </p>

      {ehTimer && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{
                width: `${(decorrido / (r.duracaoMs ?? 1)) * 100}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs text-muted">
            {acabou
              ? 'Tempo esgotado'
              : fim != null
                ? `Termina às ${hhmm(fim)}`
                : `Timer de ${fmtDuracao(r.duracaoMs ?? 0)}`}
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {!acabou &&
          (correndo ? (
            <button
              type="button"
              onClick={() =>
                relogios.atualizar(r.id, (x) => pausar(x, Date.now()))
              }
              className="btn btn-primary"
            >
              <IconPause width={15} height={15} /> Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                relogios.atualizar(r.id, (x) => iniciar(x, Date.now()))
              }
              className="btn btn-primary"
            >
              <IconPlay width={15} height={15} filled />{' '}
              {comecou ? 'Retomar' : 'Iniciar'}
            </button>
          ))}
        {!ehTimer && correndo && (
          <button
            type="button"
            onClick={() =>
              relogios.atualizar(r.id, (x) => marcarVolta(x, Date.now()))
            }
            className="btn btn-ghost"
          >
            Volta
          </button>
        )}
        {comecou && (
          <button
            type="button"
            onClick={() => relogios.atualizar(r.id, zerar)}
            className="btn btn-ghost"
          >
            {acabou ? 'Reiniciar' : 'Zerar'}
          </button>
        )}
      </div>

      {voltas.length > 0 && (
        <ol
          aria-label={`Voltas de ${r.nome}`}
          className="mt-4 max-h-44 space-y-1 overflow-y-auto border-t border-line pt-3"
        >
          {[...voltas].reverse().map((v) => (
            <li
              key={v.numero}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-muted">Volta {v.numero}</span>
              <span className="font-data font-bold tabular-nums">
                {fmtCronometro(v.parcialMs)}
              </span>
              <span className="font-data text-muted tabular-nums">
                {fmtCronometro(v.totalMs)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

/**
 * Cronômetros e timers avulsos, quantos o aluno quiser ao mesmo tempo. Não é
 * o Pomodoro: nada aqui vira sessão de foco, minutos de estudo ou XP. A lista
 * mora em `src/relogios.ts`, então sair da tela não para nenhum relógio.
 */
export default function Cronometros() {
  const lista = useRelogios();
  const [agora, setAgora] = useState(() => Date.now());
  const [criandoTimer, setCriandoTimer] = useState(false);

  // Só gasta tique quando há algo correndo; décimos pedem um passo curto.
  const algumCorrendo = lista.some((r) => rodando(r, agora));
  useEffect(() => {
    if (!algumCorrendo) return;
    const id = setInterval(() => setAgora(Date.now()), 100);
    return () => clearInterval(id);
  }, [algumCorrendo]);

  // Uma ação (iniciar, zerar) muda a lista: acerta o "agora" na hora.
  useEffect(() => {
    setAgora(Date.now());
  }, [lista]);

  const cheio = lista.length >= MAX_RELOGIOS;
  const nCronometros = lista.filter((r) => r.tipo === 'cronometro').length;

  function criarCronometro() {
    relogios.adicionar(novoCronometro(novoId(), `Cronômetro ${nCronometros + 1}`));
  }

  function criarTimer(nome: string, duracaoMs: number) {
    relogios.adicionar(
      novoTimer(
        novoId(),
        nomeLimpo(nome, `Timer de ${fmtDuracao(duracaoMs)}`),
        duracaoMs,
      ),
    );
    setCriandoTimer(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relógios"
        title="Cronômetros e timers"
        subtitle="Marque quanto tempo você leva numa questão ou conte o tempo de uma redação. Dá para ter vários ao mesmo tempo, e eles continuam correndo se você sair desta tela."
        actions={
          <>
            <button
              type="button"
              onClick={criarCronometro}
              disabled={cheio}
              className="btn btn-primary"
            >
              <IconPlus width={14} height={14} /> Cronômetro
            </button>
            <button
              type="button"
              onClick={() => setCriandoTimer(true)}
              disabled={cheio}
              className="btn btn-ghost"
            >
              <IconPlus width={14} height={14} /> Timer
            </button>
          </>
        }
      />

      {cheio && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          Você chegou ao limite de {MAX_RELOGIOS} relógios. Remova um para
          criar outro.
        </p>
      )}

      {criandoTimer && !cheio && (
        <NovoTimer
          onCriar={criarTimer}
          onCancelar={() => setCriandoTimer(false)}
        />
      )}

      {lista.length === 0 ? (
        !criandoTimer && (
          <EmptyState
            icon={IconTimer}
            title="Nenhum relógio ainda"
            description="Crie um cronômetro para medir seu ritmo ou um timer para contar um tempo fixo."
            tip="No ENEM, a média é de uns 3 minutos por questão."
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lista.map((r) => (
            <CartaoRelogio key={r.id} r={r} agora={agora} />
          ))}
        </ul>
      )}
    </div>
  );
}
