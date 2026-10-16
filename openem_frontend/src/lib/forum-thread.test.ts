import { describe, expect, it } from 'vitest';
import type { ForumPost, ForumThread } from '../api';
import { mapPost, openThread, withPage, withReply } from './forum-thread';

const post = (id: string): ForumPost => ({
  id,
  body: `resposta ${id}`,
  createdAt: '2026-10-16T12:00:00.000Z',
  author: { id: 'u-1', name: 'Ana' },
  likes: 0,
  liked: false,
});

const thread = (over: Partial<ForumThread> = {}): ForumThread => ({
  id: 't-1',
  title: 'Dúvida',
  body: 'corpo',
  createdAt: '2026-10-16T11:00:00.000Z',
  questionId: null,
  author: { id: 'u-0', name: 'Bia' },
  replies: 0,
  posts: [],
  nextCursor: null,
  ...over,
});

const ids = (list: ForumPost[]) => list.map((p) => p.id);

describe('forum-thread', () => {
  it('sem página pendente, a resposta nova entra no fim da lista', () => {
    const s = withReply(
      openThread(thread({ replies: 1, posts: [post('a')] })),
      post('n'),
    );
    expect(ids(s.posts)).toEqual(['a', 'n']);
    expect(s.sent).toEqual([]);
    expect(s.replies).toBe(2);
  });

  it('com página pendente, a resposta nova espera depois do "Carregar mais"', () => {
    const s = withReply(
      openThread(thread({ replies: 3, posts: [post('a')], nextCursor: 'c1' })),
      post('n'),
    );
    expect(ids(s.posts)).toEqual(['a']);
    expect(ids(s.sent)).toEqual(['n']);
    expect(s.replies).toBe(4);
  });

  it('a página seguinte entra antes da resposta enviada, sem repetir', () => {
    let s = withReply(
      openThread(thread({ replies: 3, posts: [post('a')], nextCursor: 'c1' })),
      post('n'),
    );
    s = withPage(s, { posts: [post('a'), post('b')], nextCursor: 'c2' });
    expect(ids(s.posts)).toEqual(['a', 'b']);
    expect(ids(s.sent)).toEqual(['n']);
    expect(s.nextCursor).toBe('c2');

    // A última página traz a própria resposta: ela sai de `sent`.
    s = withPage(s, { posts: [post('c'), post('n')], nextCursor: null });
    expect(ids(s.posts)).toEqual(['a', 'b', 'c', 'n']);
    expect(s.sent).toEqual([]);
    expect(s.nextCursor).toBeNull();
  });

  it('na última página, o que sobrou em `sent` vai para o fim da lista', () => {
    let s = withReply(
      openThread(thread({ replies: 2, posts: [post('a')], nextCursor: 'c1' })),
      post('n'),
    );
    s = withPage(s, { posts: [post('b')], nextCursor: null });
    expect(ids(s.posts)).toEqual(['a', 'b', 'n']);
    expect(s.sent).toEqual([]);
    // E a resposta seguinte entra depois dela.
    expect(ids(withReply(s, post('m')).posts)).toEqual(['a', 'b', 'n', 'm']);
  });

  it('mapPost alcança a resposta nas duas listas', () => {
    const s = withReply(
      openThread(thread({ posts: [post('a')], nextCursor: 'c1' })),
      post('n'),
    );
    const like = (p: ForumPost) => ({ ...p, liked: true, likes: 1 });
    expect(mapPost(s, 'a', like).posts[0].liked).toBe(true);
    expect(mapPost(s, 'n', like).sent[0].liked).toBe(true);
    expect(mapPost(s, 'n', like).posts[0].liked).toBe(false);
  });
});
