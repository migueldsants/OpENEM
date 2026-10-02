import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Ferramentas from './Ferramentas';
import { rotuloEstrelas } from '../lib/estrelas';
import { api, type Tool } from '../api';

vi.mock('../api', () => ({ api: { tools: vi.fn() } }));

const corretor: Tool = {
  name: 'Corretor de redação do Enem',
  repo: 'migueldsants/AI-Skill-Corretor-Redacao-ENEM',
  description: 'Skill para agentes de IA que corrige a redação.',
  tags: ['Skill de IA', 'MIT'],
  url: 'https://github.com/migueldsants/AI-Skill-Corretor-Redacao-ENEM',
  stars: 12,
};
const dataset: Tool = {
  name: 'API ENEM (atualizada)',
  repo: 'migueldsants/updated-enem-api',
  description: 'Provas e questões oficiais do ENEM.',
  tags: ['Dados e API', 'GPL-2.0'],
  url: 'https://github.com/migueldsants/updated-enem-api',
  stars: null,
};

describe('Ferramentas', () => {
  beforeEach(() => {
    vi.mocked(api.tools).mockReset();
  });

  it('cada cartão tem o botão de dar estrela, que abre o repositório numa aba nova', async () => {
    vi.mocked(api.tools).mockResolvedValue([corretor, dataset]);
    render(<Ferramentas />);
    const lista = within(await screen.findByRole('list', { name: 'Repositórios' }));
    const botoes = lista.getAllByRole('link', { name: /^Dar estrela a/ });
    expect(botoes.map((a) => a.getAttribute('href'))).toEqual([corretor.url, dataset.url]);
    for (const a of botoes) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('mostra a contagem de estrelas, que leva à lista de quem deu estrela', async () => {
    vi.mocked(api.tools).mockResolvedValue([corretor]);
    render(<Ferramentas />);
    const contagem = await screen.findByRole('link', { name: /12 estrelas/ });
    expect(contagem).toHaveAttribute('href', `${corretor.url}/stargazers`);
    expect(contagem).toHaveAttribute('target', '_blank');
  });

  it('sem resposta do GitHub, omite a contagem e mantém o botão', async () => {
    vi.mocked(api.tools).mockResolvedValue([dataset]);
    render(<Ferramentas />);
    expect(
      await screen.findByRole('link', { name: /Dar estrela a API ENEM/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d estrelas?/)).not.toBeInTheDocument();
  });

  it('mostra nome, repositório, descrição e rótulos', async () => {
    vi.mocked(api.tools).mockResolvedValue([corretor]);
    render(<Ferramentas />);
    const card = (await screen.findByText(corretor.name)).closest('article')!;
    expect(card).toHaveTextContent(corretor.repo);
    expect(card).toHaveTextContent(corretor.description);
    for (const r of corretor.tags) expect(card).toHaveTextContent(r);
  });

  it('convida a dar estrela', async () => {
    vi.mocked(api.tools).mockResolvedValue([corretor]);
    render(<Ferramentas />);
    expect(await screen.findByText(/Deixe uma estrela/)).toBeInTheDocument();
  });

  it('erro de rede mostra o aviso com "Tentar de novo"', async () => {
    vi.mocked(api.tools)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([corretor]);
    render(<Ferramentas />);
    const alerta = await screen.findByRole('alert');
    within(alerta).getByRole('button', { name: 'Tentar de novo' }).click();
    expect(await screen.findByText(corretor.name)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('rotuloEstrelas', () => {
  it('singular, plural e número compacto', () => {
    expect(rotuloEstrelas(0)).toBe('0 estrelas');
    expect(rotuloEstrelas(1)).toBe('1 estrela');
    expect(rotuloEstrelas(12)).toBe('12 estrelas');
    // O Intl separa "1,2" de "mil" com espaço não separável: não quebra a linha.
    expect(rotuloEstrelas(1234)).toBe('1,2\u00a0mil estrelas');
  });
});
