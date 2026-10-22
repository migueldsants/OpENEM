/** Agrupa os temas de redação por ano (o catálogo vem do app, no build). */

export interface TemaDeRedacao {
  ano: number;
  aplicacao: string;
  rotulo: string;
  tema: string;
}

export interface AnoDoArquivo {
  ano: number;
  temas: TemaDeRedacao[];
}

// A aplicação regular é a que todo mundo lembra: vem primeiro.
const ORDEM: Record<string, number> = {
  regular: 0,
  segunda: 1,
  terceira: 2,
  digital: 3,
  belem: 4,
  ppl: 5,
};

export function porAno(temas: TemaDeRedacao[]): AnoDoArquivo[] {
  const mapa = new Map<number, TemaDeRedacao[]>();
  for (const t of temas) {
    const lista = mapa.get(t.ano) ?? [];
    lista.push(t);
    mapa.set(t.ano, lista);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ano, lista]) => ({
      ano,
      temas: [...lista].sort((x, y) => (ORDEM[x.aplicacao] ?? 9) - (ORDEM[y.aplicacao] ?? 9)),
    }));
}
