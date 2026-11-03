import { useEffect, useState, type RefObject } from 'react';

/**
 * Entrada das seções ao rolar. O HTML pré-renderizado já vem no estado final:
 * sem JavaScript, com movimento reduzido ou sem IntersectionObserver, nada
 * fica escondido. Com tudo isso disponível, só o que ainda está abaixo da
 * dobra passa a `data-estado="espera"` (fora da tela, então não pisca) e volta
 * ao estado final quando entra na tela. As peças que se mexem são classes
 * `rv-*` dentro do bloco marcado com `data-revela` (ver styles.css).
 */
export function podeAnimar(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof IntersectionObserver !== 'undefined' &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Abaixo da dobra: o topo ainda não apareceu. */
function abaixoDaDobra(el: Element): boolean {
  return el.getBoundingClientRect().top > window.innerHeight;
}

const OPCOES: IntersectionObserverInit = { rootMargin: '0px 0px -12% 0px', threshold: 0 };

export function useRevelar(raiz: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = raiz.current;
    if (!el || !podeAnimar()) return;
    const blocos = [...el.querySelectorAll<HTMLElement>('[data-revela]')].filter(abaixoDaDobra);
    if (blocos.length === 0) return;
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.estado = 'visto';
        obs.unobserve(e.target);
      }
    }, OPCOES);
    for (const b of blocos) {
      b.dataset.estado = 'espera';
      obs.observe(b);
    }
    return () => {
      obs.disconnect();
      for (const b of blocos) delete b.dataset.estado;
    };
  }, [raiz]);
}

/**
 * Para animações de um componente só (contador, lousa). Os dois são false no
 * servidor, na hidratação e quando não vai animar (estado final). `espera`:
 * o bloco está abaixo da dobra e vai animar quando aparecer; `apareceu`: ele
 * entrou na tela agora.
 */
export function useAoAparecer(alvo: RefObject<HTMLElement | null>): { espera: boolean; apareceu: boolean } {
  const [estado, setEstado] = useState<'final' | 'espera' | 'apareceu'>('final');
  useEffect(() => {
    const el = alvo.current;
    if (!el || !podeAnimar() || !abaixoDaDobra(el)) return;
    // Estado externo (posição na tela) lido depois da hidratação, de propósito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado('espera');
    const obs = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      setEstado('apareceu');
      obs.disconnect();
    }, OPCOES);
    obs.observe(el);
    return () => obs.disconnect();
  }, [alvo]);
  return { espera: estado === 'espera', apareceu: estado === 'apareceu' };
}
