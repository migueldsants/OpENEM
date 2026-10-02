/**
 * Largura máxima da área de conteúdo, por tipo de tela.
 *
 * - Leitura (padrão): enunciado e formulários pedem linha curta.
 * - Painel: telas de cartões e gráficos aproveitam monitor largo e se dividem
 *   em duas colunas a partir do `xl` (cada uma decide onde).
 * - Grade: o cronograma é uma grade de 7 dias, e 768px espremem as colunas.
 */
export type ContentWidth = 'leitura' | 'painel' | 'grade';

const PAINEL = new Set([
  '/',
  '/painel',
  '/desempenho',
  '/progresso',
  '/conquistas',
]);

export function contentWidth(pathname: string): ContentWidth {
  if (pathname === '/cronograma') return 'grade';
  if (PAINEL.has(pathname)) return 'painel';
  return 'leitura';
}

export const CONTENT_MAX_W: Record<ContentWidth, string> = {
  leitura: 'max-w-3xl xl:max-w-4xl 2xl:max-w-5xl',
  painel: 'max-w-3xl xl:max-w-5xl 2xl:max-w-7xl',
  grade: 'max-w-[1700px]',
};
