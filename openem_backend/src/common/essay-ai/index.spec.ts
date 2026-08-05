import { activeEssayAiProvider, gradeEssayWithAi } from './index';
import type { AiEssayInput } from './shared';

const baseInput: AiEssayInput = {
  prompt: 'Tema de demonstração',
  instructions: 'Instruções',
  content: 'Uma redação de exemplo.',
};

describe('essay-ai index', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('retorna null quando nenhum provedor esta configurado', () => {
    delete process.env.ESSAY_AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GEMINI_API_KEY;
    expect(activeEssayAiProvider()).toBeNull();
  });

  it('respeita ESSAY_AI_PROVIDER explicito quando a chave do provedor existe', () => {
    process.env.ESSAY_AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(activeEssayAiProvider()).toBe('anthropic');
  });

  it('ignora ESSAY_AI_PROVIDER explicito cujo provedor nao esta configurado', () => {
    process.env.ESSAY_AI_PROVIDER = 'anthropic';
    delete process.env.ANTHROPIC_API_KEY;
    expect(activeEssayAiProvider()).toBeNull();
  });

  it('deteta automaticamente o primeiro provedor configurado (prioridade)', () => {
    delete process.env.ESSAY_AI_PROVIDER;
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'g-test';
    expect(activeEssayAiProvider()).toBe('openai');
  });

  it('gradeEssayWithAi lanca quando nenhum provedor esta configurado', async () => {
    delete process.env.ESSAY_AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.GEMINI_API_KEY;
    let caught: unknown;
    try {
      await gradeEssayWithAi(baseInput);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      'Nenhum provedor de IA de redação configurado',
    );
  });
});