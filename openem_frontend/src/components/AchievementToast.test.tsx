// Testes do toast de conquista (issue #48).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AchievementToastHost,
  AchievementToasts,
  limparConquistas,
} from './AchievementToast';
import type { Achievement } from '../api';

const ACH: Achievement = {
  code: 'FIRST_ANSWER',
  name: 'Primeiro passo',
  description: 'Responda sua primeira questão.',
  xp: 50,
  icon: 'pencil',
  color: 'text-brand',
};

// A fila é global (sobrevive à tela que a disparou): cada teste começa vazio.
afterEach(() => act(() => limparConquistas()));

describe('AchievementToasts (issue #48)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não renderiza nada com lista vazia', () => {
    const { container } = render(<AchievementToasts list={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra nome, ícone e XP da conquista desbloqueada', async () => {
    vi.useRealTimers();
    render(<AchievementToasts list={[ACH]} />);
    expect(
      await screen.findByText('Conquista desbloqueada'),
    ).toBeInTheDocument();
    expect(screen.getByText('Primeiro passo')).toBeInTheDocument();
    // O ícone é vetorial (antes era um emoji em texto).
    const toast = screen.getByText('Primeiro passo').closest('[role="status"]')!;
    expect(toast.querySelector('span svg')).not.toBeNull();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('empilha múltiplas conquistas', async () => {
    vi.useRealTimers();
    render(
      <AchievementToasts
        list={[
          ACH,
          { ...ACH, code: 'STREAK_3', name: 'Pegando o ritmo', icon: 'flame' },
        ]}
      />,
    );
    expect(await screen.findByText('Primeiro passo')).toBeInTheDocument();
    expect(screen.getByText('Pegando o ritmo')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('some após ~5 segundos', () => {
    // Relógio falso: esperar 5 s de verdade falhava com a máquina ocupada.
    render(<AchievementToasts list={[ACH]} />);
    expect(screen.getByText('Primeiro passo')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Primeiro passo')).toBeInTheDocument();
    // Dois tempos: aos 4,3 s começa a sair; o sumiço é agendado só depois
    // desse render, e acontece 0,6 s mais tarde.
    act(() => vi.advanceTimersByTime(500));
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByText('Primeiro passo')).not.toBeInTheDocument();
  });
});
describe('AchievementToasts — host global', () => {
  it('o botão fechar tira o toast antes do tempo', async () => {
    render(<AchievementToasts list={[{ ...ACH, code: 'CLOSE_ME', name: 'Fecha' }]} />);
    const fechar = await screen.findByRole('button', { name: 'Fechar' });
    fireEvent.click(fechar);
    await waitFor(() => expect(screen.queryByText('Fecha')).not.toBeInTheDocument());
  });

  it('continua na tela quando quem disparou desmonta (ex.: "Próxima" questão)', async () => {
    render(<AchievementToastHost />);
    const origem = render(
      <AchievementToasts list={[{ ...ACH, code: 'SURVIVE', name: 'Sobrevive' }]} />,
    );
    expect(await screen.findByText('Sobrevive')).toBeInTheDocument();
    origem.unmount();
    expect(screen.getByText('Sobrevive')).toBeInTheDocument();
  });
});
