import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Ferramentas from './Ferramentas';
import { FERRAMENTAS, githubUrl } from '../lib/tools';

describe('Ferramentas', () => {
  it('lista os repositórios do GitHub, cada um abrindo numa aba nova', () => {
    render(<Ferramentas />);
    const lista = within(screen.getByRole('list', { name: 'Repositórios' }));
    const links = lista.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://github.com/migueldsants/AI-Skill-Corretor-Redacao-ENEM',
      'https://github.com/migueldsants/updated-enem-api',
    ]);
    for (const a of links) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('mostra nome, repositório, descrição e rótulos de cada ferramenta', () => {
    render(<Ferramentas />);
    for (const f of FERRAMENTAS) {
      const card = screen.getByRole('link', { name: (n) => n.includes(f.nome) });
      expect(card).toHaveTextContent(f.repo);
      expect(card).toHaveTextContent(f.descricao);
      for (const r of f.rotulos) expect(card).toHaveTextContent(r);
    }
  });

  it('githubUrl monta o endereço do repositório', () => {
    expect(githubUrl('dono/repo')).toBe('https://github.com/dono/repo');
  });
});
