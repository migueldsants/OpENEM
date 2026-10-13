import { useEffect } from 'react';
import { aTocar, proximoFim } from '../lib/relogios';
import { relogios, useRelogios } from '../relogios';
import { chime } from '../sound';

/**
 * Toca quando um timer da tela de cronômetros acaba. Fica montado no App, sem
 * desenhar nada, para o aviso sair em qualquer tela. Em vez de um tique por
 * segundo, agenda um único timeout para o próximo fim.
 */
export function TimerAlarme() {
  const lista = useRelogios();

  useEffect(() => {
    const vencidos = aTocar(lista, Date.now());
    if (vencidos.length > 0) {
      chime(true);
      // Muda a lista, e o efeito roda de novo para agendar o próximo.
      relogios.marcarTocados(vencidos.map((r) => r.id));
      return;
    }
    const fim = proximoFim(lista, Date.now());
    if (fim == null) return;
    const t = setTimeout(
      () => {
        const agora = aTocar(lista, Date.now());
        if (agora.length === 0) return;
        chime(true);
        relogios.marcarTocados(agora.map((r) => r.id));
      },
      Math.max(0, fim - Date.now()) + 20,
    );
    return () => clearTimeout(t);
  }, [lista]);

  return null;
}
