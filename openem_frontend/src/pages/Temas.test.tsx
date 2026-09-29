import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type SavedTheme } from '../api';
import { paletteFromBrand } from '../lib/theme-derive';
import { ThemeProvider } from '../theme';
import Temas from './Temas';

vi.mock('../api', () => ({
  api: {
    myThemes: vi.fn(),
    communityThemes: vi.fn(),
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
    toggleThemeLike: vi.fn(),
  },
}));

function saved(over: Partial<SavedTheme> = {}): SavedTheme {
  return {
    id: 'th-1',
    name: 'Mar Profundo',
    light: paletteFromBrand('#00707a', 'light'),
    dark: paletteFromBrand('#00707a', 'dark'),
    isPublic: true,
    likes: 2,
    liked: false,
    mine: false,
    author: 'Bia',
    publishedAt: '2026-09-29T12:00:00Z',
    updatedAt: '2026-09-29T12:00:00Z',
    ...over,
  };
}

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Temas />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const root = document.documentElement;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('openem.theme', 'default-light');
  root.removeAttribute('style');
  vi.mocked(api.myThemes).mockResolvedValue([]);
  vi.mocked(api.communityThemes).mockResolvedValue([]);
});

describe('Temas', () => {
  it('galeria agrupa as famílias e aplica a escolhida', () => {
    renderPage();
    for (const grupo of ['Clássicos', 'Customizados', 'OLED', 'Acessibilidade']) {
      expect(screen.getByRole('heading', { name: grupo })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /Cyberpunk/ }));
    expect(root.dataset.theme).toBe('cyberpunk-light');
    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(root.dataset.theme).toBe('cyberpunk-dark');
  });

  it('cria um tema no editor, salva na conta e passa a usá-lo', async () => {
    vi.mocked(api.createTheme).mockImplementation(async (input) =>
      saved({ id: 'novo', name: input.name, light: input.light, dark: input.dark, mine: true, isPublic: false }),
    );
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Criar tema/ })[0]);
    fireEvent.change(screen.getByLabelText('Nome do tema'), { target: { value: 'Noite de Estudo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e usar' }));

    await waitFor(() => expect(api.createTheme).toHaveBeenCalled());
    const input = vi.mocked(api.createTheme).mock.calls[0][0];
    expect(input.name).toBe('Noite de Estudo');
    expect(input.light.bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(input.dark.bg).toMatch(/^#[0-9a-f]{6}$/);
    await waitFor(() => expect(root.dataset.theme).toBe('custom-light'));
    expect(root.style.getPropertyValue('--bg')).toBe(input.light.bg);
    expect(JSON.parse(localStorage.getItem('openem.theme.custom')!).id).toBe('novo');
  });

  it('nome curto ou cor inválida travam o salvar', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Criar tema/ })[0]);
    fireEvent.change(screen.getByLabelText('Nome do tema'), { target: { value: 'X' } });
    expect(screen.getByRole('button', { name: 'Salvar e usar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nome do tema'), { target: { value: 'Válido' } });
    fireEvent.change(screen.getByLabelText('Fundo'), { target: { value: 'url(x)' } });
    expect(screen.getByText('Use o formato #rrggbb.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar e usar' })).toBeDisabled();
  });

  it('comunidade: curtida otimista reconcilia com o servidor', async () => {
    vi.mocked(api.communityThemes).mockResolvedValue([saved()]);
    vi.mocked(api.toggleThemeLike).mockResolvedValue({ liked: true, likes: 3 });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Comunidade' }));
    const like = await screen.findByRole('button', { name: 'Curtir Mar Profundo' });
    expect(screen.getByText('por Bia')).toBeInTheDocument();
    fireEvent.click(like);
    const pressed = await screen.findByRole('button', { name: 'Descurtir Mar Profundo' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(within(pressed).getByText('3')).toBeInTheDocument());
    expect(api.toggleThemeLike).toHaveBeenCalledWith('th-1');
  });

  it('comunidade: curtida que falha volta atrás e mostra o erro', async () => {
    vi.mocked(api.communityThemes).mockResolvedValue([saved()]);
    vi.mocked(api.toggleThemeLike).mockRejectedValue(new Error('Sem conexão'));
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Comunidade' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Curtir Mar Profundo' }));
    expect(await screen.findByText('Sem conexão')).toBeInTheDocument();
    const like = screen.getByRole('button', { name: 'Curtir Mar Profundo' });
    expect(like).toHaveAttribute('aria-pressed', 'false');
    expect(within(like).getByText('2')).toBeInTheDocument();
  });

  it('comunidade: usar tema de outro aluno aplica sem guardar o id dele', async () => {
    vi.mocked(api.communityThemes).mockResolvedValue([saved()]);
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Comunidade' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Usar' }));
    expect(root.dataset.theme).toBe('custom-light');
    const local = JSON.parse(localStorage.getItem('openem.theme.custom')!);
    expect(local.name).toBe('Mar Profundo');
    expect(local).not.toHaveProperty('id');
  });

  it('comunidade: não deixa curtir o próprio tema', async () => {
    vi.mocked(api.communityThemes).mockResolvedValue([saved({ mine: true })]);
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Comunidade' }));
    expect(await screen.findByRole('button', { name: '2 curtidas no seu tema' })).toBeDisabled();
  });

  it('meus temas: publica e apaga com confirmação', async () => {
    const mine = saved({ mine: true, isPublic: false, likes: 0 });
    vi.mocked(api.myThemes).mockResolvedValue([mine]);
    vi.mocked(api.updateTheme).mockResolvedValue({ ...mine, isPublic: true });
    vi.mocked(api.deleteTheme).mockResolvedValue({ removed: true });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Meus temas' }));
    expect(await screen.findByText('Privado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(api.updateTheme).toHaveBeenCalledWith('th-1', { isPublic: true }));
    expect(await screen.findByRole('button', { name: 'Despublicar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apagar Mar Profundo' }));
    expect(api.deleteTheme).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(api.deleteTheme).toHaveBeenCalledWith('th-1'));
    expect(await screen.findByText('Nenhum tema salvo ainda')).toBeInTheDocument();
  });

  it('meus temas: estado vazio chama para criar', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Meus temas' }));
    expect(await screen.findByText('Nenhum tema salvo ainda')).toBeInTheDocument();
  });
});
