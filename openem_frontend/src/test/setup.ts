import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom não implementa matchMedia; componentes que consultam
// prefers-reduced-motion (Reveal, PomodoroTimer) quebrariam sem este stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// jsdom também não tem IntersectionObserver (usado pelo Reveal).
if (!('IntersectionObserver' in window)) {
  class NoopIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Limpa o DOM entre testes para evitar vazamento de estado.
afterEach(() => {
  cleanup();
});