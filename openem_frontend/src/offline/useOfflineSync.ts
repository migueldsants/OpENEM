import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    try {
      setPending(await countPending());
    } catch {
      setPending(0);
    }
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return 0;
    setSyncing(true);
    try {
      const synced = await syncPending();
      await refresh();
      if (synced > 0) {
        window.dispatchEvent(
          new CustomEvent('openem:synced', { detail: synced }),
        );
      }
      return synced;
    } finally {
      setSyncing(false);
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