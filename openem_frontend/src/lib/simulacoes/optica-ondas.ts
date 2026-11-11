/**
 * Óptica geométrica (refração com Fresnel, lentes e espelhos de Gauss) e
 * efeito Doppler do som.
 */
import { grausParaRad, radParaGraus } from './numerico';

// ---------------------------------------------------------------------------
// Refração
// ---------------------------------------------------------------------------

/** Índices de refração para a luz amarela do sódio (589 nm). */
export const MEIOS = [
  { key: 'ar', nome: 'Ar', n: 1.000293 },
  { key: 'agua', nome: 'Água', n: 1.333 },
  { key: 'acrilico', nome: 'Acrílico', n: 1.49 },
  { key: 'vidro', nome: 'Vidro comum', n: 1.52 },
  { key: 'diamante', nome: 'Diamante', n: 2.417 },
] as const;

export interface Refracao {
  /** null quando há reflexão total. */
  refratadoGraus: number | null;
  refletidoGraus: number;
  /** Fração da potência refletida (Fresnel, luz não polarizada). */
  R: number;
  T: number;
  reflexaoTotal: boolean;
  anguloCriticoGraus: number | null;
}

export function anguloCritico(n1: number, n2: number): number | null {
  return n1 > n2 ? radParaGraus(Math.asin(n2 / n1)) : null;
}

/** Lei de Snell (n1 sen θ1 = n2 sen θ2) + equações de Fresnel. */
export function refratar(n1: number, n2: number, incidenciaGraus: number): Refracao {
  const t1 = grausParaRad(incidenciaGraus);
  const s2 = (n1 / n2) * Math.sin(t1);
  const critico = anguloCritico(n1, n2);
  if (Math.abs(s2) > 1) {
    return { refratadoGraus: null, refletidoGraus: incidenciaGraus, R: 1, T: 0, reflexaoTotal: true, anguloCriticoGraus: critico };
  }
  const t2 = Math.asin(s2);
  const c1 = Math.cos(t1);
  const c2 = Math.cos(t2);
  const rs = ((n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2)) ** 2;
  const rp = ((n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1)) ** 2;
  const R = (rs + rp) / 2;
  return {
    refratadoGraus: radParaGraus(t2),
    refletidoGraus: incidenciaGraus,
    R,
    T: 1 - R,
    reflexaoTotal: false,
    anguloCriticoGraus: critico,
  };
}

// ---------------------------------------------------------------------------
// Lentes e espelhos esféricos (referencial de Gauss)
// ---------------------------------------------------------------------------

export type Instrumento = 'lente-convergente' | 'lente-divergente' | 'espelho-concavo' | 'espelho-convexo';

/** Distância focal com sinal: positiva para convergente e côncavo. */
export function focoComSinal(instrumento: Instrumento, f: number) {
  return instrumento === 'lente-convergente' || instrumento === 'espelho-concavo' ? Math.abs(f) : -Math.abs(f);
}

export interface Imagem {
  /** p' (m): positivo = imagem real; Infinity = imprópria (objeto no foco). */
  pLinha: number;
  aumento: number;
  natureza: 'real' | 'virtual' | 'imprópria';
  orientacao: 'direita' | 'invertida' | '—';
  tamanho: 'maior' | 'menor' | 'igual' | '—';
}

/** Equação de Gauss 1/f = 1/p + 1/p' e aumento A = −p'/p. */
export function formarImagem(f: number, p: number): Imagem {
  if (Math.abs(p - f) < 1e-9) {
    return { pLinha: Infinity, aumento: Infinity, natureza: 'imprópria', orientacao: '—', tamanho: '—' };
  }
  const pLinha = (f * p) / (p - f);
  const aumento = -pLinha / p;
  const abs = Math.abs(aumento);
  return {
    pLinha,
    aumento,
    natureza: pLinha > 0 ? 'real' : 'virtual',
    orientacao: aumento > 0 ? 'direita' : 'invertida',
    tamanho: Math.abs(abs - 1) < 1e-6 ? 'igual' : abs > 1 ? 'maior' : 'menor',
  };
}

/** Vergência (dioptrias, "graus" dos óculos): V = 1/f com f em metros. */
export const vergencia = (fMetros: number) => 1 / fMetros;

// ---------------------------------------------------------------------------
// Efeito Doppler
// ---------------------------------------------------------------------------

/** Velocidade do som no ar seco (m/s) em função da temperatura (°C). */
export const velocidadeSom = (tempC: number) => 331.3 * Math.sqrt(1 + tempC / 273.15);

/**
 * f' = f·(v + vo)/(v − vs), com vo positivo quando o observador se aproxima
 * da fonte e vs positivo quando a fonte se aproxima do observador.
 */
export function frequenciaDoppler(f: number, v: number, vo: number, vs: number) {
  if (vs >= v) return Infinity;
  return (f * (v + vo)) / (v - vs);
}

/** Comprimento de onda à frente (λ menor) e atrás (λ maior) da fonte. */
export function comprimentosDoppler(f: number, v: number, vs: number) {
  return { frente: (v - vs) / f, tras: (v + vs) / f, parado: v / f };
}

/** Ângulo do cone de Mach: sen α = v/vs (só existe para vs > v). */
export function anguloMach(v: number, vs: number): number | null {
  return vs > v ? radParaGraus(Math.asin(v / vs)) : null;
}

/**
 * Frentes de onda emitidas por uma fonte em movimento retilíneo uniforme:
 * cada uma é um círculo centrado onde a fonte estava ao emiti-la.
 */
export function frentesDeOnda(f: number, v: number, vs: number, t: number, x0 = 0) {
  const T = 1 / f;
  const out: { cx: number; r: number }[] = [];
  for (let k = 0; k * T <= t; k++) {
    const te = k * T;
    out.push({ cx: x0 + vs * te, r: v * (t - te) });
  }
  return out;
}
