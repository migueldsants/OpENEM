/**
 * Tela Matérias (discussão #122): estado das etapas da trilha, o "já sei
 * isso" e a formatação dos números. Lógica pura e testada; a incidência e o
 * domínio vêm prontos do backend (`GET /tracks`).
 */
import type {
  IncidenceWindow,
  MasteryState,
  SimulationFilters,
  TrackStageSummary,
} from '../api';

/** Questões do simulado de uma etapa. */
export const QUESTOES_DA_ETAPA = 10;

/**
 * A partir de quantas respostas com assunto a tela mostra a porcentagem
 * geral. Espelha `OVERALL_MIN_ANSWERS` do backend (`common/mastery.ts`), que
 * é quem decide (`overall.enough`); aqui é só o texto.
 */
export const RESPOSTAS_PARA_PORCENTAGEM = 30;

export type EstadoDaEtapa =
  | 'concluida'
  | 'pulada'
  | 'atual'
  | 'futura'
  | 'sem-questoes';

/**
 * Etapa atual: a primeira que tem questão no banco, não foi concluída e o
 * aluno não marcou como "já sei isso". null quando a trilha acabou.
 */
export function etapaAtual(
  etapas: readonly TrackStageSummary[],
  puladas: ReadonlySet<string>,
): number | null {
  const i = etapas.findIndex(
    (e) => e.practicable && !e.done && !puladas.has(e.title),
  );
  return i < 0 ? null : i;
}

export function estadoDaEtapa(
  etapa: TrackStageSummary,
  indice: number,
  atual: number | null,
  puladas: ReadonlySet<string>,
): EstadoDaEtapa {
  if (etapa.done) return 'concluida';
  if (puladas.has(etapa.title)) return 'pulada';
  if (!etapa.practicable) return 'sem-questoes';
  return indice === atual ? 'atual' : 'futura';
}

export function etapasFeitas(
  etapas: readonly TrackStageSummary[],
  puladas: ReadonlySet<string>,
): number {
  return etapas.filter((e) => e.done || puladas.has(e.title)).length;
}

/** O que "Treinar etapa" manda ao `POST /simulations`. */
export function filtrosDaEtapa(topicIds: readonly string[]): SimulationFilters {
  return { topicIds: [...topicIds], questionCount: QUESTOES_DA_ETAPA };
}

// ── "Já sei isso" ──────────────────────────────────────────────────────────
// Fica neste aparelho, por aluno: a chave leva o id para que, num celular da
// família, a trilha de um irmão não pule as etapas do outro. Guardamos o
// título da etapa, não a posição, para uma etapa nova no catálogo não herdar
// a marca de outra.

const PREFIXO = 'openem.trilhas.puladas';

export type Puladas = Record<string, string[]>;

function chave(userId: string): string {
  return `${PREFIXO}:${userId}`;
}

export function lerPuladas(userId: string | undefined): Puladas {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(chave(userId));
    if (!raw) return {};
    const dado = JSON.parse(raw) as unknown;
    if (!dado || typeof dado !== 'object' || Array.isArray(dado)) return {};
    const out: Puladas = {};
    for (const [materia, titulos] of Object.entries(dado)) {
      if (Array.isArray(titulos)) {
        out[materia] = titulos.filter((t): t is string => typeof t === 'string');
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function gravarPuladas(userId: string | undefined, puladas: Puladas): void {
  if (!userId) return;
  try {
    localStorage.setItem(chave(userId), JSON.stringify(puladas));
  } catch {
    // Armazenamento cheio ou bloqueado: a marca vale só nesta visita.
  }
}

/** Liga ou desliga o "já sei isso" de uma etapa. */
export function alternarPulada(
  puladas: Puladas,
  subjectId: string,
  titulo: string,
): Puladas {
  const atuais = new Set(puladas[subjectId] ?? []);
  if (atuais.has(titulo)) atuais.delete(titulo);
  else atuais.add(titulo);
  const out = { ...puladas };
  if (atuais.size) out[subjectId] = [...atuais];
  else delete out[subjectId];
  return out;
}

// ── Números ────────────────────────────────────────────────────────────────

/** "4,8"; abaixo de 0,05, "0". Uma casa basta: é estimativa. */
export function decimal(n: number): string {
  const v = n < 0.05 ? 0 : n;
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: v >= 10 || Number.isInteger(v) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

/** "4,8 por prova", "1 por prova", "não caiu". */
export function porProva(n: number): string {
  if (n < 0.05) return 'não caiu';
  return `${decimal(n)} por prova`;
}

/** "45 questões por prova" (rótulo de matéria). */
export function questoesPorProva(n: number): string {
  if (n < 0.05) return 'não caiu nas provas recentes';
  const d = decimal(n);
  return `${d} ${d === '1' ? 'questão' : 'questões'} por prova`;
}

/** "10 de 10 provas". */
export function rotuloAnos(anos: number, provas: number): string {
  return `${anos} de ${provas} ${provas === 1 ? 'prova' : 'provas'}`;
}

/** "nas provas regulares de 2016 a 2025". */
export function recorte(janela: IncidenceWindow | null): string {
  if (!janela) return 'nas provas regulares do banco';
  if (janela.fromYear === janela.toYear) {
    return `na prova regular de ${janela.fromYear}`;
  }
  return `nas provas regulares de ${janela.fromYear} a ${janela.toYear}`;
}

export const ROTULO_DO_ESTADO: Record<MasteryState, string> = {
  'nao-visto': 'não visto',
  praticando: 'praticando',
  dominado: 'dominado',
};

/** Ordem da prova: dia 1 (Linguagens, Humanas), dia 2 (Natureza, Matemática). */
export const ORDEM_DAS_AREAS = ['lin', 'hum', 'nat', 'mat'] as const;
