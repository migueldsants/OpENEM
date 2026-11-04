import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EscolherApelido from './EscolherApelido';

const api = vi.hoisted(() => ({ updateProfile: vi.fn() }));
const refreshMe = vi.fn(() => Promise.resolve());
const logout = vi.fn();

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, api };
});
vi.mock('../auth', () => ({ useAuth: () => ({ refreshMe, logout }) }));

function digitar(valor: string) {
  fireEvent.change(screen.getByPlaceholderText('seu.apelido'), {
    target: { value: valor },
  });
}

describe('EscolherApelido', () => {
  beforeEach(() => {
    api.updateProfile.mockReset();
    refreshMe.mockClear();
    logout.mockClear();
  });

  it('salva o apelido normalizado e recarrega o perfil', async () => {
    api.updateProfile.mockResolvedValue({});
    render(<EscolherApelido />);
    digitar('@Ana.Estuda');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(refreshMe).toHaveBeenCalled());
    expect(api.updateProfile).toHaveBeenCalledWith({ nickname: 'ana.estuda' });
  });

  it('não envia apelido fora do formato', async () => {
    render(<EscolherApelido />);
    digitar('ab');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/3 a 20/);
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('mostra a recusa do servidor e não sai da tela', async () => {
    api.updateProfile.mockRejectedValue(
      new Error('Esse apelido não é permitido: ele tem palavrão, ofensa ou referência a ódio. Escolha outro.'),
    );
    render(<EscolherApelido />);
    digitar('qualquer');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não é permitido');
    expect(refreshMe).not.toHaveBeenCalled();
  });

  it('dá para sair sem escolher', () => {
    render(<EscolherApelido />);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(logout).toHaveBeenCalled();
  });
});
