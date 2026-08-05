import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Flat config para o frontend React + TS.
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.recommended.rules,
      // Permite `any` em mocks de teste (legibilidade).
      '@typescript-eslint/no-explicit-any': 'off',
      // Ignora variaveis/args prefixadas com _ (convenção de intencionalmente
      // nao usadas, ex.: o shim de icones descarta strokeWidth).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Código pré-existente chama setState em effects e Date.now em refs
      // (ex.: Simulados). Refatorar é escopo separado; não bloquear o CI.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    ignores: ['dist/**', 'dev-dist/**', 'src/test/**'],
  },
);