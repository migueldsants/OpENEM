---
name: OpENEM
description: Plataforma gratuita e aberta de estudo para o ENEM, feita para o celular do aluno.
colors:
  brand: "#d91748"
  brand-2: "#ff5a7d"
  brand-ink: "#ffffff"
  bg: "#f5f1f6"
  sidebar: "#efeaf1"
  surface: "#ffffff"
  surface-2: "#faf6fa"
  fg: "#211b26"
  muted: "#6b6473"
  line: "#ece5ee"
  brand-dark: "#fb5277"
  brand-2-dark: "#ff86a6"
  brand-ink-dark: "#15111c"
  bg-dark: "#15111c"
  sidebar-dark: "#1a1524"
  surface-dark: "#1e1926"
  surface-2-dark: "#2a2335"
  fg-dark: "#ece7f1"
  muted-dark: "#a59cb0"
  line-dark: "#322a3d"
  mat: "#2e63bf"
  nat: "#087752"
  hum: "#905b1f"
  lin: "#7651ba"
  red: "#b43f59"
  danger: "#b8383c"
  gold: "#84611f"
  plat: "#287085"
  mat-dark: "#669dfb"
  nat-dark: "#13b981"
  hum-dark: "#f59e3c"
  lin-dark: "#ac8bf5"
  red-dark: "#f7708a"
  danger-dark: "#f07774"
  gold-dark: "#e0a83c"
  plat-dark: "#3fa7c4"
  aparelho: "#16111c"
  aparelho-dark: "#2e2638"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  page-title:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.556
  body:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  body-long:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  caption:
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.333
  data:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', monospace"
    fontSize: "1.125rem"
    fontWeight: 500
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  2xl: "1rem"
  full: "999px"
  celular: "2.75rem"
  celular-tela: "2.2rem"
spacing:
  1: "4px"
  1.5: "6px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.xl}"
    padding: "0.6rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    padding: "0.6rem 1rem"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    padding: "0.6rem 0.8rem"
  chip:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.7rem"
  seg:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.xl}"
    padding: "0.25rem"
  seg-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "0.4rem 0.9rem"
  dia-estudado:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.lg}"
    height: "36px"
  dia-vazio:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    height: "36px"
  faixa-de-area:
    width: "4px"
    height: "40px"
    rounded: "{rounded.full}"
  celular:
    backgroundColor: "{colors.aparelho}"
    rounded: "{rounded.celular}"
    padding: "0.6rem"
    width: "22.5rem"
---

# Design System: OpENEM

## Overview

**Creative North Star: "O caderno do aluno, aceso no celular"**

O OpENEM é um app de estudo, não uma vitrine. A superfície é calma e clara: fundo lilás muito pálido, cartões brancos de borda fina e cantos de 16 px, texto quase preto. Sobre essa calma, duas camadas de cor fazem todo o trabalho de sentido. O vermelho-rosado da marca diz "aja aqui, isto avançou, isto é hoje". As cinco cores de área do ENEM (Matemática, Natureza, Humanas, Linguagens, Redação) dizem "de que matéria é isto". Nada mais recebe cor.

A densidade é a de um app de bolso: tipo base de 14 px, rótulos de 12 px, números em mono tabular, cartões com 16 a 20 px de respiro. Títulos em Bricolage Grotesque extra-negrito dão a voz; Inter carrega o texto; JetBrains Mono carrega tudo que é contagem, data, porcentagem e ano, como numa folha de prova. O site público (landing e documentação) importa o CSS do app sem paleta paralela: o que muda no app muda lá, por construção (decisão do usuário, 20/10/2026: manter a estética do app em toda superfície nova).

O sistema é multitema. A família `default` (descrita aqui) é a marca; outras 17 famílias, cada uma com lado claro e escuro, redefinem as mesmas variáveis em `openem_frontend/src/themes.css`, e um teste (`theme-palettes.test.ts`) cobra o contraste de todas.

