// Testes do quadro da sala (simulado no papel).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QuadroProvaCard } from './QuadroProva';
import { chime } from '../sound';

vi.mock('../sound', () => ({ chime: vi.fn() }));

const MIN = 60_000;
const INICIO = new Date(2026, 10, 8, 13, 30, 0);
const KEY = 'openem.quadro-prova';

function avancar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function marca(texto: string) {
  const li = screen
    .getAllByText(texto)
    .find((el) => el.tagName === 'LI' && el.hasAttribute('data-apagada'));
  if (!li) throw new Error(`marca ${texto} não encontrada`);
  return li;
}

describe('QuadroProvaCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('abre o quadro com início, término e a duração do 1º dia', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));

    const quadro = screen.getByRole('dialog', { name: 'Quadro da sala' });
    expect(quadro).toHaveTextContent('Início13h30');
    expect(quadro).toHaveTextContent('Término19h00');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tempo restante: 5h30',
    );
    expect(quadro).toHaveTextContent('Saída da sala: a partir das 15h30');
    expect(quadro).toHaveTextContent(
      'Levar o caderno de questões: a partir das 18h30',
    );
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      startedAt: INICIO.getTime(),
      durationMin: 330,
      intervalMin: 30,
    });
  });

  it('apaga a marca a cada intervalo, e não antes', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));

    avancar(29 * MIN);
    expect(screen.getByRole('status')).toHaveTextContent('5h30');
    expect(marca('5h30')).toHaveAttribute('data-apagada', 'false');

    avancar(1 * MIN);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tempo restante: 5h',
    );
    expect(marca('5h30')).toHaveAttribute('data-apagada', 'true');
    expect(marca('5h')).toHaveAttribute('data-apagada', 'false');
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Atualizado às 14h00 · próxima atualização às 14h30',
    );
  });

  it('libera a saída depois de 2 horas', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));
    avancar(120 * MIN);
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Saída da sala: liberado',
    );
  });

  it('avisa o fim do tempo e toca uma vez', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Dia 2 · 5h' }));
    fireEvent.click(screen.getByRole('button', { name: '1h' }));
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));
    expect(screen.getByRole('status')).toHaveTextContent('Tempo restante: 5h');

    avancar(300 * MIN);
    expect(screen.getByRole('status')).toHaveTextContent('Tempo esgotado');
    expect(chime).toHaveBeenCalledTimes(1);
    avancar(5 * MIN);
    expect(chime).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar quadro' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('aceita uma duração própria', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Outro' }));
    fireEvent.change(screen.getByLabelText('Tempo de prova em minutos'), {
      target: { value: '90' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));

    const quadro = screen.getByRole('dialog');
    expect(quadro).toHaveTextContent('Término15h00');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tempo restante: 1h30',
    );
    // Simulado curto não tem as regras de saída do ENEM.
    expect(quadro).not.toHaveTextContent('Saída da sala');
  });

  it('minimizar mantém a prova correndo; encerrar pede confirmação', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByText('Quadro ativo · das 13h30 às 19h00'),
    ).toBeInTheDocument();

    avancar(60 * MIN);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir quadro' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tempo restante: 4h30',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Encerrar prova' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar mesmo?' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Começar prova' }),
    ).toBeInTheDocument();
  });

  it('retoma o quadro salvo depois de recarregar a página', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        startedAt: INICIO.getTime() - 45 * MIN,
        durationMin: 300,
        intervalMin: 15,
      }),
    );
    render(<QuadroProvaCard />);
    expect(
      screen.getByText('Quadro ativo · das 12h45 às 17h45'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir quadro' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tempo restante: 4h15',
    );
  });

  it('mostra o relógio exato só quando o aluno pede', () => {
    render(<QuadroProvaCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar prova' }));
    avancar(10 * MIN);
    expect(screen.queryByText('5:20:00')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar relógio' }));
    expect(screen.getByText('5:20:00')).toBeInTheDocument();
  });
});
