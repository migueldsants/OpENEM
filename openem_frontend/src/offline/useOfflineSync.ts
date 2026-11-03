import { useCallback, useEffect, useRef, useState } from 'react';
import { countPending, syncPending } from './queue';

/**
 * Estado offline + sincronização da fila (issue #42):
 * - online/offline reativo (navigator.onLine + eventos);
 * - nº de ações pendentes no IndexedDB;
 * - sync automático ao reconectar e ao montar (app reaberto).
 * Após sincronizar, emite `openem:synced` para telas recarregarem dados.
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // A fila no IndexedDB pode responder depois de o componente sair da tela.
  // Aí nada de setState: o React consulta `window` mesmo num componente
  // desmontado, e nos testes o jsdom já foi desligado (ReferenceError).
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    let total: number;
    try {
      total = await countPending();
    } catch {
      total = 0;
    }
    if (montado.current) setPending(total);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return 0;
    setSyncing(true);
    try {
      const synced = await syncPending();
      await refresh();
      if (synced > 0 && montado.current) {
        window.dispatchEvent(
          new CustomEvent('openem:synced', { detail: synced }),
        );
      }
      return synced;
    } finally {
      if (montado.current) setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      await sync();
      await refresh();
    })();
  }, [sync]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [sync]);

  return { online, pending, syncing, sync };
}