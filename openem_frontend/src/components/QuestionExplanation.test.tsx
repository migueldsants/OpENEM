import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionExplanation } from './QuestionExplanation';
import { api } from '../api';

vi.mock('../api', () => ({
  api: { explanation: vi.fn() },
}));

const mockExplanation = api.explanation as unknown as ReturnType<typeof vi.fn>;

describe('QuestionExplanation', () => {
  beforeEach(() => {
    mockExplanation.mockReset();
  });

  it('mostra o comentário existente sem chamar a API', () => {
    render(
      <QuestionExplanation
        questionId="q1"
        explanation="Porque **sim**."
        source="humano"
      />,
    );
    expect(screen.getByText('sim')).toBeTruthy();
    expect(screen.queryByText(/gerado por IA/)).toBeNull();
    expect(mockExplanation).not.toHaveBeenCalled();
  });

  it('avisa quando o comentário foi gerado por IA', () => {
    render(
      <QuestionExplanation
        questionId="q1"
        explanation="Comentário."
        source="ai:anthropic"
      />,
    );
    expect(screen.getByText(/gerado por IA/)).toBeTruthy();
  });

  it('sem comentário, oferece o botão e busca ao clicar', async () => {
    mockExplanation.mockResolvedValue({
      explanation: 'Gerado agora.',
      source: 'ai:gemini',
      available: true,
    });
    render(<QuestionExplanation questionId="q1" explanation={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver comentário' }));

    await waitFor(() => expect(screen.getByText('Gerado agora.')).toBeTruthy());
    expect(mockExplanation).toHaveBeenCalledWith('q1');
    expect(screen.getByText(/gerado por IA/)).toBeTruthy();
  });

  it('sem provedor de IA, diz que não há comentário', async () => {
    mockExplanation.mockResolvedValue({
      explanation: null,
      source: null,
      available: false,
    });
    render(<QuestionExplanation questionId="q1" explanation={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver comentário' }));

    await waitFor(() =>
      expect(screen.getByText(/ainda não tem comentário/)).toBeTruthy(),
    );
  });

  it('em caso de erro, permite tentar de novo', async () => {
    mockExplanation.mockRejectedValue(new Error('rede'));
    render(<QuestionExplanation questionId="q1" explanation={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver comentário' }));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível carregar/)).toBeTruthy(),
    );
    // O botão continua lá para uma nova tentativa.
    expect(screen.getByRole('button', { name: 'Ver comentário' })).toBeTruthy();
  });

  it('offline, não oferece o botão (a chamada falharia)', () => {
    render(
      <QuestionExplanation questionId="q1" explanation={null} offline />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Sem conexão/)).toBeTruthy();
  });
});
