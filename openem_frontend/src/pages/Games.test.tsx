// Testes da tela Games (issue #18) — o minigame concentra a lógica de combo,
// vidas e cronômetro e até então não tinha cobertura nenhuma.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Games from './Games';
import { api } from '../api';
import type { GameCatalogItem } from '../api';

vi.mock('../api', () => ({
  api: {
    gameCatalog: vi.fn(),
    gameLeaderboard: vi.fn(),
    globalLeaderboard: vi.fn(),
    submitGameScore: vi.fn(),
  },
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn() }),
}));
vi.mock('../auth', () => ({
  useAuth: () => ({ me: { id: 'u1' } }),
}));

const CALC: GameCatalogItem = {
  key: 'calculo-mental',
  name: 'Cálculo Mental',
  description: 'Resolva operações rápido.',
  scoring: 'Combo + bônus de velocidade.',
  levels: [
    { key: 'facil', label: 'Fácil' },
    { key: 'medio', label: 'Médio' },
  ],
};

/** Jogo presente no catálogo do backend mas ainda sem componente no front. */
const FUTURO: GameCatalogItem = {
  ...CALC,
  key: 'palavras-cruzadas',
  name: 'Palavras Cruzadas',
};

/** Inicia uma partida no nível fácil (8s por rodada). */
async function startGame() {
  const jogar = await screen.findByRole('button', { name: /Jogar/ });
  await act(async () => {
    fireEvent.click(jogar);
  });
}

function lives(): string | undefined {
  return (document.body.textContent ?? '').match(/(\d+) vidas/)?.[1];
}

describe('Games (issue #18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.gameCatalog).mockResolvedValue([CALC]);
    vi.mocked(api.gameLeaderboard).mockResolvedValue([]);
    vi.mocked(api.globalLeaderboard).mockResolvedValue([]);
    vi.mocked(api.submitGameScore).mockResolvedValue({
      id: 'gs1',
      gameKey: 'calculo-mental',
      score: 2,
      level: 1,
      durationSec: 1,
      createdAt: new Date().toISOString(),
    });
    // Math.random fixo: no nível fácil o problema vira sempre "1 + 1".
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('um timeout de rodada custa exatamente uma vida sob StrictMode', async () => {
    // Regressão: efeitos dentro do updater de setTimeLeft faziam o StrictMode
    // invocá-lo duas vezes e a rodada descontava 2 vidas de uma vez.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <StrictMode>
        <Games />
      </StrictMode>,
    );
    await startGame();
    expect(lives()).toBe('3');

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(lives()).toBe('2');
  });

  it('acertar pontua e "Encerrar" registra a pontuação em vez de descartá-la', async () => {
    render(<Games />);
    await startGame();

    expect(await screen.findByLabelText('1 + 1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sua resposta'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Acerto em < 3s dobra os pontos da rodada: (1 + combo 0) * 2 = 2.
    expect(await screen.findByText('Acertou! +2 pts')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    });

    await waitFor(() =>
      expect(api.submitGameScore).toHaveBeenCalledWith(
        'calculo-mental',
        2,
        expect.any(Number),
        expect.any(Number),
      ),
    );
    expect(
      await screen.findByText('Pontuação registrada: 2 pts.'),
    ).toBeInTheDocument();
  });

  it('errar desconta vida e revela a resposta', async () => {
    render(<Games />);
    await startGame();

    fireEvent.change(await screen.findByLabelText('Sua resposta'), {
      target: { value: '99' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Resposta: 2')).toBeInTheDocument();
    expect(lives()).toBe('2');
  });

  it('um jogo do catálogo sem implementação não abre o jogo errado', async () => {
    // Regressão: qualquer item do catálogo renderizava o Cálculo Mental e
    // gravava a pontuação na chave 'calculo-mental'.
    vi.mocked(api.gameCatalog).mockResolvedValue([FUTURO]);
    render(<Games />);

    const botao = await screen.findByRole('button', { name: /Em breve/ });
    expect(botao).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Jogar$/ })).toBeNull();
  });

  it('busca um ranking por jogo do catálogo', async () => {
    vi.mocked(api.gameCatalog).mockResolvedValue([CALC, FUTURO]);
    render(<Games />);

    await waitFor(() => {
      expect(api.gameLeaderboard).toHaveBeenCalledWith('calculo-mental', 10);
      expect(api.gameLeaderboard).toHaveBeenCalledWith('palavras-cruzadas', 10);
    });
    expect(
      await screen.findByRole('heading', { name: 'Ranking — Palavras Cruzadas' }),
    ).toBeInTheDocument();
  });

  it('mostra erro quando o catálogo falha', async () => {
    vi.mocked(api.gameCatalog).mockRejectedValue(new Error('Falha na rede'));
    render(<Games />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na rede');
  });
});
