import { FAMILIAS, ladoDaVitrine } from './temas';

/**
 * Cada tema do app desenhado com o CSS do próprio app: o data-theme no cartão
 * troca os tokens só ali dentro (é assim que a galeria de Temas funciona). A
 * miniatura é a questão de verdade da landing, não barras de esqueleto. No
 * celular a faixa rola de lado; no desktop vira grade e mostra as 18 famílias.
 */
export function FaixaDeTemas() {
  return (
    <ul
      aria-label="Temas de cor do app"
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0"
    >
      {FAMILIAS.map(({ key, label }) => {
        const tema = `${key}-${ladoDaVitrine(key)}`;
        return (
          <li key={key} className="shrink-0 snap-start lg:shrink">
            <figure
              data-theme={tema}
              className="w-44 rounded-2xl border border-line bg-bg p-2.5 text-fg lg:w-auto"
            >
              <div aria-hidden className="card overflow-hidden text-[0.6rem] leading-snug">
                <div className="flex gap-1.5 p-2">
                  <span className="mt-0.5 h-5 w-0.5 shrink-0 rounded-full bg-mat" />
                  <div className="min-w-0">
                    <p className="font-semibold text-mat">Matemática</p>
                    <p className="mt-0.5 text-balance">O valor correto da média das notas desse estudante é</p>
                  </div>
                </div>
                <div className="space-y-1 px-2 pb-2">
                  {['4.', '5.'].map((t, i) => (
                    <div
                      key={t}
                      className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${
                        i === 1 ? 'border-brand bg-brand/8' : 'border-line'
                      }`}
                    >
                      <span
                        className={`grid size-3.5 place-items-center rounded font-semibold ${
                          i === 1 ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {i === 1 ? 'B' : 'A'}
                      </span>
                      {t}
                    </div>
                  ))}
                  <span className="mt-1.5 block rounded-md bg-brand py-1 text-center font-semibold text-brand-ink">
                    Responder
                  </span>
                </div>
              </div>
              <figcaption className="mt-2 px-0.5 text-xs font-semibold">{label}</figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
