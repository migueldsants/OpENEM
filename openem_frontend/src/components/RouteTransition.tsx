import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reanima o conteúdo a cada navegação: a `key` no pathname força remontagem,
 * disparando a animação de entrada (`animate-route`). Entrada apenas — leve.
 * Sob "reduzir movimento", o CSS já zera a animação.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-route">
      {children}
    </div>
  );
}
