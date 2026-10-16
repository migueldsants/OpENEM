import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Comunidade from './Comunidade';
import { api, type ForumPost, type ForumThread } from '../api';

vi.mock('../api', () => ({
  api: {
    forumThreads: vi.fn(),
    forumThread: vi.fn(),
    forumPosts: vi.fn(),
    replyThread: vi.fn(),
    togglePostLike: vi.fn(),
    createThread: vi.fn(),
  },
}));

const post = (n: number): ForumPost => ({
  id: `p${n}`,
  body: `resposta ${n}`,
  createdAt: new Date().toISOString(),
  author: { id: 'u-2', name: 'Bia' },
  likes: 0,
  liked: false,
});
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => post(from + i));

const thread = (over: Partial<ForumThread> = {}): ForumThread => ({
  id: 't-1',
  title: 'Dúvida sobre funções',
  body: 'Como resolvo?',
  createdAt: new Date().toISOString(),
  questionId: null,
  author: { id: 'u-1', name: 'Ana' },
  replies: 25,
  posts: range(1, 20),
  nextCursor: 'c1',
  ...over,
});

async function openThread() {
  render(
    <MemoryRouter>
      <Comunidade />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByText('Dúvida sobre funções'));
  await screen.findByRole('heading', { name: 'Dúvida sobre funções' });
}

/** Corpos das respostas na ordem da tela. */
function shownBodies() {
  return screen
    .getAllByText(/^resposta \d+$/)
    .map((el) => el.textContent);
}

describe('Comunidade — respostas paginadas', () => {
  beforeEach(() => {
    vi.mocked(api.forumThreads).mockReset().mockResolvedValue([
      {
        id: 't-1',
        title: 'Dúvida sobre funções',
        createdAt: new Date().toISOString(),
        questionId: null,
        author: { id: 'u-1', name: 'Ana' },
        replies: 25,
      },
    ]);
    vi.mocked(api.forumThread).mockReset();
    vi.mocked(api.forumPosts).mockReset();
    vi.mocked(api.replyThread).mockReset();
  });

  it('abre com a primeira página e o total, e carrega o resto pelo cursor', async () => {
    vi.mocked(api.forumThread).mockResolvedValue(thread());
    vi.mocked(api.forumPosts).mockResolvedValue({
      posts: range(21, 25),
      nextCursor: null,
    });
    await openThread();

    expect(screen.getByText('25 respostas')).toBeInTheDocument();
    expect(shownBodies()).toHaveLength(20);

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais respostas' }));
    expect(await screen.findByText('resposta 25')).toBeInTheDocument();
    expect(api.forumPosts).toHaveBeenCalledWith('t-1', 'c1');
    expect(shownBodies()).toEqual(range(1, 25).map((p) => p.body));
    expect(
      screen.queryByRole('button', { name: 'Carregar mais respostas' }),
    ).not.toBeInTheDocument();
  });

  it('responder com páginas faltando: a resposta fica depois do botão e não se repete', async () => {
    vi.mocked(api.forumThread).mockResolvedValue(thread());
    vi.mocked(api.replyThread).mockResolvedValue(post(26));
    vi.mocked(api.forumPosts).mockResolvedValue({
      posts: range(21, 26),
      nextCursor: null,
    });
    await openThread();

    fireEvent.change(screen.getByLabelText('Sua resposta'), {
      target: { value: 'resposta 26' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    expect(await screen.findByText('26 respostas')).toBeInTheDocument();
    expect(api.replyThread).toHaveBeenCalledWith('t-1', 'resposta 26');

    // A resposta nova aparece abaixo do "Carregar mais", fora da página.
    const items = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    const button = screen.getByRole('button', { name: 'Carregar mais respostas' });
    expect(items.at(-1)).toHaveTextContent('resposta 26');
    expect(items.at(-2)).toContainElement(button);

    fireEvent.click(button);
    expect(await screen.findByText('resposta 25')).toBeInTheDocument();
    expect(shownBodies()).toEqual(range(1, 26).map((p) => p.body));
  });

  it('responder com tudo carregado acrescenta a resposta no fim', async () => {
    vi.mocked(api.forumThread).mockResolvedValue(
      thread({ replies: 2, posts: range(1, 2), nextCursor: null }),
    );
    vi.mocked(api.replyThread).mockResolvedValue(post(3));
    await openThread();
    expect(
      screen.queryByRole('button', { name: 'Carregar mais respostas' }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sua resposta'), {
      target: { value: 'resposta 3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    expect(await screen.findByText('3 respostas')).toBeInTheDocument();
    expect(shownBodies()).toEqual(['resposta 1', 'resposta 2', 'resposta 3']);
    expect(api.forumThread).toHaveBeenCalledTimes(1);
  });
});
