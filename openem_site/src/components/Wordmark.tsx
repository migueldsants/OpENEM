/** Mesmo wordmark do app (openem_frontend/src/App.tsx): "Op" + "ENEM" na marca. */
export function Wordmark({ href = '/', className = '' }: { href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`font-display text-xl font-extrabold tracking-tight text-fg ${className}`}
      aria-label="OpENEM, página inicial"
    >
      Op<span className="text-gradient">ENEM</span>
    </a>
  );
}
