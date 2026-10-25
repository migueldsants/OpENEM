// Testes do AuthProvider/useAuth (issue #47): sessão, 401 e logout.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth';
import { api, HttpError, setToken, getToken } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api);

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider (issue #47)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('expõe estado não autenticado sem token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(result.current.me).toBeNull();
  });

  it('carrega /me quando há token salvo', async () => {
    setToken('tok-1');
    mockedApi.me.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      createdAt: '2026-01-01',
      profile: { displayName: 'Ana', onboarded: true },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.me).not.toBeNull());
    expect(result.current.authenticated).toBe(true);
    expect(result.current.me?.email).toBe('a@b.com');
  });

  it('encerra a sessão apenas em 401 (falha de rede mantém sessão)', async () => {
    setToken('tok-2');
    mockedApi.me
      .mockRejectedValueOnce(new HttpError(500, 'boom')) // mantém sessão
      .mockRejectedValueOnce(new HttpError(401, 'expirado')); // encerra

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(mockedApi.me).toHaveBeenCalledTimes(1));
    expect(getToken()).toBe('tok-2');

    await act(async () => {
      await result.current.refreshMe();
    });
    expect(result.current.authenticated).toBe(false);
    expect(getToken()).toBeNull();
    expect(result.current.me).toBeNull();
  });

  it('login persiste token e carrega o usuário', async () => {
    mockedApi.login.mockResolvedValue({
      accessToken: 'tok-login',
      user: { id: 'u1', email: 'a@b.com' },
    } as never);
    mockedApi.me.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { displayName: 'Ana' },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('a@b.com', 'senha');
    });

    expect(getToken()).toBe('tok-login');
    expect(result.current.authenticated).toBe(true);
  });

  it('register persiste token como o login', async () => {
    mockedApi.register.mockResolvedValue({
      accessToken: 'tok-reg',
      user: { id: 'u2', email: 'c@d.com' },
    } as never);
    mockedApi.me.mockResolvedValue({
      id: 'u2',
      email: 'c@d.com',
      profile: { displayName: 'Bia' },
    } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.register('c@d.com', 'senha', true);
    });

    expect(mockedApi.register).toHaveBeenCalledWith('c@d.com', 'senha', true);
    expect(getToken()).toBe('tok-reg');
    expect(result.current.me?.email).toBe('c@d.com');
  });

  it('logout limpa token e usuário', async () => {
    setToken('tok-x');
    mockedApi.me.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
    } as never);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    act(() => result.current.logout());
    expect(result.current.authenticated).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('useAuth fora do provider lança erro claro', () => {
    // Silencia o console.error do React para o throw esperado.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});