import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type Formula } from '../api';
import { FormulasPdfModal } from './FormulasPdfModal';

vi.mock('../api', () => ({
  api: {
    formulas: vi.fn(),
    pdfThemes: vi.fn(),
    formulasPdf: vi.fn(),
  },
}));

const f = (id: string, over: Partial<Formula> = {}): Formula => ({
  id,
  title: `Fórmula ${id}`,
  latex: 'x',
  description: null,
  subjectId: 'mat',
  subjectName: 'Matemática',
  topicId: 't1',
  topicName: 'Funções',
  isBuiltIn: true,
  favorited: false,
  symbols: [],
  ...over,
});

const LISTA = [
  f('a'),
  f('b', { topicId: 't2', topicName: 'Porcentagem', favorited: true }),
  f('c', { subjectId: 'fis', subjectName: 'Física', topicId: 't3', topicName: 'Cinemática' }),
];

/** O contador do rodapé (região viva): "3 fórmulas · 2 matérias". */
const contador = () =>
  document.querySelector('[aria-live="polite"]')?.textContent ?? '';

describe('FormulasPdfModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.formulas).mockResolvedValue(LISTA);
    vi.mocked(api.pdfThemes).mockResolvedValue([
      { key: 'default', label: 'Padrão', brand: '#e0234e', surface: '#fff' },
    ]);
    vi.mocked(api.formulasPdf).mockResolvedValue({
      blob: new Blob(['%PDF']),
      filename: 'formulas.pdf',
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('abre com tudo marcado e manda a lista exata e as opções', async () => {
    const onClose = vi.fn();
    render(<FormulasPdfModal onClose={onClose} />);
    await waitFor(() => expect(contador()).toMatch(/^3 fórmulas · 2 matérias/));

    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }));
    await waitFor(() => expect(api.formulasPdf).toHaveBeenCalled());
    expect(vi.mocked(api.formulasPdf).mock.calls[0][0]).toMatchObject({
      formulaIds: ['a', 'b', 'c'],
      title: 'Fórmulas do ENEM',
      theme: 'default',
      cover: true,
      toc: true,
      legend: true,
      descriptions: true,
      twoColumns: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('abre só com a matéria filtrada na tela', async () => {
    render(<FormulasPdfModal onClose={() => {}} initialSubjectId="fis" />);
    await screen.findByText('Física');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }));
    await waitFor(() =>
      expect(vi.mocked(api.formulasPdf).mock.calls[0][0].formulaIds).toEqual(['c']),
    );
  });

  it('desmarcar matéria, assunto e ligar "só favoritas" muda o que vai', async () => {
    render(<FormulasPdfModal onClose={() => {}} />);
    await screen.findByText('Matemática');

    // Tira Física inteira e o assunto Funções de Matemática.
    fireEvent.click(screen.getByRole('checkbox', { name: /Física/ }));
    fireEvent.click(screen.getByRole('button', { name: /Funções/ }));
    expect(contador()).toMatch(/^1 fórmula · 1 matéria/);

    fireEvent.click(screen.getByRole('checkbox', { name: /Só as minhas favoritas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }));
    await waitFor(() =>
      expect(vi.mocked(api.formulasPdf).mock.calls[0][0].formulaIds).toEqual(['b']),
    );
  });

  it('sem nenhuma fórmula, o botão fica travado e explica', async () => {
    render(<FormulasPdfModal onClose={() => {}} />);
    await screen.findByText('Matemática');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('Nenhuma fórmula escolhida')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar PDF' })).toBeDisabled();
  });

  it('fórmula por fórmula: desmarcar tira só aquela', async () => {
    render(<FormulasPdfModal onClose={() => {}} />);
    await screen.findByText('Matemática');
    fireEvent.click(screen.getByRole('button', { name: /Escolher fórmula por fórmula/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Fórmula a/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }));
    await waitFor(() =>
      expect(vi.mocked(api.formulasPdf).mock.calls[0][0].formulaIds).toEqual(['b', 'c']),
    );
  });
});
