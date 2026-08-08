// Render de fórmula via KaTeX (lazy — só carrega no editor). Usado como
// `renderFormula` no BoardSVG do editor e nos thumbnails... não: thumbnails
// usam texto simples para não puxar KaTeX no chunk principal.

import { useEffect, useState } from 'react';

export function Katex({ latex }: { latex: string }) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    import('katex')
      .then(({ default: katex }) => {
        if (cancelled) return;
        try {
          setHtml(
            katex.renderToString(latex, { throwOnError: false, displayMode: false }),
          );
        } catch {
          setHtml(`<span style="font-family:monospace">${escapeHtml(latex)}</span>`);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(`<span style="font-family:monospace">${escapeHtml(latex)}</span>`);
      });
    return () => {
      cancelled = true;
    };
  }, [latex]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}