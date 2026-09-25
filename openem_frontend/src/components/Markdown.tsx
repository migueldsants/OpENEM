import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/**
 * Renderiza Markdown com LaTeX (KaTeX), tabelas e imagens.
 *
 * Usado nos flashcards e nos enunciados das questões oficiais do ENEM, que
 * trazem figuras, tabelas e fórmulas. As imagens vêm com largura original de
 * prova impressa: sem o `max-w-full` elas estouram o layout no celular, e sem
 * o `loading="lazy"` uma questão com três figuras consome dados que o aluno
 * pode nem usar — o público-alvo é majoritariamente móvel com internet
 * limitada.
 */
export function Markdown({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`flashcard-md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Imagem de prova sem descrição (`![](url)`) não pode sumir para o
          // leitor de tela: ao menos diz que ali há uma figura.
          img: ({ node: _node, alt, ...props }) => (
            <img
              {...props}
              alt={alt?.trim() ? alt : 'Imagem do enunciado'}
              loading="lazy"
              decoding="async"
              className="mx-auto my-3 h-auto max-w-full rounded-lg"
            />
          ),
          // Tabelas de prova são largas: rolam dentro da própria caixa em vez
          // de empurrar a página inteira para o lado.
          table: ({ node: _node, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table {...props} className="w-full text-left text-sm" />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
