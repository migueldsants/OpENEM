import type { ForumPost, ForumPostPage, ForumThread } from '../api';

/**
 * Tópico aberto na tela. As respostas vêm em páginas, em ordem de criação.
 * Quem responde antes de carregar todas as páginas tem a resposta guardada em
 * `sent`: o lugar dela é depois das páginas que faltam, e a tela a mostra
 * abaixo do botão "Carregar mais" até a paginação chegar nela.
 */
export interface ThreadState extends ForumThread {
  sent: ForumPost[];
}

export function openThread(thread: ForumThread): ThreadState {
  return { ...thread, sent: [] };
}

/** Acrescenta a resposta que o próprio aluno acabou de enviar. */
export function withReply(state: ThreadState, post: ForumPost): ThreadState {
  const replies = state.replies + 1;
  if (state.nextCursor) {
    return { ...state, replies, sent: [...state.sent, post] };
  }
  return { ...state, replies, posts: [...state.posts, post] };
}

/** Junta a próxima página, sem repetir resposta que já está na tela. */
export function withPage(state: ThreadState, page: ForumPostPage): ThreadState {
  const shown = new Set(state.posts.map((p) => p.id));
  const fresh = page.posts.filter((p) => !shown.has(p.id));
  const arrived = new Set(fresh.map((p) => p.id));
  const sent = state.sent.filter((p) => !arrived.has(p.id));
  const posts = [...state.posts, ...fresh];
  if (page.nextCursor) {
    return { ...state, posts, sent, nextCursor: page.nextCursor };
  }
  // Última página: o que sobrou em `sent` vai para o fim, para a próxima
  // resposta entrar depois dele.
  return { ...state, posts: [...posts, ...sent], sent: [], nextCursor: null };
}

/** Tira a resposta que o próprio aluno apagou, onde quer que ela esteja. */
export function withoutPost(state: ThreadState, postId: string): ThreadState {
  const posts = state.posts.filter((p) => p.id !== postId);
  const sent = state.sent.filter((p) => p.id !== postId);
  const removed =
    state.posts.length + state.sent.length - posts.length - sent.length;
  return { ...state, posts, sent, replies: Math.max(0, state.replies - removed) };
}

/** Aplica `fn` à resposta `postId`, onde quer que ela esteja. */
export function mapPost(
  state: ThreadState,
  postId: string,
  fn: (post: ForumPost) => ForumPost,
): ThreadState {
  const apply = (list: ForumPost[]) =>
    list.map((p) => (p.id === postId ? fn(p) : p));
  return { ...state, posts: apply(state.posts), sent: apply(state.sent) };
}
