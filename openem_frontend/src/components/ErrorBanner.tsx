import { IconAlert } from './icons';

/**
 * Banner de erro padrão (issue #49): substitui o padrão
 * `<p className="rounded-lg bg-red/10 ...">{error}</p>` duplicado ~20×.
 */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg bg-red/10 px-3 py-2 text-sm text-red"
    >
      <span className="flex min-w-0 items-center gap-2">
        <IconAlert width={16} height={16} className="shrink-0" aria-hidden />
        <span className="truncate">{message}</span>
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red transition-colors hover:bg-red/10"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}