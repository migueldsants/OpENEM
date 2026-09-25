import { useEffect } from 'react';

/**
 * Avisa que há uma barra fixa no rodapé da página (ex.: "Responder/Próxima"
 * em Questões). Enquanto montado, `--dock` guarda a altura dela e o que
 * também flutua embaixo (o Pomodoro) sobe o mesmo tanto em vez de cobri-la.
 */
export function DockOffset({ height = '4.5rem' }: { height?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--dock', height);
    return () => {
      root.style.removeProperty('--dock');
    };
  }, [height]);
  return null;
}
