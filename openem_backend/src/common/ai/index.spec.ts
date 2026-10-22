import { activeAiProvider, isAiConfigured } from './index';
import { toGeminiSchema } from './providers/gemini-schema';

const CHAVES = [
  'AI_PROVIDER',
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

  it('GOOGLE_API_KEY também configura o Gemini', () => {
    process.env.GOOGLE_API_KEY = 'g-test';
    expect(activeAiProvider()).toBe('gemini');
  });

  it('endpoint compatível é o último da fila', () => {
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1';
    expect(activeAiProvider()).toBe('openai-compatible');
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
