import { Info, Warning } from '@phosphor-icons/react';
import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ancora } from './conteudo';

function texto(no: ReactNode): string {
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(texto).join('');
  if (isValidElement<{ children?: ReactNode }>(no)) return texto(no.props.children);
  return '';
}

/** Blockquote que começa com **Atenção:** vira aviso; o resto, dica. */
function Destaque({ children }: { children?: ReactNode }) {
  const atencao = /^\s*atenção/i.test(texto(Children.toArray(children)[0] ?? children));
  const Icone = atencao ? Warning : Info;
  return (
    <aside
      className={`my-6 flex gap-3 rounded-2xl border px-4 py-3.5 text-[0.95rem] leading-relaxed ${
        atencao ? 'border-warning/35 bg-warning/8' : 'border-brand/25 bg-brand/6'
      }`}
    >
      <Icone size={20} className={`mt-0.5 shrink-0 ${atencao ? 'text-warning' : 'text-brand'}`} />
      <div className="min-w-0 [&>p]:m-0 [&>p+p]:mt-2">{children}</div>
    </aside>
  );
}

const componentes: Components = {
  h2: ({ children }) => (
    <h2
      id={ancora(texto(children))}
      className="mt-12 mb-3 scroll-mt-24 font-display text-2xl leading-tight font-bold tracking-tight text-balance"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={ancora(texto(children))} className="mt-8 mb-2 scroll-mt-24 text-lg font-semibold">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-4 leading-[1.75]">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-brand underline decoration-brand/35 underline-offset-[3px] hover:decoration-brand"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-muted">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:font-data marker:text-muted">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-[1.7]">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  blockquote: ({ children }) => <Destaque>{children}</Destaque>,
  hr: () => <hr className="my-10 border-line" />,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-line">
      <table className="w-full border-collapse text-left text-[0.9rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2 text-muted">{children}</thead>,
  th: ({ children }) => <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="border-t border-line px-3.5 py-2.5 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-5 overflow-x-auto rounded-2xl border border-line bg-surface-2 p-4 font-mono text-[0.85rem] leading-relaxed [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em]">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
      {children}
    </ReactMarkdown>
  );
}
