// Telas de conta fora do login: esqueci a senha, redefinição e volta do Google.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api';
import { ERROS_GOOGLE, erroGoogle, fragmentParam } from '../lib/conta';
import EntrarGoogle from './EntrarGoogle';
import EsqueciSenha from './EsqueciSenha';
import RedefinirSenha from './RedefinirSenha';

const api = vi.hoisted(() => ({
  authOptions: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  googleExchange: vi.fn(),
}));
const signIn = vi.fn(() => Promise.resolve());

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, api };
});
vi.mock('../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../auth', () => ({ useAuth: () => ({ signIn }) }));

/** Mostra onde o app está, para conferir navegação e fragmento limpo. */
function Onde() {
  const l = useLocation();
  return <p data-testid="onde">{`${l.pathname}${l.hash}`}</p>;
}

function abrir(entrada: string, elemento: React.ReactElement) {
  const caminho = entrada.split('#')[0];
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path={caminho} element={elemento} />
        <Route path="*" element={null} />
      </Routes>
      <Onde />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.authOptions.mockResolvedValue({ passwordReset: true, google: false });
});

describe('lib/conta', () => {
  it('fragmentParam lê o parâmetro do fragmento, com ou sem #', () => {
    expect(fragmentParam('#token=abc&x=1', 'token')).toBe('abc');
    expect(fragmentParam('code=c1', 'code')).toBe('c1');
    expect(fragmentParam('', 'token')).toBeNull();
  });

  it('erroGoogle cai na falha genérica com código desconhecido ou vazio', () => {
    expect(erroGoogle('email')).toBe(ERROS_GOOGLE.email);
    expect(erroGoogle('inventado')).toBe(ERROS_GOOGLE.falha);
    expect(erroGoogle(null)).toBe(ERROS_GOOGLE.falha);
  });
});

describe('EsqueciSenha', () => {
  it('manda o pedido e mostra a mesma resposta da API', async () => {
    api.forgotPassword.mockResolvedValue({
      message: 'Se houver uma conta com esse e-mail, enviamos um link.',
    });
    abrir('/esqueci-senha', <EsqueciSenha />);
    fireEvent.change(screen.getByPlaceholderText('voce@exemplo.com'), {
      target: { value: ' aluna@exemplo.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar o link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se houver uma conta com esse e-mail',
    );
    expect(api.forgotPassword).toHaveBeenCalledWith('aluna@exemplo.com');

    // Pedir de novo volta ao formulário.
    fireEvent.click(screen.getByRole('button', { name: 'Pedir outro link' }));
    expect(screen.getByPlaceholderText('voce@exemplo.com')).toBeInTheDocument();
  });

  it('mostra o erro da API (ex.: muitas tentativas)', async () => {
    api.forgotPassword.mockRejectedValue(
      new HttpError(429, 'Muitas tentativas. Tente de novo em 60 min.', 3600),
    );
    abrir('/esqueci-senha', <EsqueciSenha />);
    fireEvent.change(screen.getByPlaceholderText('voce@exemplo.com'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar o link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('60 min');
  });

  it('servidor sem SMTP explica que não dá para recuperar por aqui', async () => {
    api.authOptions.mockResolvedValue({ passwordReset: false, google: false });
    abrir('/esqueci-senha', <EsqueciSenha />);
    expect(
      await screen.findByText(/não está configurado para mandar e-mail/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mandar o link' })).toBeNull();
  });
});

describe('RedefinirSenha', () => {
  it('lê o token do fragmento, tira da URL, salva e entra', async () => {
    api.resetPassword.mockResolvedValue({
      accessToken: 'jwt-novo',
      user: { id: 'u1', email: 'a@b.com' },
    });
    abrir('/redefinir-senha#token=tok123', <RedefinirSenha />);
    await waitFor(() =>
      expect(screen.getByTestId('onde')).toHaveTextContent(/^\/redefinir-senha$/),
    );

    fireEvent.change(screen.getByLabelText('Senha nova'), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.change(screen.getByLabelText('Repita a senha nova'), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e entrar' }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('jwt-novo'));
    expect(api.resetPassword).toHaveBeenCalledWith('tok123', 'senha-nova-1');
    await waitFor(() =>
      expect(screen.getByTestId('onde')).toHaveTextContent(/^\/$/),
    );
  });

  it('senhas diferentes não vão para a API', () => {
    abrir('/redefinir-senha#token=tok123', <RedefinirSenha />);
    fireEvent.change(screen.getByLabelText('Senha nova'), {
      target: { value: 'senha-nova-1' },
    });
    fireEvent.change(screen.getByLabelText('Repita a senha nova'), {
      target: { value: 'senha-nova-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('não são iguais');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('link vencido: mostra o erro e oferece outro link', async () => {
    api.resetPassword.mockRejectedValue(
      new HttpError(400, 'Este link expirou ou já foi usado.'),
    );
    abrir('/redefinir-senha#token=tok123', <RedefinirSenha />);
    for (const rotulo of ['Senha nova', 'Repita a senha nova']) {
      fireEvent.change(screen.getByLabelText(rotulo), {
        target: { value: 'senha-nova-1' },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expirou');
    expect(screen.getByRole('link', { name: 'Pedir outro link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it('sem token, avisa que o link está incompleto', () => {
    abrir('/redefinir-senha', <RedefinirSenha />);
    expect(screen.getByText(/link está incompleto/)).toBeInTheDocument();
  });
});

describe('EntrarGoogle', () => {
  it('troca o código uma vez só, entra e vai para o início', async () => {
    api.googleExchange.mockResolvedValue({
      accessToken: 'jwt-google',
      user: { id: 'u1', email: 'a@gmail.com' },
      passwordDisabled: false,
    });
    abrir('/entrar/google#code=c123', <EntrarGoogle />);
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('jwt-google'));
    expect(api.googleExchange).toHaveBeenCalledTimes(1);
    expect(api.googleExchange).toHaveBeenCalledWith('c123');
    await waitFor(() =>
      expect(screen.getByTestId('onde')).toHaveTextContent(/^\/$/),
    );
  });

  it('senha antiga desativada: avisa antes de entrar', async () => {
    api.googleExchange.mockResolvedValue({
      accessToken: 'jwt-google',
      user: { id: 'u1', email: 'a@gmail.com' },
      passwordDisabled: true,
    });
    abrir('/entrar/google#code=c123', <EntrarGoogle />);
    expect(await screen.findByText(/senha que ela tinha foi desativada/)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('jwt-google'));
  });

  it.each(Object.entries(ERROS_GOOGLE))('erro "%s" vira frase', (codigo, frase) => {
    abrir(`/entrar/google#erro=${codigo}`, <EntrarGoogle />);
    expect(screen.getByRole('alert')).toHaveTextContent(frase);
    expect(api.googleExchange).not.toHaveBeenCalled();
  });

  it('erro desconhecido ou volta vazia: falha genérica', () => {
    abrir('/entrar/google#erro=outro', <EntrarGoogle />);
    expect(screen.getByRole('alert')).toHaveTextContent(ERROS_GOOGLE.falha);
  });

  it('código recusado pela API mostra a mensagem dela', async () => {
    api.googleExchange.mockRejectedValue(
      new HttpError(400, 'Este login com o Google expirou. Tente de novo.'),
    );
    abrir('/entrar/google#code=c123', <EntrarGoogle />);
    expect(await screen.findByRole('alert')).toHaveTextContent('expirou');
    expect(screen.getByRole('link', { name: 'Voltar para a entrada' })).toBeInTheDocument();
  });
});
