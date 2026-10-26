// Direitos do titular no Perfil: baixar os dados e excluir a conta com a senha.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, HttpError } from '../api';
import { limparDadosDoAparelho } from '../lib/conta';
import { baixarArquivo } from '../lib/download';
import { MeusDados } from './MeusDados';

const logout = vi.fn();

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    api: { exportMyData: vi.fn(), deleteAccount: vi.fn() },
  };
});
vi.mock('../auth', () => ({ useAuth: () => ({ logout }) }));
vi.mock('../lib/download', () => ({ baixarArquivo: vi.fn() }));
vi.mock('../lib/conta', async () => {
  const actual = await vi.importActual<typeof import('../lib/conta')>('../lib/conta');
  return { ...actual, limparDadosDoAparelho: vi.fn(() => Promise.resolve()) };
});

const mockedApi = vi.mocked(api);

function TelaDeLogin() {
  const state = useLocation().state as { contaExcluida?: boolean } | null;
  return <p>login{state?.contaExcluida ? ' após exclusão' : ''}</p>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route path="/perfil" element={<MeusDados />} />
        <Route path="/login" element={<TelaDeLogin />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MeusDados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aponta para a Política de Privacidade e os Termos de Uso', () => {
    renderizar();
    expect(
      screen.getByRole('link', { name: 'Política de Privacidade' }),
    ).toHaveAttribute('href', '/privacidade/');
    expect(screen.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute(
      'href',
      '/termos/',
    );
  });

  it('baixa os dados num arquivo JSON', async () => {
    mockedApi.exportMyData.mockResolvedValue({ account: { email: 'a@b.com' } });
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Baixar meus dados' }));

    await waitFor(() => expect(baixarArquivo).toHaveBeenCalled());
    const [blob, nome] = vi.mocked(baixarArquivo).mock.calls[0];
    expect(nome).toMatch(/^openem-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await blob.text())).toEqual({
      account: { email: 'a@b.com' },
    });
  });

  it('erro ao baixar aparece na tela', async () => {
    mockedApi.exportMyData.mockRejectedValue(
      new HttpError(429, 'Muitas tentativas. Tente de novo em 5 min.', 300),
    );
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Baixar meus dados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas',
    );
    expect(baixarArquivo).not.toHaveBeenCalled();
  });

  it('senha errada não exclui, não limpa o aparelho e não desloga', async () => {
    mockedApi.deleteAccount.mockRejectedValue(
      new HttpError(403, 'Senha incorreta'),
    );
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));

    const dialogo = screen.getByRole('dialog', { name: 'Excluir a conta' });
    const confirmar = screen.getByRole('button', { name: 'Excluir para sempre' });
    expect(confirmar).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Sua senha'), {
      target: { value: 'errada' },
    });
    fireEvent.click(confirmar);

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta');
    expect(mockedApi.deleteAccount).toHaveBeenCalledWith('errada');
    expect(limparDadosDoAparelho).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(dialogo).toBeInTheDocument();
  });

  it('com a senha certa, exclui, limpa o aparelho, desloga e volta ao login', async () => {
    mockedApi.deleteAccount.mockResolvedValue(undefined);
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));
    fireEvent.change(screen.getByLabelText('Sua senha'), {
      target: { value: 'senhaForte123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir para sempre' }));

    expect(await screen.findByText('login após exclusão')).toBeInTheDocument();
    expect(mockedApi.deleteAccount).toHaveBeenCalledWith('senhaForte123');
    expect(limparDadosDoAparelho).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });

  it('cancelar fecha a confirmação sem excluir', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockedApi.deleteAccount).not.toHaveBeenCalled();
  });
});
