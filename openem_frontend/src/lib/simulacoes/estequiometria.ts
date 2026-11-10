/**
 * Balanceamento e reagente limitante. Cada espécie é a contagem dos átomos da
 * fórmula; balancear é fazer a contagem de cada elemento fechar dos dois lados
 * (conservação da massa, Lavoisier), e reagir é ver quantas vezes a reação
 * cabe nas quantidades dadas: o reagente que acaba primeiro é o limitante.
 */

export interface Especie {
  formula: string;
  atomos: Record<string, number>;
}

export interface Reacao {
  key: string;
  nome: string;
  reagentes: Especie[];
  produtos: Especie[];
  /** Coeficientes balanceados, os menores inteiros: reagentes e depois produtos. */
  coef: number[];
  contexto: string;
}

const e = (formula: string, atomos: Record<string, number>): Especie => ({ formula, atomos });
const H2 = e('H₂', { H: 2 });
const O2 = e('O₂', { O: 2 });
const H2O = e('H₂O', { H: 2, O: 1 });
const CO2 = e('CO₂', { C: 1, O: 2 });

export const REACOES: Reacao[] = [
  { key: 'agua', nome: 'Síntese da água', reagentes: [H2, O2], produtos: [H2O], coef: [2, 1, 2], contexto: 'A reação que move os foguetes de hidrogênio e as células a combustível: o único produto é água.' },
  { key: 'amonia', nome: 'Síntese da amônia', reagentes: [e('N₂', { N: 2 }), H2], produtos: [e('NH₃', { N: 1, H: 3 })], coef: [1, 3, 2], contexto: 'O processo Haber-Bosch, base dos fertilizantes nitrogenados que alimentam metade do mundo.' },
  { key: 'metano', nome: 'Combustão do metano', reagentes: [e('CH₄', { C: 1, H: 4 }), O2], produtos: [CO2, H2O], coef: [1, 2, 1, 2], contexto: 'A queima do gás natural no fogão. Com pouco oxigênio a combustão é incompleta e forma CO, tóxico.' },
  { key: 'etanol', nome: 'Combustão do etanol', reagentes: [e('C₂H₆O', { C: 2, H: 6, O: 1 }), O2], produtos: [CO2, H2O], coef: [1, 3, 2, 3], contexto: 'O álcool do carro flex. O CO₂ liberado foi absorvido antes pela cana, por isso o etanol é chamado de renovável.' },
  { key: 'so3', nome: 'Oxidação do SO₂', reagentes: [e('SO₂', { S: 1, O: 2 }), O2], produtos: [e('SO₃', { S: 1, O: 3 })], coef: [2, 1, 2], contexto: 'Um passo da chuva ácida: o SO₃ reage com a água da chuva e forma ácido sulfúrico.' },
  { key: 'ferro', nome: 'Redução do minério de ferro', reagentes: [e('Fe₂O₃', { Fe: 2, O: 3 }), e('CO', { C: 1, O: 1 })], produtos: [e('Fe', { Fe: 1 }), CO2], coef: [1, 3, 2, 3], contexto: 'O que acontece no alto-forno da siderurgia: o monóxido de carbono tira o oxigênio da hematita.' },
  { key: 'ferrugem', nome: 'Ferrugem', reagentes: [e('Fe', { Fe: 1 }), O2], produtos: [e('Fe₂O₃', { Fe: 2, O: 3 })], coef: [4, 3, 2], contexto: 'A oxidação do ferro pelo oxigênio do ar (simplificada, sem a água que participa de verdade).' },
];

/** Total de átomos de cada elemento num lado da equação. */
export function contarAtomos(especies: Especie[], coefs: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  especies.forEach((esp, i) => {
    for (const [el, n] of Object.entries(esp.atomos)) out[el] = (out[el] ?? 0) + n * (coefs[i] ?? 0);
  });
  return out;
}

/** Os dois lados têm os mesmos átomos (com todos os coeficientes ≥ 1). */
export function balanceada(r: Reacao, coefs: number[]): boolean {
  if (coefs.some((c) => !(c >= 1))) return false;
  const a = contarAtomos(r.reagentes, coefs.slice(0, r.reagentes.length));
  const b = contarAtomos(r.produtos, coefs.slice(r.reagentes.length));
  const els = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...els].every((el) => a[el] === b[el]);
}

const mdc = (a: number, b: number): number => (b ? mdc(b, a % b) : a);

/** Balanceada com os menores inteiros (2, 1, 2 e não 4, 2, 4). */
export const menoresInteiros = (coefs: number[]) => coefs.reduce(mdc) === 1;

export interface Resultado {
  /** Quantas vezes a reação acontece com as quantidades dadas. */
  vezes: number;
  /** Índice do reagente limitante; null se estão na proporção exata (ou se falta um deles). */
  limitante: number | null;
  produtos: number[];
  sobra: number[];
}

/** Reage o máximo possível de `quantidades` (moléculas ou mols de cada reagente). */
export function reagir(r: Reacao, quantidades: number[]): Resultado {
  const nr = r.reagentes.length;
  const cabe = quantidades.map((q, i) => q / r.coef[i]);
  const vezes = Math.floor(Math.min(...cabe) + 1e-9);
  const sobra = quantidades.map((q, i) => q - vezes * r.coef[i]);
  const menor = Math.min(...cabe);
  const empatados = cabe.filter((c) => Math.abs(c - menor) < 1e-9).length;
  return {
    vezes,
    limitante: empatados === nr ? null : cabe.findIndex((c) => Math.abs(c - menor) < 1e-9),
    produtos: r.produtos.map((_, j) => vezes * r.coef[nr + j]),
    sobra,
  };
}

/** Massa molar (g/mol) a partir das massas atômicas (as da tabela periódica). */
export const massaMolarDe = (esp: Especie, massas: Record<string, number>) => Object.entries(esp.atomos).reduce((s, [el, n]) => s + n * (massas[el] ?? 0), 0);

/** Equação escrita: "2 H₂ + O₂ → 2 H₂O". */
export function escrever(r: Reacao, coefs: number[]): string {
  const lado = (esps: Especie[], cs: number[]) => esps.map((x, i) => `${cs[i] === 1 ? '' : `${cs[i]} `}${x.formula}`).join(' + ');
  return `${lado(r.reagentes, coefs)} → ${lado(r.produtos, coefs.slice(r.reagentes.length))}`;
}
