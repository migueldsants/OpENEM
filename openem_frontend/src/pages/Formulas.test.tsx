// Testes da tela Fórmulas (issue #38).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Formulas from './Formulas';
import { api } from '../api';
import type { Formula } from '../api';

vi.mock('../api', () => ({
  api: {
    formulas: vi.fn(),
    subjects: vi.fn(),
    toggleFormulaFavorite: vi.fn(),
  },
}));
// O render LaTeX real (KaTeX lazy) não é o alvo deste teste.
vi.mock('../board/Katex', () => ({
  Katex: ({ latex }: { latex: string }) => <code data-testid="katex">{latex}</code>,
}));

const BHASKARA: Formula = {
  id: 'f1',
  title: 'Equação do 2º grau (Bhaskara)',
  latex: 'x = \\frac{-b}{2a}',
  description: 'Raízes de ax² + bx + c = 0.',
  subjectId: 's1',
  subjectName: 'Matemática e suas Tecnologias',
  topicId: 't1',
  topicName: 'Funções',
  isBuiltIn: true,
  favorited: false,
};

const OHM: Formula = {
  ...BHASKARA,
  id: 'f2',
  title: '1ª Lei de Ohm',
  latex: 'U = Ri',
  description: null,
  subjectId: 's2',
  subjectName: 'Física',
  topicId: null,
  topicName: null,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Formulas />
    </MemoryRouter>,
  );
}

describe('Formulas (issue #38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.subjects).mockResolvedValue([
      {
        id: 's1',
        name: 'Matemática e suas Tecnologias',
        topics: [],
      },
    ] as never);
    vi.mocked(api.formulas).mockResolvedValue([BHASKARA, OHM]);
  });

  it('lista fórmulas agrupadas por matéria com título e assunto', async () => {
    renderPage();

    expect(
      await screen.findByText(/Equação do 2º grau/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matemática' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Física' })).toBeInTheDocument();
    expect(screen.getByText(/Assunto: Funções/)).toBeInTheDocument();
  });

  it('busca por texto chama a API com o termo (debounce ~250ms)', async () => {
    renderPage();
    const input = await screen.findByLabelText('Buscar fórmulas');
    fireEvent.change(input, { target: { value: 'ohm' } });

    // Debounce da tela: espera a chamada chegar com o termo.
    await waitFor(
      () =>
        expect(api.formulas).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'ohm' }),
        ),
      { timeout: 2000 },
    );
  });

  it('filtro de favoritas repassa onlyFavorites', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Favoritas/ }));

    await waitFor(() =>
      expect(api.formulas).toHaveBeenCalledWith(
        expect.objectContaining({ onlyFavorites: true }),
      ),
    );
  });

  it('favoritar é otimista e chama o toggle', async () => {
    vi.mocked(api.toggleFormulaFavorite).mockResolvedValue({ favorited: true });
    renderPage();

    const star = await screen.findByRole('button', {
      name: /Favoritar Equação/,
    });
    fireEvent.click(star);

    await waitFor(() =>
      expect(api.toggleFormulaFavorite).toHaveBeenCalledWith('f1'),
    );
    // Otimista: já aparece como removível.
    expect(
      screen.getByRole('button', { name: /Remover Equação/ }),
    ).toBeInTheDocument();
  });

  it('estado vazio quando não há resultados', async () => {
    vi.mocked(api.formulas).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
  });

  it('exibe erro quando a API falha', async () => {
    vi.mocked(api.formulas).mockRejectedValue(new Error('Falha na rede'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falha na rede');
  });
});