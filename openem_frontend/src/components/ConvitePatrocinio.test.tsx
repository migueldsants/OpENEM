// Convite ao GitHub Sponsors: abre uma vez por login, fecha pelo X, Esc ou
// clique fora, e "Agora não" adia.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../api';
import { ADIAR_MS, CHAVE_PATROCINIO, lerEstado } from '../lib/patrocinio';
import { SPONSOR_URL } from '../lib/site';
import { ConvitePatrocinio } from './ConvitePatrocinio';

const auth: { token: string | null; me: Me | null } = { token: null, me: null };
vi.mock('../auth', () => ({ useAuth: () => auth }));

let iat = 1;
/** Cada chamada é um login novo (iat diferente). */
function novoLogin() {
  const payload = btoa(JSON.stringify({ sub: 'u1', iat: iat++ }));
  auth.token = `h.${payload}.s`;
}

const CONTA_ANTIGA: Me = {
  id: 'u1',
  email: 'a@b.com',
  createdAt: '2020-01-01T00:00:00.000Z',
  profile: null,
};

beforeEach(() => {
  localStorage.clear();
  novoLogin();
  auth.me = CONTA_ANTIGA;
});

function dialogo() {
  return screen.queryByRole('dialog', { name: 'Ajude a manter o OpENEM no ar' });
}

describe('ConvitePatrocinio', () => {
  it('abre ao entrar, com o link para o GitHub Sponsors em aba nova', () => {
    render(<ConvitePatrocinio />);
    expect(dialogo()).toBeInTheDocument();
    expect(dialogo()).toHaveAttribute('aria-modal', 'true');
    const link = screen.getByRole('link', { name: /Patrocinar no GitHub/ });
    expect(link).toHaveAttribute('href', SPONSOR_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('não abre de novo no mesmo login', () => {
    const { unmount } = render(<ConvitePatrocinio />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(dialogo()).not.toBeInTheDocument();
    unmount();
    render(<ConvitePatrocinio />);
    expect(dialogo()).not.toBeInTheDocument();
  });

  it('fecha com Esc e volta no próximo login', () => {
    const { unmount } = render(<ConvitePatrocinio />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialogo()).not.toBeInTheDocument();
    unmount();
    novoLogin();
    render(<ConvitePatrocinio />);
    expect(dialogo()).toBeInTheDocument();
  });

  it('fecha com clique fora do painel, mas não com clique dentro', () => {
    render(<ConvitePatrocinio />);
    fireEvent.click(dialogo()!);
    expect(dialogo()).toBeInTheDocument();
    fireEvent.click(dialogo()!.parentElement!);
    expect(dialogo()).not.toBeInTheDocument();
  });

  it('"Agora não" adia uma semana, mesmo em login novo', () => {
    const antes = Date.now();
    const { unmount } = render(<ConvitePatrocinio />);
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    const { adiadoAte } = lerEstado(localStorage);
    expect(adiadoAte).toBeGreaterThanOrEqual(antes + ADIAR_MS);
    unmount();
    novoLogin();
    render(<ConvitePatrocinio />);
    expect(dialogo()).not.toBeInTheDocument();
  });

  it('conta criada agora (recém-saída do onboarding) não vê o convite', () => {
    auth.me = { ...CONTA_ANTIGA, createdAt: new Date().toISOString() };
    render(<ConvitePatrocinio />);
    expect(dialogo()).not.toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_PATROCINIO)).toBeNull();
  });

  it('espera o usuário carregar e o simulado acabar sem gastar a vez', () => {
    auth.me = null;
    const { rerender } = render(<ConvitePatrocinio />);
    expect(dialogo()).not.toBeInTheDocument();
    auth.me = CONTA_ANTIGA;
    rerender(<ConvitePatrocinio pausado />);
    expect(dialogo()).not.toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_PATROCINIO)).toBeNull();
    act(() => rerender(<ConvitePatrocinio />));
    expect(dialogo()).toBeInTheDocument();
  });
});
