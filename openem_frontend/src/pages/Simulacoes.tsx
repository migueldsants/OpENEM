import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { IconArrowRight, IconCube, IconPlanet } from '../components/icons';
import { GradeSimulacoes } from '../components/simulacoes/Bancada';
import { Miniatura } from '../components/simulacoes/Miniatura';
import {
  AREA_DA_MATERIA,
  filtrarSimulacoes,
  MATERIAS_SIM,
  SIMULACOES,
  simulacoesDaMateria,
  SLUG_DA_MATERIA,
  type MateriaSim,
} from '../lib/simulacoes/catalogo';

// Mosaico de prévias de cada matéria, pela quantidade (classes literais para o Tailwind).
const MOSAICO: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 grid-rows-2 [&>*:first-child]:col-span-2',
  4: 'grid-cols-2 grid-rows-2',
};

/**
 * Cinco matérias sem buraco: no notebook (6 colunas) a primeira fileira tem
 * três cartões e a segunda dois, mais largos; no celular largo (2 colunas) o
 * último ocupa a fileira; no monitor largo, os cinco lado a lado.
 */
const VAO_MATERIA = [
  'lg:col-span-2 2xl:col-span-1',
  'lg:col-span-2 2xl:col-span-1',
  'lg:col-span-2 2xl:col-span-1',
  'lg:col-span-3 2xl:col-span-1',
  'sm:col-span-2 md:col-span-1 lg:col-span-3 2xl:col-span-1',
];

/** Porta de entrada de uma matéria: prévias rodando, nome, contagem e o que tem dentro. */
function CartaoMateria({ m }: { m: MateriaSim }) {
  const area = AREA_DA_MATERIA[m];
  const lista = simulacoesDaMateria(m);
  const previas = lista.slice(0, 4);
  const em3d = lista.filter((s) => s.dimensao === '3D').length;
  const nomes = lista.slice(0, 3).map((s) => s.titulo);
  const resto = lista.length - nomes.length;
  return (
    <Link
      to={`/simulacoes/${SLUG_DA_MATERIA[m]}`}
      className="lift card group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] hover:shadow-[var(--shadow)]"
      style={{ borderColor: `color-mix(in oklab, var(--${area}) 30%, var(--line))` }}
    >
      {/* As prévias são decoração aqui: o nome do link é o texto do cartão. */}
      <div aria-hidden className={`grid aspect-[16/10] gap-px border-b border-line bg-line ${MOSAICO[previas.length]}`}>
        {previas.map((s) => (
          <div key={s.slug} className="relative bg-surface-2">
            <Miniatura slug={s.slug} rotulo={s.titulo} />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4" style={{ background: `color-mix(in oklab, var(--${area}) 7%, var(--surface))` }}>
        <span className="h-1 w-10 rounded-full" style={{ background: `var(--${area})` }} />
        <h2 className="font-display text-2xl font-extrabold tracking-tight">{m}</h2>
        <p className="text-sm text-muted">
          <span className="font-data font-semibold text-fg">{lista.length}</span> {lista.length === 1 ? 'experimento' : 'experimentos'}
          {em3d > 0 && (
            <>
              {' '}
              · <span className="font-data font-semibold text-fg">{em3d}</span> em 3D
            </>
          )}
        </p>
        <p className="line-clamp-2 text-[0.8125rem] leading-snug text-muted text-pretty">
          {nomes.join(', ')}
          {resto > 0 && ` e mais ${resto}`}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold transition-colors group-hover:text-brand group-focus-visible:text-brand">
          Ver as simulações
          <IconArrowRight width={15} height={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Simulações de Física, Química, Biologia, Matemática e Geografia. A tela abre nas
 * matérias (cada uma com as suas prévias rodando) e cada matéria tem a sua
 * lista (`SimulacoesMateria`); a busca e o "Só 3D" procuram em todas.
 * Tudo roda no aparelho, sem backend.
 */
export default function Simulacoes() {
  const [busca, setBusca] = useState('');
  const [so3d, setSo3d] = useState(false);
  const filtrando = busca.trim() !== '' || so3d;
  const lista = useMemo(() => filtrarSimulacoes(SIMULACOES, busca, null, so3d ? '3D' : null), [busca, so3d]);
  const em3d = SIMULACOES.filter((s) => s.dimensao === '3D').length;
  const limpar = () => {
    setBusca('');
    setSo3d(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulações"
        subtitle={
          <>
            <span className="font-data font-semibold text-fg">{SIMULACOES.length}</span> experimentos de Física, Química, Biologia,
            Matemática e Geografia, <span className="font-data font-semibold text-fg">{em3d}</span> deles em 3D. Escolha a matéria, mexa nos controles
            e veja a fórmula da prova acontecer, direto no seu aparelho.
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            className="input sm:max-w-xs"
            placeholder="Buscar em todas: refração, pH, Kepler…"
            aria-label="Buscar simulação"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button type="button" className="chip self-start sm:self-auto" data-active={so3d} aria-pressed={so3d} onClick={() => setSo3d(!so3d)}>
            <IconCube width={14} height={14} />
            Só 3D
          </button>
        </div>
      </PageHeader>

      {!filtrando ? (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-6 2xl:grid-cols-5" aria-label="Matérias">
          {MATERIAS_SIM.map((m, i) => (
            <li key={m} className={VAO_MATERIA[i] ?? ''}>
              <CartaoMateria m={m} />
            </li>
          ))}
        </ul>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={IconPlanet}
          title="Nenhuma simulação encontrada"
          description="Tente outra palavra ou limpe os filtros."
          action={{ label: 'Limpar filtros', onClick: limpar }}
        />
      ) : (
        <section className="space-y-3" aria-labelledby="sim-resultados">
          <h2 id="sim-resultados" className="text-sm text-muted">
            <span className="font-data font-semibold text-fg">{lista.length}</span> {lista.length === 1 ? 'simulação encontrada' : 'simulações encontradas'}
          </h2>
          <GradeSimulacoes lista={lista} rotulo="Resultado da busca" mostrarMateria />
        </section>
      )}
    </div>
  );
}
