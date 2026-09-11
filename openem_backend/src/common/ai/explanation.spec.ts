import {
  buildExplanationPrompt,
  ExplanationInput,
  generateExplanation,
  MAX_EXPLANATION_CHARS,
  normalizeExplanation,
} from './explanation';

const INPUT: ExplanationInput = {
  statement: 'Um cone reto tem 36 cm de altura.',
  questionPrompt: 'Qual é a massa da escultura?',
  alternatives: [
    { letter: 'A', text: '1.198,8', hasImage: false },
    { letter: 'B', text: '1.296,0', hasImage: false },
    { letter: 'C', text: '', hasImage: true },
  ],
  correctLetter: 'B',
  areaName: 'Matemática e suas Tecnologias',
  topicName: null,
  examLabel: 'ENEM 2023',
};

describe('buildExplanationPrompt', () => {
  const prompt = buildExplanationPrompt(INPUT);

  it('inclui enunciado, comando e o gabarito oficial', () => {
    expect(prompt).toContain('Um cone reto tem 36 cm');
    expect(prompt).toContain('Qual é a massa da escultura?');
    expect(prompt).toContain('Gabarito oficial: B');
  });

  it('lista todas as alternativas, sinalizando as que são imagem', () => {
    expect(prompt).toContain('A) 1.198,8');
    expect(prompt).toContain('B) 1.296,0');
    // A IA não vê a imagem: avisar evita que ela invente o conteúdo.
    expect(prompt).toContain('C) [alternativa em imagem]');
  });

  it('omite o que não existe em vez de mandar "null"', () => {
    expect(prompt).not.toContain('Assunto:');
    expect(prompt).not.toContain('null');
    expect(
      buildExplanationPrompt({ ...INPUT, questionPrompt: null }),
    ).not.toContain('Comando:');
  });
});

describe('normalizeExplanation', () => {
  it('extrai o comentário do JSON', () => {
    expect(
      normalizeExplanation(JSON.stringify({ explanation: '  Porque sim.  ' })),
    ).toBe('Porque sim.');
  });

  it('rejeita JSON inválido — gravar lixo impediria nova tentativa', () => {
    expect(() => normalizeExplanation('não é json')).toThrow();
  });

  it('rejeita comentário vazio ou ausente', () => {
    expect(() => normalizeExplanation('{"explanation":"   "}')).toThrow();
    expect(() => normalizeExplanation('{"outra":"coisa"}')).toThrow();
    expect(() => normalizeExplanation('{"explanation":42}')).toThrow();
  });

  it('corta comentários longos demais', () => {
    const longo = 'a'.repeat(MAX_EXPLANATION_CHARS + 500);
    const out = normalizeExplanation(JSON.stringify({ explanation: longo }));
    expect(out.length).toBeLessThanOrEqual(MAX_EXPLANATION_CHARS + 1);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('generateExplanation', () => {
  it('chama o provedor com o schema do comentário e normaliza a resposta', async () => {
    const complete = jest
      .fn()
      .mockResolvedValue(JSON.stringify({ explanation: 'Comentário.' }));

    const out = await generateExplanation(INPUT, complete);

    expect(out).toBe('Comentário.');
    const req = complete.mock.calls[0][0];
    expect(req.schemaName).toBe('enem_question_explanation');
    expect(req.user).toContain('Gabarito oficial: B');
    expect(req.system).toContain('ENEM');
  });

  it('propaga a falha do provedor', async () => {
    const complete = jest.fn().mockRejectedValue(new Error('rate limit'));
    await expect(generateExplanation(INPUT, complete)).rejects.toThrow(
      'rate limit',
    );
  });
});
