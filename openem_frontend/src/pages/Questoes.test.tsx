// Filtros do banco de questões: área → matéria → assunto, prova e código.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Questoes from './Questoes';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    subjects: vi.fn(),
    favorites: vi.fn(),
    questionNotes: vi.fn(),
    exams: vi.fn(),
    questionFacets: vi.fn(),
    questions: vi.fn(),
    answer: vi.fn(),
  },
}));
vi.mock('../auth', () => ({
  useAuth: () => ({ me: { profile: { foreignLanguage: 'espanhol' } } }),
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn(), summary: null }),
}));

const AREA_LIN = { id: 'a-lin', name: 'Linguagens, Códigos e suas Tecnologias' };
const AREA_MAT = { id: 'a-mat', name: 'Matemática e suas Tecnologias' };

const SUBJECTS = [
  {
    id: 's-le',
    name: 'Língua Estrangeira',
    subjectArea: AREA_LIN,
    topics: [
      { id: 't-ing', name: 'Interpretação de texto em inglês' },
      { id: 't-esp', name: 'Interpretação de texto em espanhol' },
    ],
  },
  {
    id: 's-mat',
    name: 'Matemática',
    subjectArea: AREA_MAT,
    topics: [{ id: 't-func', name: 'Funções' }],
  },
  {
    id: 's-red',
    name: 'Redação',
    subjectArea: AREA_LIN,
    topics: [{ id: 't-arg', name: 'Argumentação' }],
  },
];

const QUESTAO = {
  id: 'q1',
  code: 'ENEM-2023-136',
  number: 136,
  statement: 'Enunciado da questão.',
  questionPrompt: null,
  difficulty: 3,
  source: 'ENEM_DEV',
  language: null,
  topic: null,
  subjectArea: AREA_MAT,
  examYear: { year: 2023, slug: '2023', label: 'ENEM 2023' },
  alternatives: [
    { id: 'a1', letter: 'A', text: 'um', imageUrl: null },
    { id: 'a2', letter: 'B', text: 'dois', imageUrl: null },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Questoes />
    </MemoryRouter>,
  );
}

function ultimaBusca() {
  const chamadas = vi.mocked(api.questions).mock.calls;
  return chamadas[chamadas.length - 1][0]!;
}

