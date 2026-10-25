import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '../api';
import {
  API_CACHE,
  arquivoDeDados,
  limparDadosDoAparelho,
  LOCAL_DB,
  nomeDoArquivoDeDados,
} from './conta';

type Pedido = {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onblocked: (() => void) | null;
};

describe('arquivo de dados', () => {
  it('nome com a data do aparelho', () => {
    expect(nomeDoArquivoDeDados(new Date(2026, 9, 5, 23, 30))).toBe(
      'openem-meus-dados-2026-10-05.json',
    );
  });

  it('JSON indentado, do tipo application/json', async () => {
    const blob = arquivoDeDados({ account: { email: 'a@b.com' } });
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe('{\n  "account": {\n    "email": "a@b.com"\n  }\n}');
  });
});

describe('limparDadosDoAparelho()', () => {
  let pedido: Pedido;
  const deleteDatabase = vi.fn(() => {
    pedido = { onsuccess: null, onerror: null, onblocked: null };
    // O navegador responde depois, como no real.
    queueMicrotask(() => pedido.onsuccess?.());
    return pedido;
  });
  const cacheDelete = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    vi.stubGlobal('indexedDB', { deleteDatabase });
    vi.stubGlobal('caches', { delete: cacheDelete });
    deleteDatabase.mockClear();
    cacheDelete.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('tira o token, o cache da API, o banco local e os quadros do localStorage', async () => {
    setToken('tok');
    localStorage.setItem('openem:board:1', '{}');
    localStorage.setItem('openem:boards:index', '[]');
    localStorage.setItem('openem.theme', 'default');

    await limparDadosDoAparelho();

    expect(getToken()).toBeNull();
    expect(cacheDelete).toHaveBeenCalledWith(API_CACHE);
    expect(deleteDatabase).toHaveBeenCalledWith(LOCAL_DB);
    expect(localStorage.getItem('openem:board:1')).toBeNull();
    expect(localStorage.getItem('openem:boards:index')).toBeNull();
    // Preferência do aparelho (tema) não é dado da conta.
    expect(localStorage.getItem('openem.theme')).toBe('default');
  });

  it('banco aberto em outra aba não segura a tela', async () => {
    deleteDatabase.mockImplementationOnce(() => {
      pedido = { onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => pedido.onblocked?.());
      return pedido;
    });
    await expect(limparDadosDoAparelho()).resolves.toBeUndefined();
  });

  it('sem Cache Storage nem IndexedDB, ainda tira o token', async () => {
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('indexedDB', undefined);
    setToken('tok');
    await limparDadosDoAparelho();
    expect(getToken()).toBeNull();
  });

  it('erro do navegador não vira erro na tela', async () => {
    cacheDelete.mockRejectedValueOnce(new Error('SecurityError'));
    deleteDatabase.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    await expect(limparDadosDoAparelho()).resolves.toBeUndefined();
  });
});
