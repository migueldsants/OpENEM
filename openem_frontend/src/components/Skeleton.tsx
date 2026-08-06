import type { CSSProperties } from 'react';

/** Placeholder animado para estados de carregamento (substitui "Carregando…"). */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** Bloco de texto skeleton com largura relativa (default 60%). */
export function SkeletonText({
  width = '60%',
  className = '',
}: {
  width?: string;
  className?: string;
}) {
  return (
    <Skeleton
      className={className}
      style={{ width, height: '0.85rem', borderRadius: '0.4rem' }}
    />
  );
}

/** Card skeleton completo: cabeçalho + linhas de texto (para listas/cards). */
export function SkeletonCard({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonText width="40%" />
          <SkeletonText width="70%" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText key={i} width={i === lines - 1 ? '50%' : '90%'} />
        ))}
      </div>
    </div>
  );
}