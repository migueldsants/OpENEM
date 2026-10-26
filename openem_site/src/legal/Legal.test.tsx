import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderizar } from '../entry-server';
import { Legal } from './Legal';

describe('Legal', () => {
  it('mostra a política com a data, o título e o link para o inglês', () => {
    render(<Legal url="/privacidade/" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeInTheDocument();
    expect(screen.getByText('25 de outubro de 2026')).toHaveAttribute('dateTime', '2026-10-25');
    expect(screen.getByRole('link', { name: /Read in English/ })).toHaveAttribute('href', '/en/privacidade/');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('em inglês, volta para o português e o rodapé marca a página atual', () => {
    render(<Legal url="/en/termos/" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ler em português/ })).toHaveAttribute('href', '/termos/');
    const rodape = within(screen.getByRole('contentinfo'));
    expect(rodape.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('aria-current', 'page');
    expect(rodape.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/en/privacidade/');
    expect(rodape.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs/en/');
  });

  it('URL fora das páginas legais não renderiza nada', () => {
    expect(renderToString(<Legal url="/outra/" />)).toBe('');
  });
});

describe('pré-renderização das páginas legais', () => {
  it('grava título, descrição, canonical, idioma e as duas versões', () => {
    const { html, head, lang } = renderizar('/en/privacidade/');
    expect(lang).toBe('en');
    expect(head).toContain('<title>Privacy Policy | OpENEM</title>');
    expect(head).toContain('<link rel="canonical" href="/en/privacidade/" />');
    expect(head).toContain('<link rel="alternate" hreflang="pt-BR" href="/privacidade/" />');
    expect(head).toContain('<link rel="alternate" hreflang="en" href="/en/privacidade/" />');
    expect(html).toContain('Privacy Policy');
  });
});
