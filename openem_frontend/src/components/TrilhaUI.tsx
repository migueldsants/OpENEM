import type { IncidenceWindow, MasteryState } from '../api';
import { decimal, questoesPorProva, recorte } from '../lib/trilhas';

/** "1,7 por prova" ou "não caiu", com só o número em mono. */
export function PorProva({ n }: { n: number }) {
  if (n < 0.05) return <>não caiu</>;
  return (
    <>
      <span className="font-data tabular-nums">{decimal(n)}</span> por prova
    </>
  );
}

/** "16,4 questões por prova", com só o número em mono (texto corrido não). */
export function QuestoesPorProva({ n }: { n: number }) {
  if (n < 0.05) return <>{questoesPorProva(n)}</>;
  const numero = decimal(n);
  return (
    <>
      <span className="font-data tabular-nums">{numero}</span>
      {questoesPorProva(n).slice(numero.length)}
    </>
  );
}
import { IconChevronDown } from './icons';

/** Barra de domínio: enche uma vez ao aparecer, como a barra da meta. */
export function BarraDeDominio({
  valor,
  className = '',
}: {
  /** 0..100. */
  valor: number;
  className?: string;
}) {
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-surface-2 ${className}`}
      aria-hidden
    >
      <div
        className="barra-enche h-full w-full origin-left rounded-full bg-brand"
        style={{ transform: `scaleX(${Math.min(100, Math.max(0, valor)) / 100})` }}
      />
    </div>
  );
}

/**
 * Uma célula por prova da janela, preenchida na cor da área quando o
 * assunto caiu naquela prova. Mesma gramática da faixa da semana, compacta.
 */
export function TiraDosAnos({
  porAno,
  anos,
  cor,
}: {
  porAno: number[];
  anos: number[];
  /** Classe de fundo da área (`AREA_DOT`). */
  cor: string;
}) {
  if (anos.length === 0) return null;
  const caiu = porAno.filter((n) => n > 0).length;
  return (
    <span
      role="img"
      aria-label={`Caiu em ${caiu} de ${anos.length} ${anos.length === 1 ? 'prova' : 'provas'}`}
      className="grid h-2.5 w-full gap-0.5"
      style={{ gridTemplateColumns: `repeat(${anos.length}, minmax(0, 1fr))` }}
    >
      {anos.map((ano, i) => {
        const n = porAno[i] ?? 0;
        return (
          <span
            key={ano}
            title={`${ano}: ${n} ${n === 1 ? 'questão' : 'questões'}`}
            className={`rounded-[3px] ${n > 0 ? cor : 'bg-surface-2'}`}
          />
        );
      })}
    </span>
  );
}

/** Ponto de estado do assunto: não depende só da cor (o rótulo vai junto). */
export function PontoDeEstado({ estado }: { estado: MasteryState }) {
  const classe =
    estado === 'dominado'
      ? 'bg-brand'
      : estado === 'praticando'
        ? 'bg-brand/45'
        : 'border border-muted/60 bg-transparent';
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${classe}`} />;
}

/** A conta por trás dos números, aberta sob demanda (sem modal). */
export function ComoCalculamos({ janela }: { janela: IncidenceWindow | null }) {
  return (
    <details id="como-calculamos" className="card group p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display font-bold [&::-webkit-details-marker]:hidden">
        Como calculamos
        <IconChevronDown
          width={16}
          height={16}
          aria-hidden
          className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <dl className="mt-3 space-y-3 text-sm text-pretty">
        <div>
          <dt className="font-semibold">O que cai</dt>
          <dd className="text-muted">
            A média de questões de cada assunto {recorte(janela)}
            {janela && janela.exams > 1 ? ` (${janela.exams} provas)` : ''}.
            Reaplicação, PPL e as outras aplicações ficam fora, para a mesma
            prova não contar duas vezes. Em Língua Estrangeira conta só o seu
            idioma.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">De que assunto é cada questão</dt>
          <dd className="text-muted">
            O INEP não divulga. A classificação é do OpENEM, feita por
            palavras-chave e por IA, e pode errar em uma questão ou outra.
            Por isso os números são uma estimativa.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Quanto você domina</dt>
          <dd className="text-muted">
            Em cada assunto, o seu acerto nas últimas 10 respostas. Com menos
            de 3 respostas o assunto ainda conta zero. Dominado pede pelo menos
            5 respostas e 70% de acerto.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">A porcentagem da matéria</dt>
          <dd className="text-muted">
            Cada assunto pesa o quanto ele cai: dominar o que aparece em toda
            prova vale mais do que dominar o que quase nunca aparece.
          </dd>
        </div>
      </dl>
    </details>
  );
}
