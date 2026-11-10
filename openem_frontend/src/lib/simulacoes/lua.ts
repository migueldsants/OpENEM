/**
 * Fases da Lua e eclipses. A fase depende só do ângulo Sol-Terra-Lua
 * (elongação), que dá uma volta a cada mês sinódico. Eclipse precisa de mais:
 * a órbita da Lua é inclinada 5,1° em relação à da Terra, então na lua nova e
 * na cheia a Lua quase sempre passa acima ou abaixo da linha Sol-Terra; só
 * perto dos nodos (onde as duas órbitas se cruzam) a sombra acerta.
 */

/** Dias entre duas luas novas. */
export const MES_SINODICO = 29.530589;
/** Dias entre duas passagens da Lua pelo mesmo nodo. */
export const MES_DRACONICO = 27.212221;
/** Inclinação da órbita da Lua sobre a eclíptica (graus). */
export const INCLINACAO = 5.145;
/**
 * Latitude eclíptica máxima da Lua para haver eclipse (graus, valores médios
 * dos "limites eclípticos"): o Sol é mais largo visto da Terra que a sombra
 * da Terra na distância da Lua, por isso o limite solar é maior.
 */
export const LIMITE_SOLAR = 1.45;
export const LIMITE_LUNAR = 0.95;

const TAU = Math.PI * 2;

/** Elongação (rad) para a idade da Lua em dias: 0 na nova, π na cheia. */
export const elongacao = (idade: number) => (TAU * (((idade % MES_SINODICO) + MES_SINODICO) % MES_SINODICO)) / MES_SINODICO;

/** Fração do disco iluminada vista da Terra. */
export const fracaoIluminada = (idade: number) => (1 - Math.cos(elongacao(idade))) / 2;

export type Fase =
  | 'Lua nova'
  | 'Crescente'
  | 'Quarto crescente'
  | 'Crescente gibosa'
  | 'Lua cheia'
  | 'Minguante gibosa'
  | 'Quarto minguante'
  | 'Minguante';

/** Nome da fase: as quatro principais valem por um dia e meio em volta do instante exato. */
export function nomeFase(idade: number): Fase {
  const d = ((idade % MES_SINODICO) + MES_SINODICO) % MES_SINODICO;
  const q = MES_SINODICO / 4;
  const perto = (alvo: number) => Math.min(Math.abs(d - alvo), Math.abs(d - alvo - MES_SINODICO), Math.abs(d - alvo + MES_SINODICO)) <= 1.5 / 2;
  if (perto(0)) return 'Lua nova';
  if (perto(q)) return 'Quarto crescente';
  if (perto(2 * q)) return 'Lua cheia';
  if (perto(3 * q)) return 'Quarto minguante';
  if (d < q) return 'Crescente';
  if (d < 2 * q) return 'Crescente gibosa';
  if (d < 3 * q) return 'Minguante gibosa';
  return 'Minguante';
}

/**
 * Latitude eclíptica da Lua (graus) no dia `t`. `t` conta a partir de uma lua
 * nova; `nodo` é quantos dias depois dela a Lua cruza o nodo ascendente.
 */
export const latitudeLua = (t: number, nodo: number) => INCLINACAO * Math.sin((TAU * (t - nodo)) / MES_DRACONICO);

export type Eclipse = 'solar' | 'lunar' | null;

/** Eclipse no dia `t`, se for dia de lua nova (solar) ou cheia (lunar) com a Lua perto do nodo. */
export function eclipseNoDia(t: number, nodo: number): Eclipse {
  const d = ((t % MES_SINODICO) + MES_SINODICO) % MES_SINODICO;
  const beta = Math.abs(latitudeLua(t, nodo));
  if ((d < 0.5 || d > MES_SINODICO - 0.5) && beta < LIMITE_SOLAR) return 'solar';
  if (Math.abs(d - MES_SINODICO / 2) < 0.5 && beta < LIMITE_LUNAR) return 'lunar';
  return null;
}

/** Eclipses entre os dias `de` e `ate`, conferindo cada lua nova e cheia. */
export function eclipsesEntre(de: number, ate: number, nodo: number): { dia: number; tipo: 'solar' | 'lunar' }[] {
  const out: { dia: number; tipo: 'solar' | 'lunar' }[] = [];
  const meia = MES_SINODICO / 2;
  for (let k = Math.ceil(de / meia); k * meia <= ate; k++) {
    const dia = k * meia;
    const tipo = eclipseNoDia(dia, nodo);
    if (tipo) out.push({ dia, tipo });
  }
  return out;
}
