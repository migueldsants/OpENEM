import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Reveal from './Reveal';

// jsdom não implementa matchMedia nem IntersectionObserver.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false } as unknown as MediaQueryList),
  );
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});

describe('Reveal', () => {
  it('renderiza o filho imediatamente quando reduce-motion esta ativo', () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);
    render(
      <Reveal>
        <span>conteudo</span>
      </Reveal>,
    );
    expect(screen.getByText('conteudo')).toBeVisible();
  });

  it('renderiza o filho (hidden) quando reduce-motion inativo', () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: false,
    } as unknown as MediaQueryList);
    render(
      <Reveal>
        <span>escondido</span>
      </Reveal>,
    );
    // O filho existe no DOM, mas inicialmente com a classe reveal-hidden.
    expect(screen.getByText('escondido')).toBeInTheDocument();
  });

  it('aceita tag customizada (section)', () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);
    render(<Reveal as="section">x</Reveal>);
    expect(screen.getByText('x').tagName).toBe('SECTION');
  });
});