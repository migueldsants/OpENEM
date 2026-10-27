// node --test tools/contribuidores/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FIM,
  INICIO,
  POR_LINHA,
  cartao,
  juntarAutores,
  montarTabela,
  ordenar,
  substituirBloco,
} from './tabela.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');

const ana = { login: 'ana', nome: 'Ana Souza', id: 1 };
const bia = { login: 'bia', nome: null, id: 2 };
const robo = { login: 'robo', nome: 'Robô', id: 3 };

describe('juntarAutores', () => {
  const pessoas = juntarAutores([
    { data: '2026-10-20T00:00:00Z', autores: [ana, robo] },
    // Autor repetido no mesmo commit (autor e coautor) conta uma vez.
    { data: '2026-10-10T00:00:00Z', autores: [ana, ana, null] },
    { data: '2026-10-15T00:00:00Z', autores: [bia] },
  ]);
  const por = Object.fromEntries(pessoas.map((p) => [p.login, p]));

  it('conta cada pessoa uma vez por commit, coautoria incluída', () => {
    assert.equal(por.ana.commits, 2);
    assert.equal(por.robo.commits, 1);
    assert.equal(por.bia.commits, 1);
  });

  it('guarda a data do primeiro commit, venha em que ordem vier', () => {
    assert.equal(por.ana.primeiro, '2026-10-10T00:00:00Z');
  });

  it('sem nome no perfil, usa o login; autor sem conta fica de fora', () => {
    assert.equal(por.bia.nome, 'bia');
    assert.equal(pessoas.length, 3);
  });
});

describe('ordenar', () => {
  const pessoas = [
    { login: 'c', primeiro: '2026-03-01' },
    { login: 'b', primeiro: '2026-01-01' },
    { login: 'a', primeiro: '2026-03-01' },
  ];

  it('ordem de chegada, empate pelo login', () => {
    assert.deepEqual(
      ordenar(pessoas).map((p) => p.login),
      ['b', 'a', 'c'],
    );
  });

  it('esconde quem está na lista de ocultos', () => {
    assert.deepEqual(
      ordenar(pessoas, ['a']).map((p) => p.login),
      ['b', 'c'],
    );
  });
});

describe('cartao', () => {
  it('foto pelo id, nome, @login e o papel no idioma pedido', () => {
    const html = cartao(
      { login: 'ana', nome: 'Ana Souza', id: 42 },
      { pt: 'Mantenedora', en: 'Maintainer' },
      'en',
    );
    assert.match(html, /avatars\.githubusercontent\.com\/u\/42\?s=100&amp;v=4/);
    assert.match(html, /<b>Ana Souza<\/b>/);
    assert.match(html, /href="https:\/\/github\.com\/ana">@ana</);
    assert.match(html, /<sub>Maintainer<\/sub>/);
    assert.doesNotMatch(html, /Mantenedora/);
  });

  it('o papel pode trocar o nome e o link do perfil', () => {
    const html = cartao(ana, { nome: 'Outro', url: 'https://x.dev' }, 'pt');
    assert.match(html, /<a href="https:\/\/x\.dev"><img/);
    assert.match(html, /<b>Outro<\/b>/);
  });

  it('sem papel, não sobra linha vazia', () => {
    assert.doesNotMatch(cartao(ana, undefined, 'pt'), /<sub><\/sub>/);
  });

  it('escapa o que vem do perfil', () => {
    const html = cartao({ login: 'x', nome: '<script>"&', id: 1 }, undefined, 'pt');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;&quot;&amp;/);
  });
});

describe('montarTabela', () => {
  it(`quebra a linha a cada ${POR_LINHA} cartões`, () => {
    const pessoas = Array.from({ length: POR_LINHA + 1 }, (_, i) => ({
      login: `p${i}`,
      nome: `P${i}`,
      id: i,
    }));
    const html = montarTabela(pessoas, {}, 'pt');
    assert.equal(html.match(/<tr>/g).length, 2);
    assert.equal(html.match(/<td /g).length, POR_LINHA + 1);
    assert.ok(html.startsWith('<table>') && html.endsWith('</table>'));
  });
});

describe('substituirBloco', () => {
  it('troca só o que está entre as marcas', () => {
    const readme = `antes\n${INICIO}\nvelha\n${FIM}\ndepois\n`;
    assert.equal(
      substituirBloco(readme, 'nova'),
      `antes\n${INICIO}\nnova\n${FIM}\ndepois\n`,
    );
  });

  it('sem as marcas, lança', () => {
    assert.throws(() => substituirBloco('nada', 'x'), /não encontradas/);
  });

  it('os dois READMEs têm as marcas', () => {
    for (const arquivo of ['README.md', '.github/docs/README-EN.md']) {
      const texto = readFileSync(join(RAIZ, arquivo), 'utf8');
      assert.ok(texto.includes(INICIO) && texto.includes(FIM), arquivo);
    }
  });

  it('papeis.json tem os dois idiomas para cada papel', () => {
    const { papeis } = JSON.parse(readFileSync(join(AQUI, 'papeis.json'), 'utf8'));
    for (const [login, papel] of Object.entries(papeis)) {
      assert.ok(papel.pt && papel.en, login);
    }
  });
});
