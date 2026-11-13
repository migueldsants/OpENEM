import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Materia from './Materia';
import { api, HttpError, type TrackDetail, type TrackTopic } from '../api';

vi.mock('../api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api')>();
  return { ...real, api: { track: vi.fn(), startSimulation: vi.fn(), studyResources: vi.fn() } };
});
vi.mock('../auth', () => ({ useAuth: () => ({ me: { id: 'u1' } }) }));

const topico = (over: Partial<TrackTopic>): TrackTopic => ({
  id: 't',
  name: 'Assunto',
  perExam: 1,
  years: 5,
  byYear: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  bank: 20,
  state: 'nao-visto',
  mastery: 0,
  answered: 0,
  accuracy: null,
  ...over,
});

const trilha = (): TrackDetail => ({
  subject: {
    id: 's-mat',
    name: 'Matemática',
    area: { id: 'a', name: 'Matemática e suas Tecnologias' },
  },
  window: {
    fromYear: 2016,
    toYear: 2025,
    exams: 10,
    years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  },
  language: 'ingles',
  perExam: 44.8,
  mastery: 20,
  answered: 8,
  currentStage: 1,
  stages: [
    {
      index: 0,
      title: 'Base numérica',
      why: 'As contas que todas as outras etapas usam',
      perExam: 2.6,
      practicable: true,
      done: true,
      topics: [topico({ id: 'op', name: 'Operações e propriedades', perExam: 1.9, state: 'dominado', answered: 6, accuracy: 100 })],
    },
    {
      index: 1,
      title: 'Proporção e porcentagem',
      why: 'O bloco que mais cai na prova de Matemática',
      perExam: 10.2,
      practicable: true,
      done: false,
      topics: [
        topico({
          id: 'razao',
          name: 'Razão e proporção',
          perExam: 4.8,
          years: 10,
          byYear: [5, 4, 5, 6, 4, 5, 5, 4, 5, 5],
          state: 'praticando',
          answered: 2,
          accuracy: 50,
        }),
        topico({ id: 'pct', name: 'Porcentagem', perExam: 3.3 }),
      ],
    },
    {
      index: 2,
      title: 'Leitura de dados',
      why: 'Tabelas, gráficos e médias, presentes em toda prova',
      perExam: 8.4,
      practicable: true,
      done: false,
      topics: [topico({ id: 'graf', name: 'Interpretação de gráficos', perExam: 4.8 })],
    },
  ],
  extras: {
    perExam: 0.1,
    topics: [topico({ id: 'poli', name: 'Polinômios', perExam: 0.1, years: 1, bank: 0 })],
  },
});

function Onde() {
  const l = useLocation();
  return <p data-testid="onde">{l.pathname}</p>;
}

