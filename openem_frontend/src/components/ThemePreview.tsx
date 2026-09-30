import type { CSSProperties } from 'react';
import { tokensStyle } from '../theme-custom';
import type { ThemeVariant } from '../theme';

/**
 * Miniatura de um tema: sidebar, cartão com título e texto, botão da marca e
 * as cores das áreas. Os temas prontos entram por `data-theme` (os seletores
 * de themes.css valem em qualquer elemento e as variáveis descem por
 * herança); os personalizados, por variáveis inline. Decorativa: quem usa
 * põe o nome do tema no botão em volta.
 */
export function ThemePreview({
  theme,
  tokens,
  variant = 'light',
  className = '',
}: {
  /** Tema pronto, ex.: 'cyberpunk-dark'. */
  theme?: string;
  /** Cores de um tema personalizado (um lado). */
  tokens?: Record<string, string>;
  /** Lado do personalizado (define as cores das áreas e a sombra). */
  variant?: ThemeVariant;
  className?: string;
}) {
  const dataTheme = theme ?? `custom-${variant}`;
  const style = (tokens ? tokensStyle(tokens) : undefined) as CSSProperties | undefined;
  return (
    <div
      data-theme={dataTheme}
      style={style}
      aria-hidden
      className={`flex h-24 overflow-hidden rounded-xl border border-line bg-bg text-fg ${className}`}
    >
      <div className="flex w-5 shrink-0 flex-col items-center gap-1.5 bg-sidebar pt-2.5">
        <span className="size-2 rounded-full bg-brand" />
        <span className="h-1 w-2.5 rounded-full bg-muted/50" />
        <span className="h-1 w-2.5 rounded-full bg-muted/50" />
      </div>
      <div className="min-w-0 flex-1 p-2">
        <div className="rounded-lg border border-line bg-surface p-2 shadow-[var(--shadow)]">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[11px] leading-none font-bold">Aa</span>
            <span className="h-1.5 w-10 rounded-full bg-fg/80" />
          </div>
          <span className="mt-1.5 block h-1 w-16 rounded-full bg-muted/70" />
          <div className="mt-2 flex items-center gap-1">
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-[8px] leading-none font-bold text-brand-ink">
              OK
            </span>
            <span className="size-1.5 rounded-full bg-mat" />
            <span className="size-1.5 rounded-full bg-nat" />
            <span className="size-1.5 rounded-full bg-hum" />
            <span className="size-1.5 rounded-full bg-lin" />
          </div>
        </div>
        <span className="mt-1.5 block h-1.5 rounded-full bg-gradient-to-r from-brand to-brand-2" />
      </div>
    </div>
  );
}
