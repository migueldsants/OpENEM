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

async function paradas() {
  const mapa = await screen.findByRole('list', { name: 'Mapa das matérias' });
  return within(mapa).getAllByRole('link');
}

describe('Matérias (mapa)', () => {
  beforeEach(() => {
    vi.mocked(api.tracks).mockReset();
    localStorage.clear();
  });

  it('o caminho passa pelas matérias na ordem da prova, com a Redação fechando Linguagens', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const nomes = (await paradas()).map((l) => l.getAttribute('aria-label')!.split(',')[0]);
    expect(nomes).toEqual(['Língua Portuguesa', 'Redação', 'História', 'Matemática']);
    expect(screen.getByRole('link', { name: /^Redação/ })).toHaveAttribute('href', '/redacoes');
  });

  it('cada matéria abre a trilha e diz quanto cai e quanto o aluno domina', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const historia = await screen.findByRole('link', { name: /^História/ });
    expect(historia).toHaveAttribute('href', '/materias/s-hist');
    expect(historia).toHaveAccessibleName(/12 questões por prova, você domina 42%, etapa 1 de 2/);
    expect(historia).toHaveTextContent('42% · etapa 1 de 2');
    expect(screen.getByRole('link', { name: /^Língua Portuguesa/ })).toHaveTextContent('Não iniciada');
  });

  it('marca o próximo passo; aluno sem respostas vê "Comece aqui"', async () => {
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const mat = await screen.findByRole('link', { name: /^Matemática.*próximo passo/ });
    expect(mat).toHaveTextContent('Comece aqui');
    expect(
      screen.getByText('O que caiu nas provas regulares de 2016 a 2025 e quanto disso você já domina.'),
    ).toBeInTheDocument();
  });

  it('com respostas suficientes, o título diz quanto o aluno domina', async () => {
    vi.mocked(api.tracks).mockResolvedValue(
      visao({ overall: { mastery: 31, answered: 412, enough: true } }),
    );
    renderizar();
    expect(
      await screen.findByText(/Você domina cerca de/),
    ).toHaveTextContent('Você domina cerca de 31% do que caiu nas provas regulares de 2016 a 2025.');
    expect(await screen.findByRole('link', { name: /^Matemática/ })).toHaveTextContent('Próximo passo');
  });

  it('"já sei isso" gravado neste aparelho avança a etapa mostrada', async () => {
    localStorage.setItem('openem.trilhas.puladas:u1', JSON.stringify({ 's-mat': ['Base numérica'] }));
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    expect(await screen.findByRole('link', { name: /^Matemática.*etapa 2 de 2/ })).toBeInTheDocument();
  });

  it('trilha concluída ganha o selo', async () => {
    localStorage.setItem(
      'openem.trilhas.puladas:u1',
      JSON.stringify({ 's-mat': ['Base numérica', 'Proporção e porcentagem'] }),
    );
    vi.mocked(api.tracks).mockResolvedValue(visao());
    renderizar();
    const mat = await screen.findByRole('link', { name: /^Matemática.*trilha concluída/ });
    expect(mat).toHaveTextContent('Trilha concluída');
  });

  it('erro de rede mostra o aviso com tentar de novo', async () => {
    vi.mocked(api.tracks).mockRejectedValue(new Error('fora do ar'));
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as matérias');
  });
});
