import { useRef, useState, type KeyboardEvent } from 'react';
import { abaVizinha, TELAS } from './depois';

/**
 * As telas do app depois da resposta, numa janela de desktop com abas. As
 * capturas são reais (public/telas, com sidecar de procedência): a de desktop
 * na tela larga e a de celular na estreita, nos dois lados do tema.
 */
export function JanelaDoApp() {
  const [ativa, setAtiva] = useState(0);
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const tela = TELAS[ativa];

  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const proxima = abaVizinha(ativa, passo);
    setAtiva(proxima);
    abas.current[proxima]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
      <div className="min-w-0 lg:pt-2">
        <div
          role="tablist"
          aria-label="Telas do app"
          onKeyDown={teclas}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
        >
          {TELAS.map((t, i) => {
            const sel = i === ativa;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  abas.current[i] = el;
                }}
                role="tab"
                id={`aba-${t.id}`}
                aria-selected={sel}
                aria-controls="janela-painel"
                tabIndex={sel ? 0 : -1}
                onClick={() => setAtiva(i)}
                className={`aperta shrink-0 rounded-xl px-4 py-2.5 text-left font-semibold whitespace-nowrap lg:relative lg:px-4 lg:py-3 ${
                  sel
                    ? 'bg-surface text-fg shadow-[var(--shadow)] lg:before:absolute lg:before:top-1/2 lg:before:left-0 lg:before:h-5 lg:before:w-0.5 lg:before:-translate-y-1/2 lg:before:rounded-full lg:before:bg-brand'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`}
              >
                {t.aba}
              </button>
            );
          })}
        </div>
        <div aria-live="polite" className="mt-6 lg:mt-8 lg:pl-4">
          <h3 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.025em] text-balance">
            {tela.titulo}
          </h3>
          <p className="mt-3 max-w-[40ch] leading-relaxed text-muted">{tela.texto}</p>
        </div>
      </div>

      <div
        id="janela-painel"
        role="tabpanel"
        aria-labelledby={`aba-${tela.id}`}
        className="janela min-w-0 overflow-hidden rounded-[1.25rem] border border-line bg-surface"
      >
        {/* Barra da janela: só a borda de baixo e o nome da tela, sem botões falsos. */}
        <div className="flex h-10 items-center border-b border-line bg-surface-2 px-4">
          <p className="font-data text-xs tracking-tight text-muted">OpENEM · {tela.aba}</p>
        </div>
        <div className="relative aspect-[390/600] md:aspect-[16/10]">
          {TELAS.map((t, i) => (
            <div key={t.id} className="camada" data-ativa={i === ativa} aria-hidden={i !== ativa}>
              {(['clara', 'escura'] as const).map((lado) => (
                <picture key={lado} className={`tela ${lado === 'clara' ? 'tela-clara' : 'tela-escura'}`}>
                  <source media="(min-width: 768px)" srcSet={`/telas/${t.id}-desktop-${lado}.webp`} />
                  <img
                    src={`/telas/${t.id}-${lado}.webp`}
                    alt={t.alt}
                    width={390}
                    height={844}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                </picture>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
