import { useEffect, useRef } from 'react';
import { usaMovimentoReduzido, useCores } from './canvas';
import { desenharMiniatura } from './miniaturas';

/**
 * Um único laço de animação para todas as miniaturas da lista, a ~30 quadros
 * por segundo: 21 canvas rodando juntos não podem pesar no celular barato.
 * Só desenha quem está na tela (IntersectionObserver).
 */
const assinantes = new Set<(t: number) => void>();
let raf = 0;
let ultimo = 0;

function laco(agora: number) {
  raf = requestAnimationFrame(laco);
  if (agora - ultimo < 32) return;
  ultimo = agora;
  const t = agora / 1000;
  assinantes.forEach((f) => f(t));
}

function assinar(f: (t: number) => void) {
  assinantes.add(f);
  if (!raf) raf = requestAnimationFrame(laco);
  return () => {
    assinantes.delete(f);
    if (!assinantes.size && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

/** Instante do retrato parado (movimento reduzido): um quadro que diz o que é. */
const T_PARADO = 1.9;

export function Miniatura({
  slug,
  rotulo,
  ativa = true,
}: {
  slug: string;
  rotulo: string;
  /** false congela no retrato (ex.: cartão fora do filtro). */
  ativa?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cores = useCores();
  const coresRef = useRef(cores);
  useEffect(() => {
    coresRef.current = cores;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const desenhar = (t: number) => {
      if (!w || !h) return;
      const c = coresRef.current;
      ctx!.clearRect(0, 0, w, h);
      ctx!.save();
      desenharMiniatura(slug, ctx!, w, h, t, {
        fg: c.fg, muted: c.muted, line: c.line, surface: c.surface,
        brand: c.brand, mat: c.mat, nat: c.nat, hum: c.hum, lin: c.lin, danger: c.danger,
        escuro: c.escuro,
      });
      ctx!.restore();
    };
    const medir = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      desenhar(T_PARADO);
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(canvas);
    if (!ativa || usaMovimentoReduzido() || typeof IntersectionObserver === 'undefined') {
      return () => ro?.disconnect();
    }
    let sair: (() => void) | null = null;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !sair) sair = assinar(desenhar);
      else if (!e.isIntersecting && sair) {
        sair();
        sair = null;
      }
    });
    io.observe(canvas);
    return () => {
      io.disconnect();
      ro?.disconnect();
      sair?.();
    };
    // `cores` refaz o retrato parado quando o aluno troca de tema.
  }, [slug, ativa, cores]);

  // absolute: o canvas não entra no fluxo. No fluxo, a altura intrínseca dele
  // (width/height em pixels do aparelho) esticava a caixa da prévia a cada medida.
  return <canvas ref={ref} role="img" aria-label={rotulo} className="absolute inset-0 block h-full w-full" />;
}
