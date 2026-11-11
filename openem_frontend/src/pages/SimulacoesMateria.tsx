import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { IconChevronLeft, IconCube } from '../components/icons';
import { GradeSimulacoes } from '../components/simulacoes/Bancada';
import { AREA_DA_MATERIA, MATERIAS_SIM, simulacoesDaMateria, SLUG_DA_MATERIA, type MateriaSim } from '../lib/simulacoes/catalogo';

/**
 * As simulações de uma matéria (`/simulacoes/fisica`…): a bancada com as
 * prévias rodando, as cenas 3D na frente, e atalhos para as outras matérias.
 */
export default function SimulacoesMateria({ materia }: { materia: MateriaSim }) {
  // O filtro vale para a matéria em que foi ligado: trocar de matéria pelos atalhos o desliga.
  const [so3dEm, setSo3dEm] = useState<MateriaSim | null>(null);
  const so3d = so3dEm === materia;
  const todas = simulacoesDaMateria(materia);
  const em3d = todas.filter((s) => s.dimensao === '3D').length;
  const lista = so3d ? todas.filter((s) => s.dimensao === '3D') : todas;
  // "Só 3D" só faz sentido quando a matéria tem as duas coisas.
  const temFiltro = em3d > 0 && em3d < todas.length;

  return (
    <div className="space-y-6">
      <Link to="/simulacoes" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <IconChevronLeft width={14} height={14} />
        Simulações
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="size-3 shrink-0 rounded-full" style={{ background: `var(--${AREA_DA_MATERIA[materia]})` }} aria-hidden />
            {materia}
          </span>
        }
        subtitle={
          <>
            <span className="font-data font-semibold text-fg">{todas.length}</span> {todas.length === 1 ? 'experimento' : 'experimentos'}
            {em3d > 0 && (
              <>
                , <span className="font-data font-semibold text-fg">{em3d}</span> em 3D
              </>
            )}
            . Abra um, mexa nos controles e compare com a fórmula.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-2" aria-label="Matérias">
            {MATERIAS_SIM.map((m) => (
              <Link
                key={m}
                to={`/simulacoes/${SLUG_DA_MATERIA[m]}`}
                className="chip"
                data-active={m === materia}
                aria-current={m === materia ? 'page' : undefined}
              >
                <span className="size-1.5 rounded-full" style={{ background: `var(--${AREA_DA_MATERIA[m]})` }} />
                {m}
              </Link>
            ))}
          </nav>
          {temFiltro && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
              <button type="button" className="chip" data-active={so3d} aria-pressed={so3d} onClick={() => setSo3dEm(so3d ? null : materia)}>
                <IconCube width={14} height={14} />
                Só 3D
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <GradeSimulacoes lista={lista} rotulo={`Simulações de ${materia}`} />
    </div>
  );
}
