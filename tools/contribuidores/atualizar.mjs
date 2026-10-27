// Atualiza a tabela de contribuidores do README (português e inglês) a partir
// do histórico da branch principal no GitHub: o autor de cada commit e os
// coautores das linhas `Co-authored-by`, quando o e-mail está ligado a uma
// conta. O workflow `contribuidores.yml` roda isto e abre um PR se mudou.
//
//   GITHUB_TOKEN=$(gh auth token) node tools/contribuidores/atualizar.mjs
//
// Papéis e quem esconder ficam em `papeis.json`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  juntarAutores,
  montarTabela,
  ordenar,
  substituirBloco,
} from './tabela.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const READMES = [
  { arquivo: 'README.md', idioma: 'pt' },
  { arquivo: '.github/docs/README-EN.md', idioma: 'en' },
];

const CONSULTA = `
query ($dono: String!, $nome: String!, $depois: String) {
  repository(owner: $dono, name: $nome) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $depois) {
            pageInfo { hasNextPage endCursor }
            nodes {
              committedDate
              authors(first: 20) {
                nodes { user { login name databaseId } }
              }
            }
          }
        }
      }
    }
  }
}`;

async function graphql(token, variaveis) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'openem-contribuidores',
    },
    body: JSON.stringify({ query: CONSULTA, variables: variaveis }),
  });
  const corpo = await res.json();
  if (!res.ok || corpo.errors) {
    throw new Error(
      `GitHub respondeu ${res.status}: ${JSON.stringify(corpo.errors ?? corpo)}`,
    );
  }
  return corpo.data;
}

/** Todos os commits da branch principal, com os autores ligados a contas. */
async function commitsDoRepositorio(token, repositorio) {
  const [dono, nome] = repositorio.split('/');
  const commits = [];
  let depois = null;
  do {
    const dados = await graphql(token, { dono, nome, depois });
    const historico = dados.repository.defaultBranchRef.target.history;
    for (const no of historico.nodes) {
      commits.push({
        data: no.committedDate,
        autores: no.authors.nodes.map(({ user }) =>
          user ? { login: user.login, nome: user.name, id: user.databaseId } : null,
        ),
      });
    }
    depois = historico.pageInfo.hasNextPage ? historico.pageInfo.endCursor : null;
  } while (depois);
  return commits;
}

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('defina GITHUB_TOKEN (ex.: GITHUB_TOKEN=$(gh auth token))');
  process.exit(1);
}
const repositorio = process.env.GITHUB_REPOSITORY ?? 'migueldsants/OpENEM';
const { papeis, ocultar } = JSON.parse(
  readFileSync(join(AQUI, 'papeis.json'), 'utf8'),
);

const commits = await commitsDoRepositorio(token, repositorio);
const pessoas = ordenar(juntarAutores(commits), ocultar);
console.log(
  `${commits.length} commits, ${pessoas.length} contribuidores: ${pessoas.map((p) => p.login).join(', ')}`,
);

for (const { arquivo, idioma } of READMES) {
  const caminho = join(RAIZ, arquivo);
  const atual = readFileSync(caminho, 'utf8');
  // O checkout no Windows pode vir com CRLF; o arquivo sai como entrou.
  const crlf = atual.includes('\r\n');
  const texto = crlf ? atual.replace(/\r\n/g, '\n') : atual;
  let novo = substituirBloco(texto, montarTabela(pessoas, papeis, idioma));
  if (crlf) novo = novo.replace(/\n/g, '\r\n');
  if (novo === atual) {
    console.log(`${arquivo}: sem mudança`);
  } else {
    writeFileSync(caminho, novo);
    console.log(`${arquivo}: tabela atualizada`);
  }
}
