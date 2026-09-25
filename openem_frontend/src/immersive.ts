import { useEffect, useSyncExternalStore } from 'react';

/*
 * Modo imersivo: enquanto alguma tela pede (ex.: simulado com cronômetro
 * correndo), o App some com sidebar, barra superior e tabbar, como no "modo
 * sem distrações" do perfil, mas só durante aquela tarefa.
 */

let pedidos = 0;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const o of ouvintes) o();
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

/** A tela que chama fica em modo imersivo enquanto `ativo` e montada. */
export function useImmersive(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    pedidos++;
    emitir();
    return () => {
      pedidos--;
      emitir();
    };
  }, [ativo]);
}

/** Para o App: há alguma tela pedindo modo imersivo agora? */
export function useIsImmersive(): boolean {
  return useSyncExternalStore(assinar, () => pedidos > 0);
}
