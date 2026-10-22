import { useMemo, useState } from 'react';
import temas from 'virtual:arquivo-redacoes';
import { porAno } from './anos';

/**
 * Os 28 anos de ENEM numa grade: escolher um ano mostra o tema de redação de
 * cada aplicação daquele ano, tirado do catálogo do app.
 */
export function Arquivo() {
  const anos = useMemo(() => porAno(temas), []);
  const [ano, setAno] = useState(anos[anos.length - 1]?.ano ?? 2025);
  const escolhido = anos.find((a) => a.ano === ano) ?? anos[anos.length - 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
      <div
        role="group"
        aria-label="Escolha o ano da prova"
        className="grid grid-cols-7 gap-1.5 self-start sm:gap-2"
      >
        {anos.map(({ ano: a, temas: t }) => {
          const ativo = a === ano;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={ativo}
              onClick={() => setAno(a)}
              className={`aperta relative grid aspect-square place-items-center rounded-xl border text-center ${
                ativo
                  ? 'border-brand bg-brand text-brand-ink'
                  : 'border-line bg-surface hover:border-brand/50 hover:bg-surface-2'
              }`}
            >
              <span className="font-data text-[0.78rem] leading-none font-medium tabular-nums sm:text-sm">
                {String(a).slice(2)}
              </span>
              <span className="sr-only">
                ENEM {a}, {t.length} {t.length === 1 ? 'tema' : 'temas'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="card card-raised p-5 sm:p-6" aria-live="polite">
        <p className="font-data text-4xl font-medium tracking-tight tabular-nums text-brand sm:text-5xl">
          {escolhido.ano}
        </p>
        <ul className="mt-5 space-y-5">
          {escolhido.temas.map((t) => (
            <li key={t.aplicacao}>
              <p className="text-sm text-muted">{t.rotulo}</p>
              <p className="mt-1 font-display text-xl leading-snug font-bold tracking-tight text-balance sm:text-2xl">
                {t.tema}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
