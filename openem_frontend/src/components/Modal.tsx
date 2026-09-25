import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza no `document.body`. Todo overlay com `position: fixed` passa por
 * aqui: dentro da página, qualquer ancestral com `transform` (a animação de
 * troca de rota, um card com hover) vira o bloco de contenção do `fixed` e o
 * scrim cobre só aquele retângulo em vez da tela inteira.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Diálogos abertos, na ordem em que abriram. O "de cima" é o que contém o
 * foco; sem foco em nenhum, o último aberto. (Com dois montados juntos, o
 * filho registra antes do pai, então a ordem sozinha não basta.)
 */
const stack: RefObject<HTMLElement | null>[] = [];

function topo(): RefObject<HTMLElement | null> | undefined {
  const foco = document.activeElement;
  return (
    stack.find((r) => r.current?.contains(foco)) ?? stack[stack.length - 1]
  );
}

/**
 * Comportamento de diálogo modal: Esc fecha, o Tab fica preso dentro de
 * `ref`, o foco entra no painel ao abrir e volta para quem abriu ao fechar,
 * e a página de trás não rola. `active` liga e desliga sem desmontar (para
 * componentes que ficam montados e só se escondem).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  active = true,
) {
  // Guarda o onClose mais recente sem reinstalar os listeners a cada render
  // (pais costumam passar arrow functions novas).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Só puxa o foco se ele não estiver já dentro de outro diálogo aberto
    // (um diálogo filho montado junto já o levou para si).
    const panel = ref.current;
    const focoEmDialogo = stack.some((r) =>
      r.current?.contains(document.activeElement),
    );
    stack.push(ref);
    if (panel && !panel.contains(document.activeElement) && !focoEmDialogo) {
      const first = panel.querySelector<HTMLElement>('[autofocus]');
      (first ?? panel).focus({ preventScroll: true });
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (topo() !== ref) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(
        ref.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const atual = document.activeElement;
      if (e.shiftKey && (atual === first || atual === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && atual === last) {
        e.preventDefault();
        first.focus();
      } else if (!ref.current.contains(atual)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(ref), 1);
      document.body.style.overflow = prevOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
