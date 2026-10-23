---
version: 1
slug: "openem-frontend-src-pages-tabelaperiodica-tsx"
primary_target: "openem_frontend/src/pages/TabelaPeriodica.tsx"
related_targets: []
---

# Tabela periódica (/tabela-periodica)

Mode: Operate (material de consulta que o aluno opera: buscar, filtrar, abrir ficha, calcular).

Audience and job: aluno do ENEM no celular Android ou no computador da escola, no meio de uma questão de Química, que precisa achar um dado (massa molar, família, configuração, tendência) em segundos e confiar nele. Também estuda: distribuição eletrônica passo a passo e tendências periódicas.

Constraints: issue #93. Catálogo estático gerado por `tools/tabela-periodica` (fontes citadas por campo, 0 divergências não explicadas). Layout IUPAC de 18 colunas, séries f embaixo com marcador no grupo 3. Funciona offline, em 360 px (grade rolável + lista), só no teclado (`role="grid"`), em todos os temas (tokens `--tp-*`, texto da casa sempre em `--fg`). Rosa da marca só para ação e seleção.

## Direction contract

THESIS: a tabela é o instrumento; a tela inteira é a grade da IUPAC no tamanho em que ela se lê, e o vão entre o hidrogênio e o hélio, acima dos metais de transição, vira o painel vivo (elemento em foco, legenda, tendência). Recusa o padrão "cartões de recurso em volta de uma tabela pequena".

OWN-WORLD: o mundo do app (folha `surface` com borda `line`, Bricolage nos símbolos, JetBrains Mono no número atômico e na massa, Inter nos nomes). Casas tingidas pelo tom da categoria a 24–26% sobre a folha, com um traço de 3 px no topo no tom cheio; mapa de calor em sete degraus de um só tom violeta; desconhecido em hachura de `line`. Seleção em contorno rosa de 2 px.

STORY: o aluno vê a tabela que conhece dos livros, acha o elemento pela busca sem acento ou pelas setas, lê a ficha com a fonte de cada dado, troca a cor para entender tendências e usa as ferramentas (Pauling, massa molar, comparar) sem sair da tela.

FIRST VIEWPORT: título "Tabela periódica" e uma linha de subtítulo; barra com busca, "Colorir por" e filtros; a grade num `.card-raised` ocupando a largura, com os números dos grupos (IUPAC e antigo) em cima e dos períodos à esquerda; no vão das linhas 1–3, colunas 3–12, o elemento em foco grande à esquerda e a legenda à direita. Ação primária: clicar/Enter numa casa abre a ficha (painel lateral no desktop, folha no celular).

FORM: estrutura especificada pela issue (grade IUPAC + painel no vão + ficha lateral + ferramentas em abas abaixo). A rodada de conceitos não foi feita: a issue #93 fixa a estrutura. seed: none (rodada pulada, não indisponível)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
