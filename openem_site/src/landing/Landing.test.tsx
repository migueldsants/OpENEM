import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPONSOR_URL } from '../config';
import { Landing } from './Landing';

describe('Landing: rodapé', () => {
  it('aponta para a Política de Privacidade e os Termos de Uso', () => {
    render(<Landing />);
    const rodape = screen.getByRole('navigation', { name: 'Rodapé' });
    expect(within(rodape).getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/privacidade/');
    expect(within(rodape).getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos/');
  });
});

describe('Landing: patrocínio', () => {
  it('convida a patrocinar só com links discretos, que abrem o GitHub Sponsors em aba nova', () => {
    render(<Landing />);
    const links = [
      screen.getByRole('link', { name: /Patrocinar no GitHub/ }),
      within(screen.getByRole('navigation', { name: 'Rodapé' })).getByRole('link', { name: 'Patrocinar' }),
    ];
    for (const link of links) {
      expect(link).toHaveAttribute('href', SPONSOR_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.className).not.toMatch(/btn-primary/);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Landing: tabela periódica', () => {
  it('tem a seção com a prévia e leva à tela do app', () => {
    render(<Landing />);
    const secao = screen.getByRole('region', { name: /A tabela periódica inteira/ });
    expect(within(secao).getByRole('link', { name: /Abrir a tabela periódica/ })).toHaveAttribute(
      'href',
      '/app/tabela-periodica',
    );
    expect(screen.getByRole('navigation', { name: 'Seções' })).toContainElement(
      screen.getByRole('link', { name: 'Tabela periódica' }),
    );
  });

  it('trocar a cor marca o modo escolhido e mostra o sentido da tendência', () => {
    render(<Landing />);
    const grupo = screen.getByRole('group', { name: 'Colorir a tabela por' });
    expect(within(grupo).getByRole('button', { name: 'Categorias' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Eletronegatividade' }));
    expect(within(grupo).getByRole('button', { name: 'Eletronegatividade' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cresce para a direita e para cima.')).toBeInTheDocument();
  });

  it('as setas andam pela grade e o elemento escolhido vai para o vão', () => {
    render(<Landing />);
    const grade = screen.getByRole('group', { name: /use as setas/ });
    expect(grade).toHaveAttribute('tabindex', '0');
    expect(screen.getAllByText('Carbono').length).toBeGreaterThan(0);
    fireEvent.keyDown(grade, { key: 'ArrowRight' });
    expect(screen.getAllByText('Nitrogênio').length).toBeGreaterThan(0);
    expect(screen.queryByText('Carbono')).not.toBeInTheDocument();
  });

  it('valor estimado aparece marcado como estimado', () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole('button', { name: 'Eletronegatividade' }));
    const grade = screen.getByRole('group', { name: /use as setas/ });
    // Do C (linha 2) até o Fr, que tem a eletronegatividade estimada: 5 para baixo e 13 para a esquerda.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(grade, { key: 'ArrowDown' });
    for (let i = 0; i < 13; i++) fireEvent.keyDown(grade, { key: 'ArrowLeft' });
    expect(screen.getAllByText('Frâncio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('estimado').length).toBeGreaterThan(0);
  });
});

describe('Landing: animações', () => {
  const observados: Element[] = [];
  class ObservadorFalso {
    constructor(private readonly aoCruzar: IntersectionObserverCallback) {}
    observe(el: Element) {
      observados.push(el);
    }
    unobserve() {}
    disconnect() {}
    cruzar(el: Element) {
      this.aoCruzar([{ target: el, isIntersecting: true } as IntersectionObserverEntry], this as never);
    }
  }
  let ultimo: ObservadorFalso | null = null;

  function simularRolagem(reduzido: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: reduzido && q.includes('reduce'), media: q }) as MediaQueryList,
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class extends ObservadorFalso {
        constructor(cb: IntersectionObserverCallback) {
          super(cb);
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          ultimo = this;
        }
      },
    );
    // Tudo abaixo da dobra.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 5000 } as DOMRect);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    observados.length = 0;
    ultimo = null;
  });

  it('o HTML pré-renderizado vem no estado final (nada esperando a rolagem)', () => {
    const html = renderToString(<Landing />);
    expect(html).not.toContain('data-estado');
    expect(html).toContain('7.781');
    expect(html).toContain('2h30');
  });

  it('abaixo da dobra, os blocos esperam e aparecem quando entram na tela', () => {
    simularRolagem(false);
    const { container } = render(<Landing />);
    const blocos = container.querySelectorAll('[data-revela]');
    expect(blocos.length).toBeGreaterThan(5);
    for (const b of blocos) expect(b).toHaveAttribute('data-estado', 'espera');
    act(() => ultimo!.cruzar(blocos[0]));
    expect(blocos[0]).toHaveAttribute('data-estado', 'visto');
  });

  it('com movimento reduzido, nada espera: tudo já está no estado final', () => {
    simularRolagem(true);
    const { container } = render(<Landing />);
    expect(container.querySelector('[data-estado]')).toBeNull();
    expect(observados).toHaveLength(0);
    expect(screen.getByText('2h30')).toBeInTheDocument();
  });
});

describe('Landing: botão do app', () => {
  afterEach(() => localStorage.clear());

  it('sem sessão, convida a começar e leva ao /app/', () => {
    render(<Landing />);
    const botoes = screen.getAllByRole('link', { name: /Começar a estudar/ });
    expect(botoes.length).toBeGreaterThan(0);
    for (const b of botoes) expect(b).toHaveAttribute('href', '/app/');
  });

  it('com sessão do app na mesma origem, vira "Continuar estudando"', async () => {
    localStorage.setItem('openem.token', 'tok');
    render(<Landing />);
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Continuar estudando/ }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('link', { name: /Começar a estudar/ })).not.toBeInTheDocument();
  });

  it('o HTML pré-renderizado sempre diz "Começar" (funciona sem JavaScript)', () => {
    localStorage.setItem('openem.token', 'tok');
    const html = renderToString(<Landing />);
    expect(html).toContain('Começar a estudar');
    expect(html).not.toContain('Continuar estudando');
  });
});
