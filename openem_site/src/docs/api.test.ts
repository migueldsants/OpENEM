import { describe, expect, it } from 'vitest';
import { openApiParaMarkdown, tipo, type OpenApi } from './api';
import documento from './api/openapi.json';

const DOC: OpenApi = {
  paths: {
    '/health': { get: { summary: 'Saúde', responses: { '200': {} } } },
    '/api/v1/auth/login': {
      post: {
        summary: 'Autentica',
        tags: ['auth'],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } } },
        },
        responses: { '200': {}, '429': {} },
      },
    },
    '/api/v1/questions/{id}': {
      get: {
        summary: 'Detalha — com gabarito',
        tags: ['questions'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'nivel', in: 'query', schema: { type: 'number', minimum: 1, maximum: 5 } },
        ],
        responses: { '200': {} },
      },
    },
  },
  components: {
    schemas: {
      LoginDto: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'E-mail | da conta' },
          password: { type: 'string', maxLength: 72 },
        },
        required: ['email'],
      },
    },
  },
};

describe('tipo', () => {
  it.each([
    [{ type: 'string' }, 'string'],
    [{ type: 'number', minimum: 1, maximum: 5 }, 'number, de 1 a 5'],
    [{ enum: ['ingles', 'espanhol'] }, '"ingles" \\| "espanhol"'],
    [{ type: 'array', items: { $ref: '#/components/schemas/X' } }, 'X[]'],
    [{ type: 'string', format: 'date-time' }, 'string (date-time)'],
  ])('%j → %s', (s, esperado) => {
    expect(tipo(s)).toBe(esperado);
  });
});

describe('openApiParaMarkdown', () => {
  const md = openApiParaMarkdown(DOC);

  it('agrupa por tag, com as rotas fora do prefixo primeiro', () => {
    const titulos = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(titulos).toEqual(['geral', 'auth', 'questions']);
  });

  it('cada rota tem método e caminho, e diz se exige login', () => {
    expect(md).toContain('### `GET /api/v1/questions/{id}`');
    expect(md).toMatch(/questions\/\{id\}`\n\nDetalha: com gabarito\n\nExige login/);
    expect(md).toMatch(/auth\/login`\n\nAutentica\n\nSem login/);
  });

  it('lista os parâmetros e os campos do corpo', () => {
    expect(md).toContain('| `id` | caminho | string | sim |');
    expect(md).toContain('| `nivel` | query | number, de 1 a 5 | não |');
    expect(md).toContain('Corpo (JSON): `LoginDto`');
    expect(md).toContain('| `email` | string | sim | E-mail \\| da conta |');
    expect(md).toContain('| `password` | string, até 72 caracteres | não |');
    expect(md).toContain('Respostas: `200`, `429`.');
  });

  it('não deixa travessão nem H1 (regras da documentação)', () => {
    expect(md).not.toMatch(/[—–]/);
    expect(md).not.toMatch(/^# /m);
  });
});

describe('o openapi.json do repositório', () => {
  const doc = documento as unknown as OpenApi;

  it('tem as rotas principais da API', () => {
    for (const rota of ['/health', '/api/v1/auth/login', '/api/v1/questions', '/api/v1/simulations']) {
      expect(Object.keys(doc.paths), rota).toContain(rota);
    }
  });

  it('vira uma página sem travessão', () => {
    expect(openApiParaMarkdown(doc)).not.toMatch(/[—–]/);
  });
});
