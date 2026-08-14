// Tipos mínimos do custom element <math-field> (MathLive). O elemento é registrado
// em runtime quando `mathlive` é importado; aqui só damos forma ao JSX. No React 19
// o namespace `JSX` vive dentro de `React` (não mais global), por isso usamos
// module augmentation de 'react'.
import type React from 'react';

export interface MathFieldElement extends HTMLElement {
  value?: string;
  setValue?: (v: string, options?: { silenceNotifications?: boolean }) => void;
  executeCommand?: (command: string, ...args: unknown[]) => unknown;
  focus?: () => void;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathFieldElement>,
        MathFieldElement
      >;
    }
  }
}