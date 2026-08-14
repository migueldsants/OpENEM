// Testes da galeria do Quadro de Estudos (issue #32). O storage (IndexedDB) é
// mockado; os helpers de export são stubados para isolar do DOM/IO.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Quadro from './Quadro';

const { boards } = vi.hoisted(() => {
  const boards = [
    {
      schemaVersion: 1 as const,
      type: 'study-board' as const,
      id: 'b1',
      title: 'Mapa mental — funções',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z',
      background: 'grid' as const,
      elements: [] as never[],
    },
    {
      schemaVersion: 1 as const,
      type: 'study-board' as const,
      id: 'b2',
      title: 'Geometria',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      background: 'dots' as const,
      elements: [] as never[],
    },
  ];
  return { boards };
});

vi.mock('../board/storage', () => ({
  listBoards: vi.fn().mockResolvedValue(boards),
  getBoard: vi.fn().mockResolvedValue(null),
  saveBoard: vi.fn().mockResolvedValue(undefined),
  deleteBoard: vi.fn().mockResolvedValue(undefined),
  duplicateBoard: vi.fn().mockResolvedValue({ ...boards[0], id: 'b1-copy' }),
  getScratchByQuestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('../board/export', () => ({
  downloadText: vi.fn(),
  downloadDataUrl: vi.fn(),
  downloadSvg: vi.fn(),
  toSVG: vi.fn().mockResolvedValue('<svg/>'),
  toPNGDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,'),
  importOpenEmFile: vi.fn(),
}));

function renderGallery() {
  return render(
    <MemoryRouter>
      <Quadro />
    </MemoryRouter>,
  );
}

describe('Galeria do Quadro (issue #32)', () => {
  it('lista os quadros salvos com título e contagem', async () => {
    renderGallery();
    expect(await screen.findByText('Mapa mental — funções')).toBeInTheDocument();
    expect(screen.getByText('Geometria')).toBeInTheDocument();
  });

  it('mostra o CTA de criar quadro', async () => {
    renderGallery();
    expect(
      await screen.findByRole('button', { name: /novo quadro/i }),
    ).toBeInTheDocument();
  });

  it('abre o menu de ações de um card e oferece exportar/excluir', async () => {
    renderGallery();
    const title = await screen.findByText('Mapa mental — funções');
    const card = title.closest('.card')!;
    const more = within(card).getByLabelText(/mais ações/i);
    fireEvent.click(more);
    expect(await within(card).findByText('Excluir')).toBeInTheDocument();
    expect(within(card).getByText('Exportar .openem')).toBeInTheDocument();
  });
});