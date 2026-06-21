import { useEffect, useRef, useState, type ReactNode } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Revela o conteúdo ao entrar na viewport (uma vez), com leve stagger via delay.
 * Respeita "reduzir movimento": nesse caso renderiza visível, sem observar.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'header';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(prefersReducedMotion());

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  const motion = prefersReducedMotion()
    ? ''
    : shown
      ? 'reveal-in'
      : 'reveal-hidden';

  return (
    <Tag
      ref={ref as never}
      className={`${motion} ${className}`}
      style={{ '--delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
