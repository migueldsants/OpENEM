import { activeAiProvider, isAiConfigured } from './index';
import * as anthropic from './providers/anthropic';
import * as gemini from './providers/gemini';
import { toGeminiSchema } from './providers/gemini-schema';
import * as openai from './providers/openai';

const CHAVES = [
  'AI_PROVIDER',
  'ESSAY_AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
];

describe('seleção de provedor de IA', () => {
  const original = { ...process.env };

  beforeEach(() => {
    for (const k of CHAVES) delete process.env[k];
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('sem nenhuma chave, não há provedor', () => {
    expect(activeAiProvider()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  it('detecta o primeiro provedor configurado, na ordem de prioridade', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'g-test';
    expect(activeAiProvider()).toBe('openai');

    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    expect(activeAiProvider()).toBe('anthropic');
  });

  it('AI_PROVIDER explícito vence a detecção', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.GEMINI_API_KEY = 'g-test';
    process.env.AI_PROVIDER = 'gemini';
    expect(activeAiProvider()).toBe('gemini');
  });

  it('AI_PROVIDER apontando para provedor sem chave não vale', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(activeAiProvider()).toBeNull();
  });

  it('o escopo da redação respeita ESSAY_AI_PROVIDER, que já está publicado', () => {
    // Retrocompatibilidade: o docker-compose entregue passa essa variável.
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.GEMINI_API_KEY = 'g-test';
    process.env.ESSAY_AI_PROVIDER = 'gemini';
    expect(activeAiProvider('essay')).toBe('gemini');
    // Fora do escopo da redação, ESSAY_AI_PROVIDER é ignorado.
    expect(activeAiProvider()).toBe('anthropic');
  });

  it('GOOGLE_API_KEY também configura o Gemini', () => {
    process.env.GOOGLE_API_KEY = 'g-test';
    expect(activeAiProvider()).toBe('gemini');
  });

  it('endpoint compatível é o último da fila', () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    expect(activeAiProvider()).toBe('openai-compatible');
  });

  // O docker-compose passa `${VAR:-}`: o que falta no .env chega vazio.
  it('variável vazia conta como ausente', () => {
    for (const k of CHAVES) process.env[k] = '';
    expect(activeAiProvider()).toBeNull();

    process.env.GEMINI_API_KEY = '  ';
    process.env.GOOGLE_API_KEY = 'g-test';
    expect(activeAiProvider()).toBe('gemini');
    expect(gemini.apiKey()).toBe('g-test');
  });

  it('ESSAY_AI_PROVIDER vazio cai no AI_PROVIDER', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    process.env.GEMINI_API_KEY = 'g-test';
    process.env.ESSAY_AI_PROVIDER = '';
    process.env.AI_PROVIDER = 'gemini';
    expect(activeAiProvider('essay')).toBe('gemini');
  });
});

describe('modelo de cada provedor', () => {
  const MODELOS = ['ANTHROPIC_MODEL', 'OPENAI_MODEL', 'GEMINI_MODEL'];
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('modelo vazio no .env usa o padrão, nunca a string vazia', () => {
    for (const k of MODELOS) process.env[k] = '';
    expect(anthropic.model({})).toBe('claude-opus-4-8');
    expect(openai.model({})).toBe('gpt-4o');
    expect(openai.model({}, true)).toBe('llama3.1');
    expect(gemini.model({})).toBe('gemini-2.5-flash');
  });

  it('modelo do .env vence o padrão', () => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5-5';
    process.env.OPENAI_MODEL = 'gpt-x';
    process.env.GEMINI_MODEL = 'gemini-x';
    expect(anthropic.model({})).toBe('claude-sonnet-5-5');
    expect(openai.model({})).toBe('gpt-x');
    expect(openai.model({}, true)).toBe('gpt-x');
    expect(gemini.model({})).toBe('gemini-x');
  });

  it('modelo do pedido vence o .env, e pedido vazio é ignorado', () => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5-5';
    expect(anthropic.model({ model: 'claude-haiku-5-5' })).toBe(
      'claude-haiku-5-5',
    );
    // AI_EXPLANATION_MODEL/AI_CLASSIFY_MODEL vazios chegam como model: ''.
    expect(anthropic.model({ model: '' })).toBe('claude-sonnet-5-5');
  });
});

describe('toGeminiSchema', () => {
  it('converte tipos e propriedades aninhadas', () => {
    expect(
      toGeminiSchema({
        type: 'object',
        properties: {
          nota: { type: 'integer' },
          texto: { type: 'string' },
          interno: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
          },
        },
        required: ['nota', 'texto'],
      }),
    ).toEqual({
      type: 'OBJECT',
      properties: {
        nota: { type: 'INTEGER' },
        texto: { type: 'STRING' },
        interno: {
          type: 'OBJECT',
          properties: { ok: { type: 'BOOLEAN' } },
          required: ['ok'],
        },
      },
      required: ['nota', 'texto'],
    });
  });

  it('converte arrays de objetos', () => {
    expect(
      toGeminiSchema({
        type: 'array',
        items: { type: 'object', properties: { a: { type: 'string' } } },
      }),
    ).toEqual({
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { a: { type: 'STRING' } } },
    });
  });

  it('enum vira STRING — é o único tipo em que o Gemini aceita enum', () => {
    expect(toGeminiSchema({ type: 'integer', enum: [0, 40, 80] })).toEqual({
      type: 'STRING',
      enum: ['0', '40', '80'],
    });
  });

  it('preserva a descrição, que guia o modelo', () => {
    expect(
      toGeminiSchema({ type: 'string', description: 'o assunto da questão' }),
    ).toEqual({ type: 'STRING', description: 'o assunto da questão' });
  });
});
