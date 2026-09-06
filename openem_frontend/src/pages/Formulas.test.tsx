// Testes da tela Fórmulas (issue #38).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  symbols: [
    { symbol: 'x', meaning: 'raízes da equação', unit: null },
    { symbol: 'a', meaning: 'coeficiente de x²', unit: null },
    { symbol: '\\Delta', meaning: 'discriminante', unit: 'u.a.' },
  ],
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
  symbols: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Formulas />
    </MemoryRouter>,
  );
}

/**
 * Renderiza e abre todos os grupos: os assuntos começam fechados, então os
 * cards só existem no DOM depois disso.
 */
async function renderExpandido() {
  const r = renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Expandir tudo/ }));
  return r;
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
    await renderExpandido();

    expect(
      await screen.findByText(/Equação do 2º grau/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matemática' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Física' })).toBeInTheDocument();
    // O assunto agora titula um subgrupo dentro da matéria.
    expect(
      screen.getByRole('heading', { name: 'Funções' }),
    ).toBeInTheDocument();
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
    await renderExpandido();

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
  it('o chip "Favoritas" expõe o estado ativo', async () => {
    renderPage();
    const chip = await screen.findByRole('button', { name: /Favoritas/ });
    expect(chip).toHaveAttribute('data-active', 'false');
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chip);
    expect(chip).toHaveAttribute('data-active', 'true');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('desfavoritar no modo "só favoritas" tira a fórmula da lista', async () => {
    vi.mocked(api.toggleFormulaFavorite).mockResolvedValue({ favorited: false });
    vi.mocked(api.formulas).mockResolvedValue([
      { ...BHASKARA, favorited: true },
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Favoritas/ }));
    const star = await screen.findByRole('button', {
      name: /Remover .* dos favoritos/,
    });
    fireEvent.click(star);

    // Antes ficava na lista com a estrela vazia até um reload.
    await waitFor(() =>
      expect(screen.queryByText(/Equação do 2º grau/)).not.toBeInTheDocument(),
    );
  });

  it('copia o LaTeX da fórmula', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await renderExpandido();

    fireEvent.click(
      await screen.findByRole('button', {
        name: `Copiar LaTeX de ${BHASKARA.title}`,
      }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(BHASKARA.latex));
  });

  it('descarta a resposta de uma busca antiga que chegue depois', async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    vi.mocked(api.formulas)
      // 1ª chamada (montagem) fica pendente de propósito.
      .mockImplementationOnce(
        () => new Promise((r) => { resolveSlow = r as (v: unknown) => void; }),
      )
      .mockResolvedValue([OHM]);

    renderPage();
    fireEvent.change(await screen.findByLabelText('Buscar fórmulas'), {
      target: { value: 'ohm' },
    });

    // A busca nova responde primeiro...
    expect(await screen.findByText(/Lei de Ohm/)).toBeInTheDocument();
    // ...e a antiga, ao chegar atrasada, não pode sobrescrever a tela.
    resolveSlow([BHASKARA]);
    await waitFor(() =>
      expect(screen.queryByText(/Equação do 2º grau/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Lei de Ohm/)).toBeInTheDocument();
  });
  it('abre o detalhe da fórmula pela expressão', async () => {
    await renderExpandido();
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Abrir ${BHASKARA.title}`,
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: `Fórmula: ${BHASKARA.title}`,
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Legenda')).toBeInTheDocument();
  });

  it('lista o significado e a unidade de cada símbolo', async () => {
    await renderExpandido();
    fireEvent.click(
      await screen.findByRole('button', { name: `Abrir ${BHASKARA.title}` }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/raízes da equação/)).toBeInTheDocument();
    expect(within(dialog).getByText(/coeficiente de x²/)).toBeInTheDocument();
    // Unidade aparece ao lado do significado quando existe.
    expect(within(dialog).getByText('[u.a.]')).toBeInTheDocument();
  });

  it('fórmula sem legenda abre o detalhe e explica a ausência', async () => {
    await renderExpandido();
    await screen.findByText(/Lei de Ohm/);

    fireEvent.click(screen.getByRole('button', { name: `Abrir ${OHM.title}` }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/ainda não tem legenda cadastrada/),
    ).toBeInTheDocument();
  });

  it('fecha o detalhe com Esc', async () => {
    await renderExpandido();
    fireEvent.click(
      await screen.findByRole('button', { name: `Abrir ${BHASKARA.title}` }),
    );
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('agrupa por matéria e, dentro dela, por assunto', async () => {
    vi.mocked(api.formulas).mockResolvedValue([
      BHASKARA,
      { ...BHASKARA, id: 'f3', title: 'Delta', topicName: 'Funções' },
      {
        ...BHASKARA,
        id: 'f4',
        title: 'Lei dos senos',
        topicName: 'Trigonometria',
      },
    ]);
    renderPage();

    // Uma matéria (h2) com dois assuntos (h3) abaixo.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Matemática' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Funções' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Trigonometria' }),
    ).toBeInTheDocument();
  });

  it('fórmula sem assunto cai no grupo "Outras", no fim', async () => {
    vi.mocked(api.formulas).mockResolvedValue([
      { ...BHASKARA, id: 'f5', title: 'Solta', topicName: null },
      BHASKARA,
    ]);
    renderPage();

    const titulos = await screen.findAllByRole('heading', { level: 3 });
    expect(titulos.map((h) => h.textContent)).toEqual(['Funções', 'Outras']);
  });
  it('assuntos começam fechados e a matéria abre como índice', async () => {
    renderPage();

    // O índice de assuntos aparece...
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Funções' }),
    ).toBeInTheDocument();
    // ...mas os cards ainda não.
    expect(screen.queryByText(/Equação do 2º grau/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Funções/ }));
    expect(await screen.findByText(/Equação do 2º grau/)).toBeInTheDocument();
  });

  it('recolher a matéria esconde os assuntos', async () => {
    renderPage();

    const materia = await screen.findByRole('button', { name: /Matemática/ });
    expect(materia).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(materia);
    expect(materia).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Funções' }),
    ).not.toBeInTheDocument();
  });

  it('"expandir tudo" abre e vira "recolher tudo"', async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: /Expandir tudo/ }),
    );
    expect(screen.getByText(/Equação do 2º grau/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Recolher tudo/ }));
    expect(screen.queryByText(/Equação do 2º grau/)).not.toBeInTheDocument();
  });

  it('busca abre os grupos sozinha', async () => {
    renderPage();
    // Resultado escondido atrás de um grupo fechado faria a busca parecer
    // quebrada.
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Funções' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Equação do 2º grau/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar fórmulas'), {
      target: { value: 'bhaskara' },
    });

    expect(await screen.findByText(/Equação do 2º grau/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Expandir tudo|Recolher tudo/ }),
    ).toBeDisabled();
  });
  it('ordena as matérias com Física e Matemática primeiro', async () => {
    vi.mocked(api.formulas).mockResolvedValue([
      { ...BHASKARA, id: 'b1', subjectName: 'Biologia', topicName: 'Genética' },
      BHASKARA, // Matemática e suas Tecnologias
      OHM, // Física
      { ...BHASKARA, id: 'r1', subjectName: 'Redação', topicName: null },
      { ...BHASKARA, id: 'q1', subjectName: 'Química', topicName: 'Soluções' },
    ]);
    renderPage();

    await screen.findByRole('heading', { level: 2, name: 'Física' });
    const materias = screen.getAllByRole('heading', { level: 2 });
    expect(materias.map((h) => h.textContent)).toEqual([
      'Física',
      'Matemática',
      'Química',
      'Biologia',
      'Redação',
    ]);
  });
});
