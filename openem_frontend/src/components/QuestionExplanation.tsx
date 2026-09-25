import { useState } from 'react';
import { api } from '../api';
import { Markdown } from './Markdown';

/**
 * Comentário de uma questão depois de respondida.
 *
 * As provas oficiais do ENEM chegam sem comentário. Quando não há um, o aluno
 * pode pedir: o backend gera por IA (se houver provedor configurado) e grava
 * para os próximos. O pedido é explícito, e não automático ao responder,
 * porque a geração leva alguns segundos e custa uma chamada paga.
 */
export function QuestionExplanation({
  questionId,
  explanation,
  source,
  offline = false,
  className = '',
}: {
  questionId: string;
  explanation: string | null | undefined;
  source?: string | null;
  /** Resposta enfileirada sem rede: não há como buscar o comentário agora. */
  offline?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState(explanation || null);
  const [origem, setOrigem] = useState(source ?? null);
  const [estado, setEstado] = useState<
    'idle' | 'carregando' | 'indisponivel' | 'erro'
  >('idle');

  async function pedir() {
    setEstado('carregando');
    try {
      const res = await api.explanation(questionId);
      if (res.explanation) {
        setTexto(res.explanation);
        setOrigem(res.source);
        setEstado('idle');
      } else {
        setEstado('indisponivel');
      }
    } catch {
      setEstado('erro');
    }
  }

  const base = `mt-1 text-sm leading-relaxed text-muted ${className}`;

  if (texto) {
    return (
      <div>
        <Markdown className={base}>{texto}</Markdown>
        {origem?.startsWith('ai:') && (
          // Num app de estudo, o aluno precisa saber que o texto pode errar.
          <p className="mt-2 text-xs text-muted">
            Comentário gerado por IA, pode conter erros. O gabarito é o oficial.
          </p>
        )}
      </div>
    );
  }

  if (offline) {
    return (
      <p className={base}>
        Sem conexão: o comentário fica disponível quando você voltar a ficar
        online.
      </p>
    );
  }

  if (estado === 'indisponivel') {
    return <p className={base}>Esta questão ainda não tem comentário.</p>;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void pedir()}
        disabled={estado === 'carregando'}
        className="btn btn-ghost text-sm"
      >
        {estado === 'carregando' ? 'Gerando comentário…' : 'Ver comentário'}
      </button>
      {estado === 'erro' && (
        <p className="mt-1 text-xs text-danger">
          Não foi possível carregar o comentário agora. Tente de novo.
        </p>
      )}
    </div>
  );
}
