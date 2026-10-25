// Login com rate limiting (issue #87): no 429, o botão para e conta o tempo.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api';
import Login from './Login';

const login = vi.fn();
const register = vi.fn();

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    api: { health: vi.fn(() => Promise.resolve({ status: 'ok' })) },
  };
});
vi.mock('../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../auth', () => ({
  useAuth: () => ({ login, register, authenticated: false }),
}));

/** O botão do formulário (a aba 'Entrar' tem o mesmo nome). */
function enviar(): HTMLButtonElement {
  return document.querySelector('form button[type=submit]')!;
}

function preencherEEntrar() {
  fireEvent.change(screen.getByPlaceholderText('voce@exemplo.com'), {
    target: { value: 'aluno@exemplo.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('mínimo 8 caracteres'), {
    target: { value: 'senhaErrada1' },
  });
  fireEvent.click(enviar());
}

describe('Login — muitas tentativas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    login.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no 429, mostra a mensagem e conta o tempo no botão até liberar', async () => {
    login.mockRejectedValue(
      new HttpError(429, 'Muitas tentativas. Tente de novo em 3 s.', 3),
    );
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    preencherEEntrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Tente de novo em 3 s.',
    );
    const botao = enviar();
    expect(botao).toBeDisabled();
    expect(botao).toHaveTextContent('Aguarde 0:03');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(botao).toHaveTextContent('Aguarde 0:02');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(botao).toBeEnabled();
    expect(botao).toHaveTextContent('Entrar');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('outro erro não trava o botão', async () => {
    login.mockRejectedValue(new HttpError(401, 'Credenciais inválidas'));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    preencherEEntrar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciais inválidas',
    );
    expect(enviar()).toBeEnabled();
  });
});

describe('Login — criar conta', () => {
  beforeEach(() => {
    register.mockReset();
    register.mockResolvedValue(undefined);
  });

  function abrirCadastro() {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    // A aba vem antes do botão do formulário, que tem o mesmo nome.
    fireEvent.click(screen.getAllByRole('button', { name: 'Criar conta' })[0]);
    fireEvent.change(screen.getByPlaceholderText('voce@exemplo.com'), {
      target: { value: 'nova@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('mínimo 8 caracteres'), {
      target: { value: 'senhaForte123' },
    });
  }

  it('mostra o aceite com os links e a declaração de idade', () => {
    abrirCadastro();
    const caixa = screen.getByRole('checkbox');
    expect(caixa).not.toBeChecked();
    expect(caixa).toBeRequired();
    const rotulo = caixa.closest('label')!;
    expect(rotulo).toHaveTextContent(
      'Li e aceito os Termos de Uso e a Política de Privacidade',
    );
    expect(rotulo).toHaveTextContent(/menos de 18 anos.*ciência do\s+meu responsável/);
    const termos = screen.getAllByRole('link', { name: /Termos de Uso/ })[0];
    const politica = screen.getAllByRole('link', { name: /Política de Privacidade/ })[0];
    expect(termos).toHaveAttribute('href', '/termos/');
    expect(politica).toHaveAttribute('href', '/privacidade/');
  });

  it('o login não pede o aceite', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // O rodapé aponta para os dois documentos.
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacidade/',
    );
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute(
      'href',
      '/termos/',
    );
  });

  it('sem marcar o aceite, não cria a conta e explica por quê', async () => {
    abrirCadastro();
    fireEvent.submit(enviar().closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'aceite os Termos de Uso e a Política de Privacidade',
    );
    expect(register).not.toHaveBeenCalled();
  });

  it('com o aceite marcado, envia o aceite junto', async () => {
    abrirCadastro();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(enviar());
    await vi.waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        'nova@exemplo.com',
        'senhaForte123',
        true,
      ),
    );
  });
});
