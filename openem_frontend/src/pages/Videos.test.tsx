// Testes da tela Vídeos (issue #37).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Videos from './Videos';
import { api } from '../api';
import type { Video } from '../api';

vi.mock('../api', () => ({
  api: {
    videos: vi.fn(),
    subjects: vi.fn(),
    addVideo: vi.fn(),
    toggleVideoWatched: vi.fn(),
    deleteVideo: vi.fn(),
    addVideoNote: vi.fn(),
    deleteVideoNote: vi.fn(),
  },
}));

const VIDEO: Video = {
  id: 'v1',
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Aula de Funções',
  thumbnail: null,
  subjectId: 's1',
  subjectName: 'Matemática e suas Tecnologias',
  watched: false,
  createdAt: new Date().toISOString(),
  notes: [
    { id: 'n1', timestampSec: 90, content: 'Explicação do gráfico', createdAt: new Date().toISOString() },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Videos />
    </MemoryRouter>,
  );
}

describe('Videos (issue #37)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.videos).mockResolvedValue([VIDEO]);
    vi.mocked(api.subjects).mockResolvedValue([
      { id: 's1', name: 'Matemática e suas Tecnologias', topics: [] },
    ] as never);
  });

  it('lista vídeos agrupados por matéria com contagem de notas', async () => {
    renderPage();
    expect(await screen.findByText(/Aula de Funções|T/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Matemática' })).toBeInTheDocument();
    expect(screen.getByText('1 nota')).toBeInTheDocument();
  });

  it('adiciona vídeo por link e limpa o input', async () => {
    vi.mocked(api.addVideo).mockResolvedValue({
      ...VIDEO,
      id: 'v2',
      youtubeId: 'abc12345678',
      title: 'Vídeo 2',
      notes: [],
    });
    renderPage();

    fireEvent.change(
      await screen.findByLabelText('Link do YouTube'),
      { target: { value: 'https://youtu.be/abc12345678' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(api.addVideo).toHaveBeenCalledWith(
        'https://youtu.be/abc12345678',
        undefined,
      ),
    );
    expect(await screen.findByText('Vídeo 2')).toBeInTheDocument();
    // Input limpo depois de salvar.
    expect(
      (screen.getByLabelText('Link do YouTube') as HTMLInputElement).value,
    ).toBe('');
  });

  it('abre o player com as notas e o timestamp clicável', async () => {
    renderPage();
    // Abre pelo botão da thumbnail.
    fireEvent.click(
      await screen.findByRole('button', { name: 'Assistir Aula de Funções' }),
    );

    expect(await screen.findByText(/Exportar notas/)).toBeInTheDocument();
    // Nota com timestamp clicável — o iframe troca para o instante (?start=90).
    fireEvent.click(screen.getByText('1:30'));
    const player = screen.getByTitle('Aula de Funções') as HTMLIFrameElement;
    expect(player.src).toContain('start=90');
  });

  it('adiciona nota com timestamp mm:ss', async () => {
    vi.mocked(api.addVideoNote).mockResolvedValue({
      id: 'n2',
      timestampSec: 150,
      content: 'Fórmula do vértice',
      createdAt: new Date().toISOString(),
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Assistir Aula de Funções' }),
    );

    fireEvent.change(await screen.findByLabelText('Instante da nota'), {
      target: { value: '2:30' },
    });
    fireEvent.change(screen.getByLabelText('Conteúdo da nota'), {
      target: { value: 'Fórmula do vértice' },
    });
    fireEvent.click(screen.getByText('Anotar'));

    await waitFor(() =>
      expect(api.addVideoNote).toHaveBeenCalledWith('v1', 150, 'Fórmula do vértice'),
    );
    expect(await screen.findByText('Fórmula do vértice')).toBeInTheDocument();
  });

  it('marca assistido com toggle', async () => {
    vi.mocked(api.toggleVideoWatched).mockResolvedValue({
      ...VIDEO,
      watched: true,
    });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Marcar como assistido' }),
    );
    await waitFor(() =>
      expect(api.toggleVideoWatched).toHaveBeenCalledWith('v1'),
    );
    expect(
      await screen.findByRole('button', { name: 'Marcar como não assistido' }),
    ).toBeInTheDocument();
  });

  it('remove vídeo da lista', async () => {
    vi.mocked(api.deleteVideo).mockResolvedValue({ removed: true });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: /Remover/ }),
    );
    await waitFor(() =>
      expect(api.deleteVideo).toHaveBeenCalledWith('v1'),
    );
    await waitFor(() =>
      expect(screen.queryByText('1 nota')).not.toBeInTheDocument(),
    );
  });

  it('estado vazio quando a videoteca está vazia', async () => {
    vi.mocked(api.videos).mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByText(/videoteca está vazia/),
    ).toBeInTheDocument();
  });

  it('exibe erro quando a API falha', async () => {
    vi.mocked(api.videos).mockRejectedValue(new Error('Falha na rede'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falha na rede');
  });
});