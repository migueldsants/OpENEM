import { Link } from 'react-router-dom';
import { AREA_DA_MATERIA, type SimulacaoInfo } from '../../lib/simulacoes/catalogo';
import { vaos } from '../../lib/simulacoes/grade';
import { IconArrowRight, IconCube } from '../icons';
import { Miniatura } from './Miniatura';

/** Selo 2D/3D, em mono e na cor da área da matéria. */
export function Dimensao({ s }: { s: SimulacaoInfo }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-data text-[11px] font-bold"
      style={{ color: `var(--${AREA_DA_MATERIA[s.materia]})` }}
    >
      {s.dimensao === '3D' && <IconCube width={12} height={12} />}
      {s.dimensao}
    </span>
  );
}

/**
 * Colunas da grade por largura de tela (mais simulações à vista). Em `md` a
 * barra lateral aparece e come a largura, por isso a grade volta a 2.
 */
const COLUNAS = { base: 2, sm: 3, md: 2, lg: 3, xl: 4, '2xl': 5 } as const;
type Faixa = keyof typeof COLUNAS;
const FAIXAS = Object.keys(COLUNAS) as Faixa[];

// Classes literais (o Tailwind só gera o que lê no código): a prévia mantém a
// mesma altura dos vizinhos quando o cartão ocupa mais colunas.
const VAO: Record<Faixa, Record<number, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2' },
  sm: { 1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3' },
  md: { 1: 'md:col-span-1', 2: 'md:col-span-2' },
  lg: { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' },
  xl: { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3', 4: 'xl:col-span-4' },
  '2xl': { 1: '2xl:col-span-1', 2: '2xl:col-span-2', 3: '2xl:col-span-3', 4: '2xl:col-span-4', 5: '2xl:col-span-5' },
};
const PREVIA: Record<Faixa, Record<number, string>> = {
  base: { 1: 'aspect-[16/9]', 2: 'aspect-[32/9]' },
  sm: { 1: 'sm:aspect-[16/9]', 2: 'sm:aspect-[32/9]', 3: 'sm:aspect-[48/9]' },
  md: { 1: 'md:aspect-[16/9]', 2: 'md:aspect-[32/9]' },
  lg: { 1: 'lg:aspect-[16/9]', 2: 'lg:aspect-[32/9]', 3: 'lg:aspect-[48/9]' },
  xl: { 1: 'xl:aspect-[16/9]', 2: 'xl:aspect-[32/9]', 3: 'xl:aspect-[48/9]', 4: 'xl:aspect-[64/9]' },
  '2xl': { 1: '2xl:aspect-[16/9]', 2: '2xl:aspect-[32/9]', 3: '2xl:aspect-[48/9]', 4: '2xl:aspect-[64/9]', 5: '2xl:aspect-[80/9]' },
};

function Bancada({ s, previa, mostrarMateria }: { s: SimulacaoInfo; previa: string; mostrarMateria: boolean }) {
  const area = AREA_DA_MATERIA[s.materia];
  return (
    <Link
      to={`/simulacoes/${s.slug}`}
      className="lift card group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] hover:border-[color-mix(in_oklab,var(--brand)_35%,var(--line))] hover:shadow-[var(--shadow)]"
    >
      <div className={`relative border-b border-line bg-surface-2 ${previa}`}>
        <Miniatura slug={s.slug} rotulo={`Prévia animada: ${s.titulo}`} />
        <span className="absolute right-2.5 top-2.5">
          <Dimensao s={s} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-sm font-bold leading-snug sm:text-[0.95rem]">{s.titulo}</h3>
          <IconArrowRight
            width={15}
            height={15}
            aria-hidden
            className="mt-0.5 shrink-0 text-muted transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-brand group-focus-visible:text-brand"
          />
        </div>
        {mostrarMateria && (
          <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: `var(--${area})` }}>
            <span className="size-1.5 rounded-full" style={{ background: `var(--${area})` }} />
            {s.materia}
          </p>
        )}
        {/* No celular o cartão é estreito: fica só o título, e o resumo aparece na tela da simulação. */}
        <div className="hidden md:block">
          <p className="line-clamp-2 text-[0.8125rem] leading-snug text-muted text-pretty">{s.resumo}</p>
        </div>
      </div>
    </Link>
  );
}

/**
 * A bancada: um cartão por simulação, com a prévia rodando. Só a última
 * fileira pode sobrar, e ela se divide na largura toda (`lib/simulacoes/grade.ts`).
 * `mostrarMateria` põe a matéria no cartão (na busca, que mistura todas).
 */
export function GradeSimulacoes({ lista, rotulo, mostrarMateria = false }: { lista: SimulacaoInfo[]; rotulo: string; mostrarMateria?: boolean }) {
  const vao = Object.fromEntries(FAIXAS.map((f) => [f, vaos(lista.length, COLUNAS[f]).reverse()])) as Record<Faixa, number[]>;
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" aria-label={rotulo}>
      {lista.map((s, i) => (
        <li key={s.slug} className={FAIXAS.map((f) => VAO[f][vao[f][i]]).join(' ')}>
          <Bancada s={s} previa={FAIXAS.map((f) => PREVIA[f][vao[f][i]]).join(' ')} mostrarMateria={mostrarMateria} />
        </li>
      ))}
    </ul>
  );
}
