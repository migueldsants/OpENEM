// Regras puras da tabela de contribuidores do README: quem entra, em que
// ordem e como cada cartão é escrito. A rede fica em `atualizar.mjs`.

/** Marcas que cercam a tabela no README (português e inglês). */
export const INICIO = '<!-- contribuidores:inicio -->';
export const FIM = '<!-- contribuidores:fim -->';

/** Cartões por linha da tabela. */
export const POR_LINHA = 4;

/**
 * Junta os autores de cada commit (o autor do git e os `Co-authored-by` que o
 * GitHub ligou a uma conta). Cada pessoa conta uma vez por commit, e fica a
 * data do primeiro commit dela, que define a ordem da tabela. Commit com
 * e-mail sem conta no GitHub não entra: não há perfil nem foto para mostrar.
 *
 * @param {Array<{ data: string, autores: Array<{ login: string, nome?: string | null, id: number } | null> }>} commits
 */
export function juntarAutores(commits) {
  /** @type {Map<string, { login: string, nome: string, id: number, primeiro: string, commits: number }>} */
  const pessoas = new Map();
  for (const commit of commits) {
    const vistos = new Set();
    for (const autor of commit.autores) {
      if (!autor?.login || vistos.has(autor.login)) continue;
      vistos.add(autor.login);
      const atual = pessoas.get(autor.login);
      if (!atual) {
        pessoas.set(autor.login, {
          login: autor.login,
          nome: autor.nome?.trim() || autor.login,
          id: autor.id,
          primeiro: commit.data,
          commits: 1,
        });
        continue;
      }
      atual.commits++;
      if (commit.data < atual.primeiro) atual.primeiro = commit.data;
    }
  }
  return [...pessoas.values()];
}

/**
 * Ordem de chegada: quem contribuiu primeiro vem antes. Assim a tabela só
 * muda quando alguém novo aparece (e entra no fim), não a cada commit.
 */
export function ordenar(pessoas, ocultar = []) {
  return pessoas
    .filter((p) => !ocultar.includes(p.login))
    .sort(
      (a, b) =>
        a.primeiro.localeCompare(b.primeiro) || a.login.localeCompare(b.login),
    );
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Um cartão: foto, nome, @login e o papel, quando há. A foto sai do id da
 * conta (não muda quando a pessoa troca de foto, então a tabela também não).
 *
 * @param {{ login: string, nome: string, id: number }} pessoa
 * @param {{ url?: string, nome?: string, pt?: string, en?: string } | undefined} papel
 * @param {'pt' | 'en'} idioma
 */
export function cartao(pessoa, papel, idioma) {
  const nome = escapar(papel?.nome ?? pessoa.nome);
  const perfil = escapar(papel?.url ?? `https://github.com/${pessoa.login}`);
  const foto = `https://avatars.githubusercontent.com/u/${pessoa.id}?s=100&amp;v=4`;
  const descricao = papel?.[idioma];
  return [
    `<td align="center" valign="top" width="${100 / POR_LINHA}%">`,
    `<a href="${perfil}"><img src="${foto}" width="100" alt="${nome}" /><br /><sub><b>${nome}</b></sub></a>`,
    `<br /><sub><a href="https://github.com/${escapar(pessoa.login)}">@${escapar(pessoa.login)}</a></sub>`,
    descricao ? `<br /><sub>${escapar(descricao)}</sub>` : '',
    '</td>',
  ].join('');
}

/** A tabela inteira, em linhas de `POR_LINHA` cartões. */
export function montarTabela(pessoas, papeis, idioma) {
  const linhas = [];
  for (let i = 0; i < pessoas.length; i += POR_LINHA) {
    const cartoes = pessoas
      .slice(i, i + POR_LINHA)
      .map((p) => `      ${cartao(p, papeis[p.login], idioma)}`);
    linhas.push(['    <tr>', ...cartoes, '    </tr>'].join('\n'));
  }
  return ['<table>', '  <tbody>', ...linhas, '  </tbody>', '</table>'].join(
    '\n',
  );
}

/**
 * Troca o que está entre as marcas pela tabela nova. Sem as marcas, lança:
 * melhor quebrar o workflow do que escrever a tabela no lugar errado.
 */
export function substituirBloco(readme, tabela) {
  const ini = readme.indexOf(INICIO);
  const fim = readme.indexOf(FIM);
  if (ini < 0 || fim < ini) {
    throw new Error(`marcas ${INICIO} e ${FIM} não encontradas`);
  }
  return `${readme.slice(0, ini + INICIO.length)}\n${tabela}\n${readme.slice(fim)}`;
}
