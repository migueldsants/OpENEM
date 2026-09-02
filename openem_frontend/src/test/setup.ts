import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpa o DOM entre testes para evitar vazamento de estado.
afterEach(() => {
  cleanup();
});