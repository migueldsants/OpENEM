import { useOfflineSync } from '../offline/useOfflineSync';

/**
 * Indicador de status de conexão (issue #42): faixa fixa no topo quando
 * offline ou quando há ações enfileiradas aguardando sync.
 */
export function OfflineIndicator() {
  const { online, pending, syncing } = useOfflineSync();

  if (online && pending === 0 && !syncing) return null;

  const message = !online
    ? pending > 0
      ? `Você está offline — ${pending} ${
          pending === 1 ? 'ação pendente' : 'ações pendentes'
        } serão sincronizadas quando a conexão voltar.`
      : 'Você está offline — mostrando dados salvos.'
    : syncing
      ? 'Sincronizando suas ações…'
      : 'Conexão restaurada — tudo sincronizado.';

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-40 px-3 py-1.5 text-center text-xs font-medium ${
        online ? 'bg-nat text-white' : 'bg-hum text-fg'
      }`}
    >
      {message}
    </div>
  );
}