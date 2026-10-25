// Cartão "Segurança" do Perfil: troca de senha e sair de todos os dispositivos.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, type Me } from '../api';
import { SegurancaConta } from './SegurancaConta';

const api = vi.hoisted(() => ({
  changePassword: vi.fn(),
  logoutAll: vi.fn(),
}));
const signIn = vi.fn(() => Promise.resolve());
const logout = vi.fn();
let me: Partial<Me> | null = null;

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, api };
});
vi.mock('../auth', () => ({ useAuth: () => ({ me, signIn, logout }) }));

function preencher(atual: string, nova: string, confirma = nova) {
  fireEvent.change(screen.getByLabelText('Senha atual'), {
    target: { value: atual },
  });
  fireEvent.change(screen.getByLabelText('Senha nova'), {
    target: { value: nova },
  });
  fireEvent.change(screen.getByLabelText('Repita a senha nova'), {
    target: { value: confirma },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar senha nova' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  me = { id: 'u1', email: 'a@b.com', hasPassword: true, googleLinked: false };
});

describe('SegurancaConta — trocar senha', () => {
  it('troca, entra com o token novo e avisa dos outros aparelhos', async () => {
    api.changePassword.mockResolvedValue({
      accessToken: 'jwt-novo',
      user: { id: 'u1', email: 'a@b.com' },
    });
    render(<SegurancaConta />);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    preencher('senha-antiga', 'senha-nova-1');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Os outros aparelhos saíram da conta',
    );
    expect(api.changePassword).toHaveBeenCalledWith('senha-antiga', 'senha-nova-1');
    expect(signIn).toHaveBeenCalledWith('jwt-novo');
    // O formulário fecha.
    expect(screen.queryByLabelText('Senha atual')).toBeNull();
  });

  it('senhas novas diferentes não vão para a API', () => {
    render(<SegurancaConta />);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    preencher('senha-antiga', 'senha-nova-1', 'senha-nova-2');
    expect(screen.getByRole('alert')).toHaveTextContent('não são iguais');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('senha atual errada mostra o erro e mantém o formulário', async () => {
    api.changePassword.mockRejectedValue(
      new HttpError(400, 'A senha atual não confere.'),
    );
    render(<SegurancaConta />);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    preencher('errada', 'senha-nova-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('não confere');
    expect(screen.getByLabelText('Senha atual')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('conta só do Google: explica como criar a senha, sem formulário', () => {
    me = { id: 'u1', email: 'a@gmail.com', hasPassword: false, googleLinked: true };
    render(<SegurancaConta />);
    expect(screen.getByText(/Conta Google vinculada/)).toBeInTheDocument();
    expect(screen.getByText(/ainda não tem senha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trocar senha' })).toBeNull();
  });
});

describe('SegurancaConta — sair de todos os dispositivos', () => {
  it('pede confirmação, encerra na API e sai deste aparelho', async () => {
    api.logoutAll.mockResolvedValue(undefined);
    render(<SegurancaConta />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Sair de todos os dispositivos' }),
    );
    expect(api.logoutAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair de todos' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(api.logoutAll).toHaveBeenCalledTimes(1);
  });

  it('cancelar não sai', () => {
    render(<SegurancaConta />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Sair de todos os dispositivos' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.logoutAll).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Sair de todos os dispositivos' }),
    ).toBeInTheDocument();
  });

  it('falha de rede mostra o erro e continua logado', async () => {
    api.logoutAll.mockRejectedValue(new TypeError('Sem conexão com o servidor.'));
    render(<SegurancaConta />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Sair de todos os dispositivos' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sim, sair de todos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');
    expect(logout).not.toHaveBeenCalled();
  });
});
