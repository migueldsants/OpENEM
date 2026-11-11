/**
 * Catálogos da tabela periódica para as simulações de átomo e de ligações:
 * os mesmos arquivos da tela Tabela periódica (`data/elementos.json`) e a
 * lista de nuclídeos da IAEA (`data/nuclideos.json`), carregados sob demanda
 * (chunks à parte) e guardados para a próxima simulação que pedir.
 */
import { useEffect, useState } from 'react';
import type { Catalogo } from '../../lib/elementos';
import { lerNuclideos, type CatalogoNuclideos, type Nuclideo } from '../../lib/simulacoes/atomo';

export interface DadosTabela {
  catalogo: Catalogo;
  nuclideos: Map<number, Nuclideo[]>;
  nuclideosConferidoEm: string;
}

let promessa: Promise<DadosTabela> | null = null;

function carregar(): Promise<DadosTabela> {
  promessa ??= Promise.all([import('../../data/elementos.json'), import('../../data/nuclideos.json')]).then(([e, n]) => {
    const nuc = (n.default ?? n) as unknown as CatalogoNuclideos;
    return { catalogo: (e.default ?? e) as unknown as Catalogo, nuclideos: lerNuclideos(nuc), nuclideosConferidoEm: nuc.conferidoEm };
  });
  return promessa;
}

/** Os catálogos, ou null enquanto carregam. */
export function useDadosTabela(): DadosTabela | null {
  const [dados, setDados] = useState<DadosTabela | null>(null);
  useEffect(() => {
    let vivo = true;
    carregar().then((d) => vivo && setDados(d));
    return () => {
      vivo = false;
    };
  }, []);
  return dados;
}
