import { useMemo, useState, type CSSProperties } from 'react';
import temas from 'virtual:arquivo-redacoes';
import { porAno } from './anos';
import { ANOS_DO_ENEM, NOME_DA_AREA, provaDoAno, temaRegular, ULTIMO_ANO, type Area, type DiaDeProva } from './prova';

// Cor de cada área, com os tokens do app (calibrados para os dois lados do tema).
const PONTO: Record<Area, string> = { lin: 'bg-lin', hum: 'bg-hum', nat: 'bg-nat', mat: 'bg-mat' };

function descreverDia({ dia, areas, redacao }: DiaDeProva): string {
  const nomes = areas.map((a) => NOME_DA_AREA[a]);
  if (redacao) nomes.push('Redação');
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0];
  return `${dia}º dia: ${lista}.`;
}

/**
 * O caderno da hero: escolher um ano troca a capa, com o formato da prova, as
 * áreas de cada dia e o tema da redação regular, tirado do catálogo do app.
 */
export function Caderno() {
  const anos = useMemo(() => porAno(temas), []);
  const [ano, setAno] = useState(ULTIMO_ANO);
  // De que lado a capa nova entra: ano mais novo pela direita, mais antigo
  // pela esquerda, como numa linha do tempo.
  const [lado, setLado] = useState(0);
  const escolher = (a: number) => {
    if (a === ano) return;
    setLado(a > ano ? 1 : -1);
    setAno(a);
  };
  const prova = provaDoAno(ano);
  const tema = temaRegular(anos, ano);
  const areas = prova.dias.flatMap((d) => d.areas);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative pt-3 pr-4">
        {/* As folhas de trás são neutras: o rosa fica só na capa do ano escolhido. */}
        <div
          aria-hidden="true"
          className="leque absolute inset-[0_0_1.1rem_1.4rem] rotate-3 rounded-2xl border border-line bg-surface-2"
        />
        <div
          aria-hidden="true"
          className="leque leque-2 absolute inset-[0.4rem_0.5rem_0.75rem_0.6rem] rotate-[1.4deg] rounded-2xl border border-line bg-surface"
        />
        <article
          key={ano}
          aria-live="polite"
          className="troca card card-raised relative overflow-hidden rounded-[1.25rem]"
          style={{ '--de': `${lado * 18}px` } as CSSProperties}
        >
          <div className="flex flex-wrap items-end justify-between gap-3 bg-brand px-5 py-5 text-brand-ink sm:px-6">
            <div>
              <p className="font-data text-xs tracking-[0.12em] uppercase opacity-85">Caderno de prova</p>
              <p className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums sm:text-5xl">
                ENEM {ano}
              </p>
            </div>
            <span className="rounded-full bg-brand-ink/18 px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
              {prova.formato}
            </span>
          </div>
          <div className="flex flex-col gap-4 px-5 pt-5 pb-6 sm:px-6">
            <div className="space-y-1">
              <p className="font-semibold">{prova.questoes}</p>
              {prova.dias.map((d) => (
                <p key={d.dia} className="text-[0.95rem] leading-snug text-muted">
                  {descreverDia(d)}
                </p>
              ))}
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Áreas da prova">
              {prova.unica ? (
                <li className="chip text-[0.8rem] font-semibold">
                  <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
                  Interdisciplinar
                </li>
              ) : (
                areas.map((a) => (
                  <li key={a} className="chip text-[0.8rem] font-semibold">
                    <span className={`size-2 rounded-full ${PONTO[a]}`} aria-hidden="true" />
                    {NOME_DA_AREA[a]}
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-dashed border-line pt-4">
              <p className="font-data text-xs tracking-[0.1em] text-red uppercase">Tema da redação</p>
              <p className="mt-1 font-display text-lg leading-snug font-bold tracking-tight text-balance sm:text-xl">
                {tema ?? 'O caderno deste ano não tem frase-tema.'}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p id="ano-rotulo" className="text-[0.95rem] font-semibold">
            Escolha o ano da prova
          </p>
          <p className="text-sm text-muted">Até 2008, prova única; desde 2009, dois dias.</p>
        </div>
        <div role="group" aria-labelledby="ano-rotulo" className="grid grid-cols-7 gap-1.5">
          {ANOS_DO_ENEM.map((a) => {
            const ativo = a === ano;
            return (
              <button
                key={a}
                type="button"
                aria-pressed={ativo}
                onClick={() => escolher(a)}
                className={`aperta font-data min-h-11 rounded-lg border text-[0.8rem] font-medium tabular-nums ${
                  ativo
                    ? 'border-brand bg-brand font-semibold text-brand-ink shadow-[var(--shadow)]'
                    : `border-line hover:border-brand hover:text-brand ${a <= 2008 ? 'bg-surface-2' : 'bg-surface'}`
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
