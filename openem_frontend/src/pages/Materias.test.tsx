import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Materias from './Materias';
import { api, type TrackSubjectSummary, type TracksOverview } from '../api';

vi.mock('../api', () => ({ api: { tracks: vi.fn() } }));
vi.mock('../auth', () => ({ useAuth: () => ({ me: { id: 'u1' } }) }));

const janela = { fromYear: 2016, toYear: 2025, exams: 10, years: [] };

const materia = (over: Partial<TrackSubjectSummary>): TrackSubjectSummary => ({
  id: 's-mat',
  name: 'Matemática',
  area: { id: 'a-mat', name: 'Matemática e suas Tecnologias' },
  perExam: 44.8,
  mastery: 0,
  answered: 0,
  currentStage: 0,
  stages: [
    { title: 'Base numérica', done: false, practicable: true },
    { title: 'Proporção e porcentagem', done: false, practicable: true },
  ],
  ...over,
});

const visao = (over: Partial<TracksOverview> = {}): TracksOverview => ({
  window: janela,
  language: 'ingles',
  overall: { mastery: 0, answered: 0, enough: false },
  suggestions: [
    {
      subjectId: 's-mat',
      subjectName: 'Matemática',
      areaName: 'Matemática e suas Tecnologias',
      stageIndex: 0,
      title: 'Base numérica',
      topicIds: ['t1'],
    },
  ],
  subjects: [
    materia({}),
    materia({
      id: 's-por',
      name: 'Língua Portuguesa',
      area: { id: 'a-lin', name: 'Linguagens, Códigos e suas Tecnologias' },
      perExam: 24.3,
    }),
    materia({
      id: 's-hist',
      name: 'História',
      area: { id: 'a-hum', name: 'Ciências Humanas e suas Tecnologias' },
      perExam: 12,
      mastery: 42,
      answered: 12,
    }),
  ],
  ...over,
});

function renderizar() {
  return render(
    <MemoryRouter>
      <Materias />
    </MemoryRouter>,
  );
}

describe('Matérias', () => {
  beforeEach(() => {
    vi.mocked(api.tracks).mockReset();
    localStorage.clear();
  });

  it('aluno novo vê por onde começar, com o link para a trilha', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const cartao = (await screen.findByRole('heading', { name: 'Por onde começar' })).closest('section')!;
    const link = within(cartao).getByRole('link', { name: 'Abrir a trilha de Matemática' });
    expect(link).toHaveAttribute('href', '/materias/s-mat');
    expect(within(cartao).getByText('Base numérica')).toBeInTheDocument();
    expect(
      screen.getByText('O que caiu nas provas regulares de 2016 a 2025 e quanto disso você já domina.'),
    ).toBeInTheDocument();
  });

  it('agrupa por área na ordem da prova e põe a Redação em Linguagens', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const areas = (await screen.findAllByRole('heading', { level: 2 }))
      .map((h) => h.textContent)
      .filter((t) => t !== 'Por onde começar');
    expect(areas).toEqual(['Linguagens', 'Humanas', 'Matemática']);
    const linguagens = screen.getByRole('heading', { name: 'Linguagens' }).closest('section')!;
    expect(within(linguagens).getByRole('link', { name: /Redação/ })).toHaveAttribute('href', '/redacoes');
  });

  it('mostra quanto cai e o domínio de quem já começou', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const historia = await screen.findByRole('link', { name: /História/ });
    expect(historia).toHaveTextContent('12 questões por prova');
    expect(historia).toHaveTextContent('42%');
    expect(historia).toHaveAttribute('href', '/materias/s-hist');
    expect(screen.getByRole('link', { name: /Matemática.*não iniciada/ })).toHaveTextContent(
      '44,8 questões por prova',
    );
  });

  it('com respostas suficientes, o topo diz quanto o aluno domina', async () => {
    vi.mocked(api.tracks).mockResolvedValue(
      visao({ overall: { mastery: 31, answered: 412, enough: true } }),
    );
    renderizar();
    expect(
      await screen.findByRole('heading', { name: 'Você domina cerca de 31% do que cai' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Próximo passo: Matemática/)).toBeInTheDocument();
  });

  it('"já sei isso" gravado neste aparelho avança a etapa mostrada', async () => {
    localStorage.setItem('openem.trilhas.puladas:u1', JSON.stringify({ 's-mat': ['Base numérica'] }));
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    expect(await screen.findByRole('link', { name: /Matemática.*etapa 2 de 2/ })).toBeInTheDocument();
  });

  it('erro de rede mostra o aviso com tentar de novo', async () => {
    vi.mocked(api.tracks).mockRejectedValue(new Error('fora do ar'));
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as matérias');
  });
});