**Key Characteristics:**
- Uma cor de ação (rosa da marca) e cinco cores de conteúdo (áreas); o resto é neutro.
- Cartão branco com borda de 1 px e raio de 16 px como unidade de tudo.
- Números sempre em JetBrains Mono tabular.
- Todo token existe em claro e escuro; nenhum componente usa cor literal fora dos tokens (exceções declaradas: ligas, lousa do quadro da sala, corpo do aparelho no site).
- Movimento curto e só de transform/opacidade, desligado por `prefers-reduced-motion`.

## Colors

Neutros frios levemente lilases, uma cor quente de ação e uma paleta de cinco tons de conteúdo calibrada para contraste.

### Primary
- **Rosa OpENEM** (`brand`; `brand-dark` no escuro): botão principal, link de ação, dia de hoje e dias estudados na faixa da semana, barra de meta, item ativo do menu (traço de 2 px), foco (`outline: 2px solid`), seleção de texto (28% de mistura), marcador da régua de minutos na landing.
- **Rosa Claro** (`brand-2`): só como segundo ponto do gradiente da marca (wordmark "ENEM", liga Diamante). Nunca sozinho.
- **Tinta da Marca** (`brand-ink`): texto sobre preenchimento da marca. Branco no claro, quase preto no escuro.

### Secondary
As cinco áreas do ENEM, um tom por lado, cada um ≥ 4,5:1 sobre `bg`/`surface`/`surface-2` de todos os temas daquele lado (no claro, a cor-base escurecida; no escuro, clareada no mesmo matiz):
- **Azul Matemática** (`mat`), **Verde Natureza** (`nat`), **Laranja Humanas** (`hum`), **Roxo Linguagens** (`lin`), **Rosa Redação** (`red`).
Aparecem como texto do nome da área, como faixa de área nos itens de lista e como pontos/barras de gráfico. Redação conta em Linguagens no Desempenho.

### Tertiary
- **Estado:** `success` = `nat`, `warning` = `hum` (aliases, não cores próprias); `danger` é o erro, distinto de `red` (Redação).
- **Ligas:** `gold` e `plat` para Ouro e Platina; os cartões de liga usam gradientes literais em `index.css` (Bronze `#c98a4b→#e6b079`, Prata `#9aa3b2→#cdd4e0`, Ouro `#e0a83c→#f4cf5a`, Platina `#5fb0c9→#9bd7e6`, texto `#241a10`; Diamante segue a marca).

### Neutral
- **Lilás Papel** (`bg`): fundo da página.
- **Lilás Margem** (`sidebar`): menu lateral no desktop, um degrau abaixo do fundo.
- **Folha** (`surface`): cartões, modais, popovers.
- **Folha Tingida** (`surface-2`): campos, chips, segmentados, células vazias, hover de linha, `.slab` de conteúdo-herói.
- **Tinta** (`fg`): texto principal (≥ 7:1 cobrado em teste).
- **Grafite** (`muted`): texto de apoio, rótulos, legendas (≥ 4,5:1 cobrado em teste).
- **Pauta** (`line`): toda borda e divisória (1 px).
- **Aparelho** (`aparelho` / `aparelho-dark`): só o corpo da moldura de celular do site.

### Named Rules
**The Rose Means Act Rule.** O rosa da marca é reservado a ação, progresso e "hoje" (decisão do usuário, registrada nos contratos de direção do Desempenho e da landing). Um número, um título ou uma decoração nunca ficam rosa só para chamar atenção; o dado da landing em rosa (`font-data text-brand`) é sempre o minuto da régua ou o ano do arquivo, isto é, progresso.

**The Area Is Content Rule.** As cinco cores de área marcam matéria e só matéria. Uma área nunca vira cor de ação nem de estado; estado usa os aliases `success`/`warning`/`danger`.

**The Three Places Rule.** Família de tema nova mexe em três lugares (`themes.css`, `FAMILIES` em `src/theme.tsx`, `public/theme-boot.js`) e passa no teste de contraste: `fg` ≥ 7:1, `muted` ≥ 4,5:1, `brand-ink` ≥ 4,5:1, áreas ≥ 4,5:1. O `default` não se mexe.

## Typography

