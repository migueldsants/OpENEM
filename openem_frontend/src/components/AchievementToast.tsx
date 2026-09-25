import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Achievement } from '../api';
import { AchievementIcon } from '../lib/achievement-icon';
import { IconX } from './icons';
import { Portal } from './Modal';

/*
 * Toasts de conquista (issue #48). Vivem num host global, fora da tela que
 * os disparou: antes ficavam dentro do card da questão e sumiam no meio ao
 * clicar em "Próxima". Ficam no topo, longe da barra de resposta, da tabbar e
 * do Pomodoro flutuante, que moram embaixo.
 */

const VISIVEL_MS = 4300;
const SAIDA_MS = 600;

let fila: Achievement[] = [];
const ouvintes = new Set<() => void>();
let hosts = 0;

function emitir() {
  for (const o of ouvintes) o();
}

/** Enfileira conquistas novas; a mesma conquista não aparece duas vezes. */
function anunciar(list: Achievement[]) {
  const novas = list.filter((a) => !fila.some((x) => x.code === a.code));
  if (novas.length === 0) return;
  fila = [...fila, ...novas];
  emitir();
}

function remover(code: string) {
  fila = fila.filter((a) => a.code !== code);
  emitir();
}

/** Esvazia a fila (a fila é do módulo: sem isto, um teste vaza no outro). */
// eslint-disable-next-line react-refresh/only-export-components
export function limparConquistas() {
  fila = [];
  emitir();
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

function Toast({ a }: { a: Achievement }) {
  const [saindo, setSaindo] = useState(false);
  const [pausado, setPausado] = useState(false);
  // Tempo que falta: pausar no hover/foco não pode zerar o relógio.
  const resta = useRef(VISIVEL_MS);

  useEffect(() => {
    if (pausado || saindo) return;
    const inicio = Date.now();
    const t = setTimeout(() => setSaindo(true), resta.current);
    return () => {
      clearTimeout(t);
      resta.current -= Date.now() - inicio;
    };
  }, [pausado, saindo]);

  useEffect(() => {
    if (!saindo) return;
    const t = setTimeout(() => remover(a.code), SAIDA_MS);
    return () => clearTimeout(t);
  }, [saindo, a.code]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`card pointer-events-auto flex items-center gap-3 border border-line bg-surface p-3 shadow-[var(--shadow)] transition-all duration-500 ${
        saindo
          ? '-translate-y-2 opacity-0'
          : 'translate-y-0 animate-[toast-in_.5s_ease-out]'
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
        <AchievementIcon name={a.icon} size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-brand">Conquista desbloqueada</p>
        <p className={`truncate font-display font-bold ${a.color}`}>{a.name}</p>
        <p className="truncate text-xs text-muted">{a.description}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-brand/12 px-2 py-1 text-xs font-bold text-brand">
        +{a.xp} XP
      </span>
      <button
        type="button"
        onClick={() => setSaindo(true)}
        aria-label="Fechar"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <IconX width={14} height={14} />
      </button>
    </div>
  );
}

/** Onde os toasts aparecem. Montado uma vez no App. */
export function AchievementToastHost() {
  const lista = useSyncExternalStore(assinar, () => fila);

  useEffect(() => {
    hosts++;
    return () => {
      hosts--;
    };
  }, []);

  if (lista.length === 0) return null;
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-4 top-3 z-50 flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-80">
        {lista.map((a) => (
          <div key={a.code} className="w-full sm:w-80">
            <Toast a={a} />
          </div>
        ))}
      </div>
    </Portal>
  );
}

/**
 * Dispara um toast por conquista desbloqueada. Com o host do App montado, só
 * anuncia; sozinho (ex.: num teste) traz o próprio host.
 */
export function AchievementToasts({ list }: { list: Achievement[] }) {
  const [sozinho] = useState(() => hosts === 0);

  useEffect(() => {
    if (list.length > 0) anunciar(list);
  }, [list]);

  return sozinho ? <AchievementToastHost /> : null;
}