function renderizar(url = '/materias/s-mat') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/materias/:subjectId" element={<Materia />} />
        <Route path="/simulados" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Matéria (trilha)', () => {
  beforeEach(() => {
    vi.mocked(api.track).mockReset();
    vi.mocked(api.startSimulation).mockReset();
    vi.mocked(api.studyResources).mockReset();
    vi.mocked(api.studyResources).mockResolvedValue({ resources: [], maxCheckAgeDays: 365 });
    localStorage.clear();
  });

  it('marca a etapa atual e só ela tem "Treinar etapa"', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    renderizar();
    const atual = await screen.findByRole('listitem', { current: 'step' });
    expect(atual).toHaveAccessibleName(/Etapa 2: Proporção e porcentagem, etapa atual/);
    expect(within(atual).getByRole('button', { name: /Treinar a etapa/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Treinar a etapa/ })).toHaveLength(1);
    expect(screen.getByRole('listitem', { name: /Etapa 1: Base numérica, concluída/ })).toBeInTheDocument();
  });

  it('cada assunto abre as questões dele, e o que não tem questão não vira link', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    renderizar();
    const razao = await screen.findByRole('link', { name: /^Razão e proporção, 4,8 por prova, praticando, 50% de acerto/ });
    expect(razao).toHaveAttribute('href', '/questoes?topicId=razao');
    expect(screen.queryByRole('link', { name: /^Polinômios/ })).not.toBeInTheDocument();
  });

  it('"Treinar etapa" monta o simulado dos assuntos da etapa e abre o Simulados', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    vi.mocked(api.startSimulation).mockResolvedValue({ id: 'sim1' } as never);
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Treinar a etapa/ }));
    expect(await screen.findByTestId('onde')).toHaveTextContent('/simulados');
    expect(api.startSimulation).toHaveBeenCalledWith(null, {
      topicIds: ['razao', 'pct'],
      questionCount: 10,
    });
  });

  it('erro ao montar o simulado aparece na própria etapa', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    vi.mocked(api.startSimulation).mockRejectedValue(new Error('Nenhuma questão disponível'));
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Treinar a etapa/ }));
    const atual = screen.getByRole('listitem', { current: 'step' });
    expect(await within(atual).findByRole('alert')).toHaveTextContent('Nenhuma questão disponível');
  });

  it('"Já sei isso" pula a etapa, grava neste aparelho e pode ser desfeito', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Já sei isso' }));
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveAccessibleName(/Etapa 3: Leitura de dados/);
    expect(JSON.parse(localStorage.getItem('openem.trilhas.puladas:u1')!)).toEqual({
      's-mat': ['Proporção e porcentagem'],
    });
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }));
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveAccessibleName(/Etapa 2/);
  });

  it('"O que cai" ordena pela incidência e mostra a tira dos anos', async () => {
    vi.mocked(api.track).mockResolvedValue(trilha());
    renderizar('/materias/s-mat?aba=cai');
    const painel = await screen.findByRole('tabpanel');
    const nomes = within(painel)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('a, span.font-semibold')?.textContent);
    expect(nomes.slice(0, 3)).toEqual(['Razão e proporção', 'Interpretação de gráficos', 'Porcentagem']);
    expect(within(painel).getAllByRole('img', { name: 'Caiu em 10 de 10 provas' })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'O que cai' })).toHaveAttribute('aria-selected', 'true');
  });

  it('matéria sem trilha mostra o aviso e o caminho de volta', async () => {
    vi.mocked(api.track).mockRejectedValue(new HttpError(404, 'Matéria sem trilha'));
    renderizar('/materias/nao-existe');
    expect(await screen.findByRole('heading', { name: 'Matéria não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Matérias' })).toHaveAttribute('href', '/materias');
  });
  it('mostra os materiais gratuitos da matéria e leva ao Onde estudar', async () => {
    const recurso = {
      id: 'khan',
      title: 'Matemática EM: Álgebra 1',
      url: 'https://pt.khanacademy.org/math/em-mat-algebra',
      types: ['curso' as const],
      subjects: ['Matemática'],
      topics: [],
      description: 'Curso com vídeos e exercícios sobre funções.',
      language: 'pt' as const,
      checkedAt: '2026-11-13',
      provider: { id: 'khan-academy', name: 'Khan Academy', kind: 'sem-fins-lucrativos' as const, about: 'ONG.' },
    };
    vi.mocked(api.studyResources).mockResolvedValue({
      resources: [recurso, { ...recurso, id: 'bbc', title: 'BBC Learning English', subjects: ['Língua Estrangeira'] }],
      maxCheckAgeDays: 365,
    });
    vi.mocked(api.track).mockResolvedValue(trilha());
    renderizar();
    const secao = (await screen.findByRole('heading', { name: 'Onde estudar' })).closest('section')!;
    expect(within(secao).getByRole('heading', { name: 'Matemática EM: Álgebra 1' })).toBeInTheDocument();
    expect(within(secao).queryByRole('heading', { name: 'BBC Learning English' })).not.toBeInTheDocument();
    expect(within(secao).getByRole('link', { name: /Abrir Matemática EM/ })).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(within(secao).getByRole('link', { name: 'Ver todos os materiais' })).toHaveAttribute(
      'href',
      '/onde-estudar?materia=Matem%C3%A1tica',
    );
    expect(screen.getByRole('link', { name: 'Onde estudar' })).toHaveAttribute('href', '#onde-estudar');
  });
});
