// Testes do mapa de calor por tópico (issue #43).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TopicHeatmap } from './TopicHeatmap';
import type { HeatmapArea } from '../../api';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return { ...actual, useNavigate: () => navigate };
});

const AREAS: HeatmapArea[] = [
  {
    id: 'area-mat',
    name: 'Matemática e suas Tecnologias',
    subjects: [
      {
        id: 'subj-mat',
        name: 'Matemática',
        topics: [
          { id: 't1', name: 'Funções', weight: 5, total: 10, correct: 8, accuracy: 80 },
          { id: 't2', name: 'Probabilidade', weight: 3, total: 10, correct: 3, accuracy: 30 },
          { id: 't3', name: 'Geometria', weight: 4, total: 0, correct: 0, accuracy: 0 },
        ],
      },
    ],
  },
];

function renderHeatmap(props: Partial<Parameters<typeof TopicHeatmap>[0]> = {}) {
  return render(
    <MemoryRouter>
      <TopicHeatmap
        areas={AREAS}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('TopicHeatmap (issue #43)', () => {
  beforeEach(() => navigate.mockClear());

  it('mostra a legenda e as áreas como acordeões fechados', () => {
    renderHeatmap();
    expect(screen.getByText(/domina/)).toBeInTheDocument();
    expect(screen.getByText(/reforçar/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Matemática e suas Tecnologias/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Matemática$/),
    ).not.toBeInTheDocument();
  });

  it('expande a área e mostra tópicos com labels de acessibilidade', () => {
    renderHeatmap();
    fireEvent.click(
      screen.getByRole('button', { name: /Matemática e suas Tecnologias/ }),
    );
    // Título/aria-label de cada tópico com a taxa.
    expect(
      screen.getByTitle('Funções — 80% (8/10)'),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Geometria — sem respostas ainda')).toBeInTheDocument();
    // Resumo da matéria: 2 tópicos com respostas (80% e 30%) → 55% médio.
    expect(screen.getByText(/2\/3 tópicos · 55% médio/)).toBeInTheDocument();
  });

  it('clique num tópico navega para /questoes?topicId=', () => {
    renderHeatmap();
    fireEvent.click(
      screen.getByRole('button', { name: /Matemática e suas Tecnologias/ }),
    );
    fireEvent.click(screen.getByTitle('Funções — 80% (8/10)'));
    expect(navigate).toHaveBeenCalledWith('/questoes?topicId=t1');
  });

  it('mostra skeleton carregando e erro com retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <TopicHeatmap areas={null} loading error={null} onRetry={onRetry} />
      </MemoryRouter>,
    );
    expect(document.querySelector('.skeleton')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TopicHeatmap
          areas={null}
          loading={false}
          error="Falhou"
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});