**Display Font:** Bricolage Grotesque (com Inter, ui-sans-serif)
**Body Font:** Inter (com ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (com ui-monospace, SF Mono, Cascadia Code)

**Character:** Bricolage extra-negrito e apertado dá aos títulos um peso de cartaz escolar; Inter some atrás do conteúdo; JetBrains Mono tabular deixa minutos, porcentagens e anos com cara de gabarito. Inter é a face de texto sancionada do app, exceção registrada em `.impeccable/config.json` (decisão do usuário: preservar e expandir a identidade do app). O site serve as três famílias pelo fontsource (variáveis, sem Google Fonts); nos temas Cyberpunk e Terminal `--font-display` vira JetBrains Mono.

### Hierarchy
- **Display** (800, 2,6rem no celular até 3,75rem no desktop largo, altura 1, -0,035em): só o título de abertura e o de fechamento da landing, com `max-width` em `ch` e `text-balance`.
- **Headline** (800, 2rem → 3rem a partir de `sm`, 1,05, -0,03em): títulos de seção do site.
- **Page title** (800, 1,5rem → 1,875rem a partir de `sm`, `tracking-tight`): `h1` do `PageHeader` em toda tela do app.
- **Title** (700, 1,125rem): título de cartão e de seção dentro de tela (o uso mais comum da display no app); 1,25rem para o título do cartão principal ("Esta semana").
- **Body** (400, 0,875rem): texto de interface; botões em 600 a 0,9rem.
- **Body long** (400, 1rem a 1,125rem, `leading-relaxed`): parágrafos do site, limitados entre 40 e 60ch; artigo da documentação em até 72ch.
- **Caption** (400, 0,75rem): rótulos, legendas, metadados; o rótulo de área e de dia desce a 0,7rem em 600.
- **Data** (500, mono, `tnum`, -0,02em): todo número contável. O número grande do bloco vai a 1,125rem; o complemento ("de 630") desce para 0,75rem `muted`.

### Named Rules
**The Mono Numbers Rule.** Minuto, questão, porcentagem, data, ano e XP vão em `.font-data` com `tabular-nums`. Texto corrido nunca vai em mono.

**The Two Weights Rule.** Títulos em display são 700 ou 800; texto em Inter fica entre 400 e 600. Não há display leve nem Inter extra-negrito.

## Layout

App mobile-first. No celular: barra superior fixa com desfoque (`bg-bg/85`, `backdrop-blur`) e barra de abas inferior (`bg-bg/90`); a partir de `md` (768px) o menu vira barra lateral de 240px (`w-60`) em `sidebar`, com rolagem própria e regras de altura (`max-height: 920px` aperta o ritmo; `620px` esconde o cartão de XP). As telas empilham seções com 24px (`space-y-6`); dentro do cartão o ritmo é 12 a 16px (`space-y-3`/`space-y-4`), gap padrão 12px entre itens e 8px entre controles. Desempenho vira duas colunas a partir de `xl` (`1.35fr / 1fr`).

O site centraliza em 1240px com 16px de margem (24px a partir de `sm`). A landing no desktop é uma grade de três colunas (régua de minutos de 3,5rem, texto, celular fixo); no celular a régua vira faixa horizontal fixa no topo. Seções do site respiram 64 a 128px na vertical (`py-16 sm:py-24`, `pt-24 sm:pt-32`). `scroll-padding-top: 5rem` compensa a barra.

## Elevation & Depth

Híbrido, quase plano. A separação vem primeiro de tom (`bg` → `surface`) e da borda de 1 px em `line`; sombra é um realce, não a estrutura. Cada tema define a sua `--shadow` e o seu `--glow`; no OLED e nas famílias escuras de preto puro (Eclipse, Abissal, Brasa) a sombra vira contorno (`0 0 0 1px var(--line)`), e no Contraste é anel sólido.

### Shadow Vocabulary
- **Sombra do app** (`--shadow`, claro: `0 1px 2px rgba(40,14,22,0.05), 0 10px 28px rgba(40,14,22,0.07)`; escuro: `0 1px 2px rgba(0,0,0,0.34), 0 14px 34px rgba(0,0,0,0.4)`): `.card-raised` (o cartão principal da tela), item ativo do segmentado, hover de `.lift`, popover de busca da documentação.
- **Brilho da marca** (`--glow`, anel de 18% + halo de 22% da marca): definido em todo tema e exposto como `.card-glow`, mas sem uso no código atual; não é vocabulário ativo.
- **Aparelho** (`0 1px 2px` + `0 24px 48px -16px` tingidos de `fg`; no escuro, aro interno de 1 px): só a moldura `.celular` do site. Sem halo da marca.

### Named Rules
**The Line Before Shadow Rule.** Todo cartão tem borda; `--shadow` marca os cartões principais da tela (um a dois na maioria das telas), nunca a grade inteira. A borda separa; a sombra só hierarquiza.

## Shapes

Cantos arredondados em três degraus, todos via variáveis do Tailwind que os temas podem redefinir: 8px (`lg`) para células, itens de menu e skeleton; 12px (`xl`) para botões, campos e segmentados; 16px (`2xl`) para cartões e `.slab`. Chips, barras de progresso, faixas de área e avatares são pílulas (`999px`). Cyberpunk e Terminal fecham os cantos (2 a 8px); Sakura os abre (12 a 32px). A moldura de celular do site é a única forma grande: 2,75rem por fora e 2,2rem na tela (1,75rem / 1,3rem no aparelho pequeno), proporção 390 × 844. Bordas são sempre 1 px sólidas; a única tracejada é o dia futuro da faixa da semana.

## Components

### Buttons
- **Shape:** cantos suaves (12px), borda de 1 px transparente para não pular ao trocar de variante.
- **Primary:** fundo `brand`, texto `brand-ink`, 600 a 0,9rem, 0,6rem × 1rem; em linha de lista encolhe para 0,375rem × 0,75rem a 0,75rem.
- **Hover / Focus:** hover escurece 12% para o preto (`color-mix`); `:active` desce 1px; foco é contorno de 2px na marca com 2px de afastamento; desabilitado a 55% de opacidade.
- **Ghost:** transparente com borda `line` e texto `fg`; hover em `surface-2`.
- **Site:** botões do site somam `.aperta` (escala 0,97 ao pressionar, 140ms em `--ease-saida`).

### Chips
- **Style:** pílula em `surface-2` com borda `line`, 0,75rem em 500.
- **State:** como filtro, `data-active='true'` tinge 14% da marca no fundo, 40% na borda e põe o texto na marca em 600.

### Segmented control
Trilho em `surface-2` com borda e 4px de respiro; o item ativo vira uma folha (`surface`, `fg`, `--shadow`), os inativos ficam `muted` em 600 a 0,85rem.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** `surface`; `.slab` usa `surface-2` para conteúdo-herói (enunciado, LaTeX).
- **Shadow Strategy:** plano com borda; `.card-raised` para o cartão principal da tela (ver Elevation).
- **Border:** 1 px `line`; divisões internas são `border-t`/`divide-y` em `line`.
- **Internal Padding:** 16px, 20px a partir de `sm`; lista dentro de cartão usa 12 × 16px por linha.

### Inputs / Fields
- **Style:** `surface-2`, borda `line`, 12px de raio, 0,6rem × 0,8rem, 0,9rem; placeholder em `muted` a 75%.
- **Focus:** borda na marca + anel de 3px a 22% da marca.

### Navigation
Barra lateral: itens de 0,875rem em 500, `muted`, raio 8px; hover e ativo em `surface-2` com texto `fg`, e o ativo ganha um traço vertical de 2 × 20px na marca à esquerda e o ícone na marca. Celular: barra de abas inferior de ícones Phosphor com rótulo, ativo na marca, "Mais" abre uma folha que sobe de baixo (0,28s). Barra de filtros fixa no topo (`.filterbar`) com fundo a 82% e desfoque de 10px.

### Faixa de área (list marker)
Marcador estabelecido dos itens de lista (Questões, Revisão, Simulados, Favoritos, Flashcards, prioridades do Desempenho): um traço vertical de 4px de largura (`w-1`), 28 a 40px de altura, em pílula, na cor da área (`AREA_DOT`), à esquerda do texto, dentro do item; sem área, `muted` a 40%. É um elemento solto no fluxo, não uma borda lateral do cartão.

### Faixa da semana (signature, Desempenho)
Sete células em grade, 6 a 8px de gap, 36px de altura (24px na versão compacta das semanas passadas), raio 8px, número do dia em mono. Estudado: preenchido na marca. Hoje: contorno de 2px na marca por dentro (hoje e estudado: preenchido com anel externo afastado 2px). Sem estudo: `surface-2` e `muted`. Futuro: borda tracejada em `line`. A barra de meta embaixo tem 6px, em pílula, e enche uma vez ao aparecer (`.barra-enche`, 700ms, `cubic-bezier(0.23,1,0.32,1)`, via `@starting-style`).

### Moldura de celular (signature, site)
O app real (componente ou captura com sidecar de procedência) dentro de um aparelho escuro de até 22,5rem; as telas trocam pela `.camada` (opacidade + escala 0,985 + desfoque de 6px em 260ms `--ease-saida`; sem escala e desfoque com movimento reduzido). Capturas existem nos dois lados do tema e o CSS mostra a do tema atual.

### Wordmark
"Op" em `fg` + "ENEM" no gradiente da marca (`.text-gradient`, 90° de `brand` a `brand-2`), Bricolage 800 a 1,25rem, `tracking-tight`. Ao lado do ícone `public/icon.svg`.

## Do's and Don'ts

### Do:
- **Do** usar os tokens (`bg-surface`, `text-muted`, `border-line`, `bg-brand`…) em toda cor de interface, para que as 18 famílias de tema e o tema personalizado funcionem sem exceção.
- **Do** guardar o rosa da marca para ação, progresso e "hoje" (The Rose Means Act Rule).
- **Do** marcar matéria com a cor de área: nome da área em `AREA_TEXT`, faixa de 4px em `AREA_DOT` nos itens de lista.
- **Do** pôr todo número em `.font-data` com `tabular-nums`.
- **Do** construir telas com `.card` (borda 1px, raio 16px) e reservar `.card-raised` ao cartão principal de cada bloco.
- **Do** limitar o movimento a transform e opacidade, com curvas `--ease-saida` (`cubic-bezier(0.23,1,0.32,1)`) para entradas e respostas e `--ease-movimento` (`cubic-bezier(0.77,0,0.175,1)`) para deslocamentos, e deixar `prefers-reduced-motion` zerar tudo.
- **Do** importar `openem_frontend/src/index.css` em qualquer superfície nova (o site já faz), sem paleta paralela.
- **Do** desligar decoração de tema (brilho neon, scanlines) com `html[data-fx='off']` e `prefers-contrast: more`.

### Don't:
- **Don't** usar cor de área como cor de ação ou de estado, nem `red` (Redação) como erro: erro é `danger`.
- **Don't** escrever hex literal em componente do app; as exceções declaradas são as ligas, a lousa do quadro da sala (cores fixas, fora dos temas) e o corpo do aparelho no site.
- **Don't** pôr halo da marca em sombra de estrutura: a moldura de celular e os cartões têm sombra neutra, tingida do fundo.
- **Don't** mexer no tema `default` nem aceitar uma família que falhe o teste de contraste.
- **Don't** aninhar um `.card` dentro de outro em superfície nova; divida com `divide-y`/`border-t` em `line`, como no Desempenho.
- **Don't** escrever texto corrido em mono nem números em fonte proporcional.

## Decisões em aberto

- **Eyebrow do PageHeader** (rótulo em caixa alta, 0,75rem, 600, 0,1em de espaçamento, `muted`, acima do `h1`): presente em quase todas as telas do app e nos rótulos de grupo da barra lateral e da documentação. A revisão final o apontou contra o piso de qualidade (kicker); o padrão está **mantido até decisão do usuário** e **não é regra do sistema**: superfícies novas não devem acrescentar eyebrows. Os rótulos de grupo de navegação (seções da barra lateral e da documentação) são cabeçalhos de lista, não kickers.
