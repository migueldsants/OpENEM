import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

/**
 * Renderiza Markdown com suporte a LaTeX (KaTeX) — usado nos flashcards.
 * Suporta: **negrito**, listas, `$inline$` e `$$block$$` (remark-math + KaTeX).
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`flashcard-md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
