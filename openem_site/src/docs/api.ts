/**
 * Referência da API (issue #89): a página é montada do openapi.json que o
 * backend gera a partir dos próprios controllers (`npm run openapi` em
 * openem_backend; o CI confere que o arquivo está em dia). Nada aqui é escrito
 * à mão: rota nova no backend aparece na documentação no próximo build.
 */

interface Schema {
  type?: string;
  format?: string;
  enum?: unknown[];
  items?: Schema;
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  minLength?: number;
  example?: unknown;
}

interface Parametro {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
}

interface Operacao {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parametro[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { description?: string }>;
  security?: unknown[];
}

export interface OpenApi {
  info?: { title?: string; version?: string };
  paths: Record<string, Record<string, Operacao>>;
  components?: { schemas?: Record<string, Schema> };
}

const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Rotas fora do prefixo /api/v1 (a raiz e o healthcheck) ficam num grupo à parte. */
const SEM_TAG = 'geral';

/** Texto vindo do código, pronto para uma célula de tabela Markdown. */
function celula(texto: string | undefined): string {
  return (texto ?? '')
    .replace(/\s*[—–]\s*/g, ': ')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function nomeDoRef(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

/** Tipo legível de um schema: `string`, `number (1 a 5)`, `"ingles" | "espanhol"`, `LoginDto[]`. */
export function tipo(s: Schema | undefined): string {
  if (!s) return '';
  if (s.$ref) return nomeDoRef(s.$ref);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' \\| ');
  if (s.type === 'array') return `${tipo(s.items) || 'valor'}[]`;
  let t = s.format ? `${s.type} (${s.format})` : (s.type ?? 'objeto');
  if (s.minimum !== undefined && s.maximum !== undefined) t += `, de ${s.minimum} a ${s.maximum}`;
  else if (s.minimum !== undefined) t += `, mínimo ${s.minimum}`;
  else if (s.maximum !== undefined) t += `, máximo ${s.maximum}`;
  if (s.maxLength !== undefined) t += `, até ${s.maxLength} caracteres`;
  return t;
}

function esquemaDoCorpo(op: Operacao): Schema | undefined {
  return op.requestBody?.content?.['application/json']?.schema;
}

function tabelaDeCampos(s: Schema, esquemas: Record<string, Schema>): string[] {
  const alvo = s.$ref ? esquemas[nomeDoRef(s.$ref)] : s;
  const campos = Object.entries(alvo?.properties ?? {});
  if (campos.length === 0) return [];
  const obrigatorios = new Set(alvo?.required ?? []);
  return [
    '| Campo | Tipo | Obrigatório | Descrição |',
    '| --- | --- | --- | --- |',
    ...campos.map(
      ([nome, c]) =>
        `| \`${nome}\` | ${celula(tipo(c))} | ${obrigatorios.has(nome) ? 'sim' : 'não'} | ${celula(c.description)} |`,
    ),
  ];
}

/** Monta o corpo Markdown da página, agrupado pela tag de cada rota. */
export function openApiParaMarkdown(doc: OpenApi): string {
  const esquemas = doc.components?.schemas ?? {};
  const porTag = new Map<string, string[]>();

  for (const [caminho, item] of Object.entries(doc.paths)) {
    for (const metodo of METODOS) {
      const op = item[metodo];
      if (!op) continue;
      const tag = op.tags?.[0] ?? SEM_TAG;
      const linhas: string[] = [`### \`${metodo.toUpperCase()} ${caminho}\``, ''];
      if (op.summary) linhas.push(celula(op.summary), '');
      if (op.description) linhas.push(celula(op.description), '');
      linhas.push(op.security?.length ? 'Exige login (token no cabeçalho `Authorization: Bearer`).' : 'Sem login.', '');

      const params = op.parameters ?? [];
      if (params.length) {
        linhas.push(
          '| Parâmetro | Onde | Tipo | Obrigatório | Descrição |',
          '| --- | --- | --- | --- | --- |',
          ...params.map(
            (p) =>
              `| \`${p.name}\` | ${p.in === 'path' ? 'caminho' : p.in === 'query' ? 'query' : p.in} | ${celula(tipo(p.schema))} | ${p.required ? 'sim' : 'não'} | ${celula(p.description)} |`,
          ),
          '',
        );
      }

      const corpo = esquemaDoCorpo(op);
      if (corpo) {
        linhas.push(`Corpo (JSON): ${corpo.$ref ? `\`${nomeDoRef(corpo.$ref)}\`` : celula(tipo(corpo))}`, '');
        const tabela = tabelaDeCampos(corpo, esquemas);
        if (tabela.length) linhas.push(...tabela, '');
      }

      const respostas = Object.keys(op.responses ?? {});
      if (respostas.length) linhas.push(`Respostas: ${respostas.map((r) => `\`${r}\``).join(', ')}.`, '');

      const lista = porTag.get(tag) ?? [];
      lista.push(linhas.join('\n'));
      porTag.set(tag, lista);
    }
  }

  const tags = [...porTag.keys()].sort((a, b) =>
    a === SEM_TAG ? -1 : b === SEM_TAG ? 1 : a.localeCompare(b),
  );
  const total = [...porTag.values()].reduce((n, l) => n + l.length, 0);

  return [
    `A API tem ${total} rotas. As de domínio ficam em \`/api/v1\`; a raiz e o \`/health\` ficam fora do prefixo. Esta página é gerada do próprio código do backend, a partir dos decorators do Swagger: rota nova aparece aqui no próximo build. Numa instância de desenvolvimento, o Swagger interativo fica em \`/api\`.`,
    '',
    'Para usar a API, crie uma conta em `POST /api/v1/auth/register` ou entre em `POST /api/v1/auth/login`, e mande o `accessToken` da resposta no cabeçalho `Authorization: Bearer <token>`. As rotas têm limite de requisições; os números estão em [Produção](/docs/hospedar/producao/).',
    '',
    ...tags.flatMap((t) => [`## ${t}`, '', ...porTag.get(t)!]),
  ].join('\n');
}
