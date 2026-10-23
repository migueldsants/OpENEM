import { Fragment } from 'react';

const NORMAL: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '−',
};

/**
 * Texto com expoentes ("1s² 2p⁶", "Fe²⁺") desenhado com <sup> de verdade. Os
 * caracteres sobrescritos do Unicode vêm de blocos diferentes (², ³ e ¹ do
 * Latin-1, os outros de outro bloco) e saem com tamanhos diferentes na mesma
 * fonte; numa configuração eletrônica o expoente é o dado.
 */
export function Expoentes({ texto }: { texto: string }) {
  const partes = texto.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <sup key={i} className="tp-expoente">
            {[...p].map((c) => NORMAL[c] ?? c).join('')}
          </sup>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