describe('Questões — filtros e busca por código', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.favorites).mockResolvedValue([]);
    vi.mocked(api.questionNotes).mockResolvedValue([]);
    vi.mocked(api.exams).mockResolvedValue([
      { slug: '2023', year: 2023, label: 'ENEM 2023' },
      { slug: '2022', year: 2022, label: 'ENEM 2022' },
    ]);
    vi.mocked(api.questionFacets).mockResolvedValue({
      total: 1000,
      areas: [
        { id: 'a-lin', count: 400 },
        { id: 'a-mat', count: 600 },
      ],
      // Só a LE está classificada: Matemática e Redação não têm assunto com questão.
      topics: [{ id: 't-esp', count: 90 }],
      exams: [{ slug: '2023', count: 180 }],
    });
    vi.mocked(api.questions).mockResolvedValue({
      items: [QUESTAO],
      meta: { total: 1, page: 1, limit: 10, pages: 1 },
    } as never);
  });

  it('busca na língua estrangeira do perfil e mostra o código da questão', async () => {
    renderPage();
    expect(await screen.findByText('ENEM-2023-136')).toBeInTheDocument();
    expect(ultimaBusca().language).toBe('espanhol');
    expect(api.questionFacets).toHaveBeenCalledWith('espanhol');
    // Questão oficial não mostra o "nível 3" padrão.
    expect(screen.queryByText(/nível/)).not.toBeInTheDocument();
  });

  it('a busca por código vai para a API depois de o aluno parar de digitar', async () => {
    renderPage();
    await screen.findByText('ENEM-2023-136');

    fireEvent.change(screen.getByLabelText('Buscar questão pelo código'), {
      target: { value: '2023 136' },
    });

    await waitFor(() => expect(ultimaBusca().code).toBe('2023 136'));
  });

  it('o painel mostra só matérias e assuntos com questão, com a contagem', async () => {
    renderPage();
    await screen.findByText('ENEM-2023-136');
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    const painel = within(await screen.findByRole('dialog', { name: 'Filtros' }));

    // Áreas com a contagem de questões.
    expect(painel.getByRole('button', { name: /^Matemática 600/ })).toBeInTheDocument();
    // LE tem assunto com questão; Matemática e Redação, não.
    expect(painel.getByRole('button', { name: /Língua Estrangeira/ })).toBeInTheDocument();
    expect(painel.queryByRole('button', { name: /^Redação/ })).not.toBeInTheDocument();

    fireEvent.click(painel.getByRole('button', { name: /Língua Estrangeira/ }));
    // Só o assunto com questões aparece (espanhol), não o de inglês.
    expect(
      painel.getByRole('button', { name: /Interpretação de texto em espanhol/ }),
    ).toBeInTheDocument();
    expect(
      painel.queryByRole('button', { name: /Interpretação de texto em inglês/ }),
    ).not.toBeInTheDocument();
  });

  it('área sem matéria classificada explica o porquê e sugere área e prova', async () => {
    renderPage();
    await screen.findByText('ENEM-2023-136');
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    const painel = within(await screen.findByRole('dialog', { name: 'Filtros' }));

    fireEvent.click(painel.getByRole('button', { name: /^Matemática 600/ }));

    expect(painel.getByText(/ainda não foram classificadas por matéria/)).toBeInTheDocument();
  });

  it('aplicar área e prova manda os dois filtros para a API', async () => {
    renderPage();
    await screen.findByText('ENEM-2023-136');
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    const painel = within(await screen.findByRole('dialog', { name: 'Filtros' }));

    fireEvent.click(painel.getByRole('button', { name: /^Matemática 600/ }));
    fireEvent.change(painel.getByLabelText('Prova'), { target: { value: '2023' } });
    fireEvent.click(painel.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => {
      expect(ultimaBusca().subjectAreaId).toBe('a-mat');
      expect(ultimaBusca().examSlug).toBe('2023');
    });
  });
});

describe('Questões — responder pelo teclado e leitor de tela', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.favorites).mockResolvedValue([]);
    vi.mocked(api.questionNotes).mockResolvedValue([]);
    vi.mocked(api.exams).mockResolvedValue([]);
    vi.mocked(api.questionFacets).mockResolvedValue({
      total: 1,
      areas: [],
      topics: [],
      exams: [],
    });
    vi.mocked(api.questions).mockResolvedValue({
      items: [QUESTAO],
      meta: { total: 1, page: 1, limit: 10, pages: 1 },
    } as never);
    vi.mocked(api.answer).mockResolvedValue({
      isCorrect: false,
      correctAlternativeId: 'a2',
      explanation: null,
    } as never);
  });

  it('anuncia o erro com a letra certa e o foco continua no botão de ação', async () => {
    renderPage();
    await screen.findByText('ENEM-2023-136');

    const alternativa = screen.getByRole('button', { name: /um/ });
    fireEvent.click(alternativa);
    expect(alternativa).toHaveAttribute('aria-pressed', 'true');

    const acao = screen.getByRole('button', { name: 'Responder' });
    acao.focus();
    fireEvent.click(acao);

    expect(
      await screen.findByText('Não foi dessa vez. A resposta certa é a B.'),
    ).toHaveAttribute('aria-live', 'polite');
    // O mesmo elemento vira "Próxima": o foco não cai para o body.
    expect(acao).toHaveTextContent('Próxima');
    expect(document.activeElement).toBe(acao);
    expect(screen.getByText('(resposta correta)')).toBeInTheDocument();
  });
});
