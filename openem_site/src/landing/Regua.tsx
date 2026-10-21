import { fracaoDaRegua, marcasDaRegua } from './hora';

/**
 * Régua de 0 a 60 minutos. O marcador anda por transform (o invólucro tem o
 * tamanho da régua, então translate em % é a fração da régua).
 */
export function Regua({
  minuto,
  orientacao,
  className = '',
}: {
  minuto: number;
  orientacao: 'vertical' | 'horizontal';
  className?: string;
}) {
  const fracao = fracaoDaRegua(minuto);
  const vertical = orientacao === 'vertical';
  const marcas = marcasDaRegua();

  return (
    <div
      aria-hidden="true"
      className={`relative ${vertical ? 'h-full w-14' : 'h-11 w-full'} ${className}`}
      style={{ containerType: vertical ? 'size' : 'inline-size' }}
    >
      {/* Trilho e o trecho já percorrido. */}
      <div
        className={`absolute rounded-full bg-line ${
          vertical ? 'top-0 bottom-0 left-[1.15rem] w-0.5' : 'right-0 left-0 top-[0.7rem] h-0.5'
        }`}
      />
      <div
        className={`regua-marca absolute rounded-full bg-brand ${
          vertical
            ? 'top-0 left-[1.15rem] h-full w-0.5 origin-top'
            : 'top-[0.7rem] left-0 h-0.5 w-full origin-left'
        }`}
        style={{ transform: vertical ? `scaleY(${fracao})` : `scaleX(${fracao})` }}
      />

      {marcas.map(({ minuto: m, rotulo }) => {
        const pos = `${(m / 60) * 100}%`;
        return (
          <div
            key={m}
            className={`absolute flex items-center ${
              vertical ? 'left-[0.85rem] -translate-y-1/2 gap-2' : 'top-[0.45rem] -translate-x-1/2 flex-col gap-1'
            }`}
            style={vertical ? { top: pos } : { left: pos }}
          >
            <span
              className={`block rounded-full ${m <= minuto ? 'bg-brand' : 'bg-muted/40'} ${
                vertical ? (rotulo ? 'h-0.5 w-3' : 'h-0.5 w-2') : rotulo ? 'h-3 w-0.5' : 'h-2 w-0.5'
              }`}
            />
            {rotulo && (
              <span
                className={`font-data text-[0.7rem] leading-none tabular-nums ${
                  m <= minuto ? 'text-fg' : 'text-muted'
                }`}
              >
                {m}
              </span>
            )}
          </div>
        );
      })}

      {/* Marcador: anda em unidades do contêiner (cqw/cqh), só com transform e
          sem um invólucro do tamanho da régua vazando para fora da página. */}
      <span
        className={`regua-marca pointer-events-none absolute size-3.5 rounded-full bg-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_22%,transparent)] ${
          vertical ? 'top-0 left-[1.2rem]' : 'top-[0.75rem] left-0'
        }`}
        style={{
          transform: vertical
            ? `translateY(calc(${fracao} * 100cqh)) translate(-50%, -50%)`
            : `translateX(calc(${fracao} * 100cqw)) translate(-50%, -50%)`,
        }}
      />
    </div>
  );
}
