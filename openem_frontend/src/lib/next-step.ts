import type { Recommendation, StudySession } from '../api';

/** A única ação que a Home sugere: o que fazer agora. */
export interface ProximoPasso {
  tipo: 'revisao' | 'cronograma' | 'recomendacao' | 'comecar';
  titulo: string;
  descricao: string;
  acao: string;
  to: string;
}

/**
 * Escolhe o próximo passo, nesta ordem: revisão vencida (esquecer custa mais
 * a cada dia), o bloco de hoje do cronograma (o plano que o aluno fez),
 * um assunto fraco recomendado pelos erros recentes e, sem nada disso,
 * começar pelas questões.
 */
export function proximoPasso({
  vencidas,
  hoje,
  recomendacao,
}: {
  vencidas: number;
  hoje: StudySession[];
  recomendacao: Recommendation | null;
}): ProximoPasso {
  if (vencidas > 0) {
    return {
      tipo: 'revisao',
      titulo:
        vencidas === 1
          ? '1 assunto para revisar'
          : `${vencidas} assuntos para revisar`,
      descricao:
        'A revisão espaçada venceu: revisar agora custa menos do que reaprender depois.',
      acao: 'Revisar agora',
      to: '/revisao',
    };
  }

  const pendente = hoje.find((s) => !s.done);
  if (pendente) {
    const feitos = hoje.filter((s) => s.done).length;
    return {
      tipo: 'cronograma',
      titulo: `Hoje no cronograma: ${pendente.label}`,
      descricao:
        feitos > 0
          ? `${pendente.minutes} min. Você já fez ${feitos} de ${hoje.length} blocos hoje.`
          : `${pendente.minutes} min, o primeiro de ${hoje.length} ${hoje.length === 1 ? 'bloco' : 'blocos'} de hoje.`,
      acao: 'Abrir cronograma',
      to: '/cronograma',
    };
  }

  const topico = recomendacao?.question.topic;
  if (recomendacao && topico) {
    return {
      tipo: 'recomendacao',
      titulo: `Reforce ${topico.name}`,
      descricao: recomendacao.reason,
      acao: 'Treinar este assunto',
      to: `/questoes?topicId=${encodeURIComponent(topico.id)}`,
    };
  }

  return {
    tipo: 'comecar',
    titulo: 'Responda questões do ENEM',
    descricao:
      'Provas oficiais com gabarito. Cada resposta alimenta sua revisão e seu desempenho.',
    acao: 'Começar',
    to: '/questoes',
  };
}
