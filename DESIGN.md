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
  tp-alcalino: "#e4573d"
  tp-alcalino-terroso: "#e39a26"
  tp-transicao: "#5d82d6"
  tp-pos-transicao: "#7f93a8"
  tp-semimetal: "#2fa596"
  tp-nao-metal: "#4aa84f"
  tp-halogenio: "#c7b21c"
  tp-gas-nobre: "#9a6fdc"
  tp-lantanideo: "#cf72c9"
  tp-actinideo: "#c07a4c"
  tp-calor: "#8c80ff"
  tp-alcalino-dark: "#ff7d63"
  tp-alcalino-terroso-dark: "#f4b34a"
  tp-transicao-dark: "#7fa2f2"
  tp-pos-transicao-dark: "#9aaec2"
  tp-semimetal-dark: "#45c4b3"
  tp-nao-metal-dark: "#6cc871"
  tp-halogenio-dark: "#e2cd3d"
  tp-gas-nobre-dark: "#b892f5"
  tp-lantanideo-dark: "#e892e2"
  tp-actinideo-dark: "#dc9a6d"
  tp-calor-dark: "#7c3aed"
typography:
  hero:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.6rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  display:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "4rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Bricolage Grotesque', 'Inter', ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.25rem"
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
  vitrine: "1.25rem"
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
  caderno-hero:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.vitrine}"
    width: "30rem"
  caderno-capa:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    padding: "20px 24px"
  ano:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    height: "44px"
  ano-ativo:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.lg}"
    height: "44px"
  casa-tabela:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    width: "46px"
    padding: "0.2rem 0.25rem"
  casa-tabela-lista:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    width: "2.75rem"
    height: "2.75rem"
  ficha-elemento:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.2xl}"
    width: "28rem"
  marca-dado:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.full}"
    padding: "0.05rem 0.45rem"
---

# Design System: OpENEM

## Overview

**Creative North Star: "O caderno do aluno, aceso no celular"**

O OpENEM é um app de estudo, não uma vitrine. A superfície é calma e clara: fundo lilás muito pálido, cartões brancos de borda fina e cantos de 16 px, texto quase preto. Sobre essa calma, duas camadas de cor fazem todo o trabalho de sentido. O vermelho-rosado da marca diz "aja aqui, isto avançou, isto é hoje". As cinco cores de área do ENEM (Matemática, Natureza, Humanas, Linguagens, Redação) dizem "de que matéria é isto". Nada mais recebe cor, com uma exceção de escopo: a tela da tabela periódica tem a sua própria família de conteúdo (`tp-*`), que só vale dentro da tabela.

A densidade é a de um app de bolso: tipo base de 14 px, rótulos de 12 px, números em mono tabular, cartões com 16 a 20 px de respiro. Títulos em Bricolage Grotesque extra-negrito dão a voz; Inter carrega o texto; JetBrains Mono carrega tudo que é contagem, data, porcentagem e ano, como numa folha de prova. O site público (landing e documentação) importa o CSS do app sem paleta paralela: o que muda no app muda lá, por construção (decisão do usuário, 20/10/2026: manter a estética do app em toda superfície nova).

O sistema é multitema. A família `default` (descrita aqui) é a marca; outras 17 famílias, cada uma com lado claro e escuro, redefinem as mesmas variáveis em `openem_frontend/src/themes.css`, e um teste (`theme-palettes.test.ts`) cobra o contraste de todas.

**Key Characteristics:**
- Uma cor de ação (rosa da marca) e cinco cores de conteúdo (áreas); o resto é neutro. A tabela periódica soma os tons das categorias, só dentro dela.
- Cartão branco com borda de 1 px e raio de 16 px como unidade de tudo.
- Números sempre em JetBrains Mono tabular.
- Todo token existe em claro e escuro; nenhum componente usa cor literal fora dos tokens (exceções declaradas: ligas e lousa do quadro da sala).
- Movimento curto e só de transform/opacidade, desligado por `prefers-reduced-motion`.

## Colors

Neutros frios levemente lilases, uma cor quente de ação e uma paleta de cinco tons de conteúdo calibrada para contraste.

### Primary
- **Rosa OpENEM** (`brand`; `brand-dark` no escuro): botão principal, link de ação, dia de hoje e dias estudados na faixa da semana, barra de meta, item ativo do menu (traço de 2 px), foco (`outline: 2px solid`), seleção de texto (28% de mistura); na landing, o ano escolhido no caderno da hero (o botão preenchido e a capa do caderno) e o hover dos anos.
- **Rosa Claro** (`brand-2`): só como segundo ponto do gradiente da marca (wordmark "ENEM", liga Diamante). Nunca sozinho.
- **Tinta da Marca** (`brand-ink`): texto sobre preenchimento da marca. Branco no claro, quase preto no escuro.

### Secondary
As cinco áreas do ENEM, um tom por lado, cada um ≥ 4,5:1 sobre `bg`/`surface`/`surface-2` de todos os temas daquele lado (no claro, a cor-base escurecida; no escuro, clareada no mesmo matiz):
- **Azul Matemática** (`mat`), **Verde Natureza** (`nat`), **Laranja Humanas** (`hum`), **Roxo Linguagens** (`lin`), **Rosa Redação** (`red`).
Aparecem como texto do nome da área, como faixa de área nos itens de lista e como pontos/barras de gráfico. Redação conta em Linguagens no Desempenho.

### Tertiary
- **Estado:** `success` = `nat`, `warning` = `hum` (aliases, não cores próprias); `danger` é o erro, distinto de `red` (Redação).
- **Ligas:** `gold` e `plat` para Ouro e Platina; os cartões de liga usam gradientes literais em `index.css` (Bronze `#c98a4b→#e6b079`, Prata `#9aa3b2→#cdd4e0`, Ouro `#e0a83c→#f4cf5a`, Platina `#5fb0c9→#9bd7e6`, texto `#241a10`; Diamante segue a marca).

### Tons da tabela periódica
Família de conteúdo da tela `/tabela-periodica`, definida uma vez por lado em `index.css` (`:root`/`[data-theme$='-light']` e `[data-theme$='-dark']`) e herdada por todas as famílias de tema:
- **Dez categorias:** `tp-alcalino` (coral), `tp-alcalino-terroso` (âmbar), `tp-transicao` (azul), `tp-pos-transicao` (cinza-azulado, "metais representativos"), `tp-semimetal` (verde-água), `tp-nao-metal` (verde), `tp-halogenio` (mostarda), `tp-gas-nobre` (violeta), `tp-lantanideo` (orquídea), `tp-actinideo` (terracota). No escuro, o mesmo matiz clareado.
- **Mapa de calor:** um só tom violeta (`tp-calor`) em sete degraus de mistura, `--tp-calor-0` a `-6` (claro de 6% a 78%, em passos de 12; escuro de 8% a 90%, em passos de 14).
- **Mistura da casa** (`--tp-mix`: 24% no claro, 26% no escuro): a casa é `color-mix(in srgb, tom, mix%)` sobre `surface`; o tom cheio aparece só no traço de 3 px do topo e na amostra da legenda.

### Neutral
- **Lilás Papel** (`bg`): fundo da página.
- **Lilás Margem** (`sidebar`): menu lateral no desktop, um degrau abaixo do fundo.
- **Folha** (`surface`): cartões, modais, popovers.
- **Folha Tingida** (`surface-2`): campos, chips, segmentados, células vazias, hover de linha, `.slab` de conteúdo-herói.
- **Tinta** (`fg`): texto principal (≥ 7:1 cobrado em teste).
- **Grafite** (`muted`): texto de apoio, rótulos, legendas (≥ 4,5:1 cobrado em teste).
- **Pauta** (`line`): toda borda e divisória (1 px).

### Named Rules
**The Rose Means Act Rule.** O rosa da marca é reservado a ação, progresso e "hoje" (decisão do usuário, registrada nos contratos de direção do Desempenho e da landing). Um número, um título ou uma decoração nunca ficam rosa só para chamar atenção: na landing, o título da hero, os números ("R$ 0" incluído) e as folhas atrás do caderno ficam neutros, e o rosa aparece só nos botões de ação e no ano escolhido (botão e capa do caderno), isto é, ação e seleção.

**The Area Is Content Rule.** As cinco cores de área marcam matéria e só matéria. Uma área nunca vira cor de ação nem de estado; estado usa os aliases `success`/`warning`/`danger`.

**The Table Tone Rule.** Os tons `tp-*` pertencem à tabela periódica e a nada mais: não são cor de área, de ação nem de estado, e não saem da tela da tabela. Dentro da casa tingida, todo texto é `fg` (o `muted` não aguenta o tingimento) e a hierarquia vem de tamanho e peso; `tabela-periodica-tokens.test.ts` cobra ≥ 4,5:1 entre `fg` e cada fundo tingido (categorias e os sete degraus) em todos os temas.

**The Three Places Rule.** Família de tema nova mexe em três lugares (`themes.css`, `FAMILIES` em `src/theme.tsx`, `public/theme-boot.js`) e passa no teste de contraste: `fg` ≥ 7:1, `muted` ≥ 4,5:1, `brand-ink` ≥ 4,5:1, áreas ≥ 4,5:1. O `default` não se mexe.

## Typography

**Display Font:** Bricolage Grotesque (com Inter, ui-sans-serif)
**Body Font:** Inter (com ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono (com ui-monospace, SF Mono, Cascadia Code)

**Character:** Bricolage extra-negrito e apertado dá aos títulos um peso de cartaz escolar; Inter some atrás do conteúdo; JetBrains Mono tabular deixa minutos, porcentagens e anos com cara de gabarito. Inter é a face de texto sancionada do app, exceção registrada em `.impeccable/config.json` (decisão do usuário: preservar e expandir a identidade do app). O site serve as três famílias pelo fontsource (variáveis, sem Google Fonts); nos temas Cyberpunk e Terminal `--font-display` vira JetBrains Mono.

### Hierarchy
- **Hero** (800, 2,7rem → 3,75rem a partir de `sm` → 4,6rem a partir de `lg`, altura 1,02, -0,035em, `text-balance`): só o `h1` da landing, na coluna da esquerda da hero.
- **Display** (800, 2,5rem → 3,75rem a partir de `sm` → 4rem a partir de `lg`, altura 1,02, -0,035em, `text-balance`, até 14em): o título de fechamento da landing, centralizado.
- **Headline** (800, 2,15rem → 3rem a partir de `sm` → 3,25rem a partir de `lg`, altura 1,05, -0,03em, `text-balance`): títulos de seção do site, sem eyebrow em cima.
- **Page title** (800, 1,5rem → 1,875rem a partir de `sm`, `tracking-tight`): `h1` do `PageHeader` em toda tela do app.
- **Title** (700, 1,125rem): título de cartão e de seção dentro de tela (o uso mais comum da display no app); 1,25rem para o título do cartão principal ("Esta semana").
- **Body** (400, 0,875rem): texto de interface; botões em 600 a 0,9rem.
- **Body long** (400, 1rem a 1,125rem, `leading-relaxed`): parágrafos do site, limitados entre 40 e 60ch; artigo da documentação em até 72ch.
- **Caption** (400, 0,75rem): rótulos, legendas, metadados; o rótulo de área e de dia desce a 0,7rem em 600.
- **Data** (500, mono, `tnum`, -0,02em): todo número contável. O número grande do bloco vai a 1,125rem; o complemento ("de 630") desce para 0,75rem `muted`.

### Named Rules
**The Mono Numbers Rule.** Minuto, questão, porcentagem, data, ano e XP vão em `.font-data` com `tabular-nums`. Texto corrido nunca vai em mono.

**The Real Exponent Rule.** Quando o expoente é dado (configuração eletrônica, carga de íon), ele sai em `<sup>` real (`.tp-expoente`: 0,68em, subido 0,45em, sem mexer na altura da linha), nunca em caracteres sobrescritos do Unicode, que vêm de blocos diferentes e saem com tamanhos diferentes na mesma fonte. O componente `Expoentes` converte o texto do catálogo.

**The One Hero Rule.** A escala de hero aparece uma vez por página, na abertura da landing, e nada se sobrepõe a ela. Telas do app e da documentação ficam no teto de `page-title`.

**The Two Weights Rule.** Títulos em display são 700 ou 800; texto em Inter fica entre 400 e 600. Não há display leve nem Inter extra-negrito.

## Layout

App mobile-first. No celular: barra superior fixa com desfoque (`bg-bg/85`, `backdrop-blur`) e barra de abas inferior (`bg-bg/90`); a partir de `md` (768px) o menu vira barra lateral de 240px (`w-60`) em `sidebar`, com rolagem própria e regras de altura (`max-height: 920px` aperta o ritmo; `620px` esconde o cartão de XP). As telas empilham seções com 24px (`space-y-6`); dentro do cartão o ritmo é 12 a 16px (`space-y-3`/`space-y-4`), gap padrão 12px entre itens e 8px entre controles. Desempenho vira duas colunas a partir de `xl` (`1.35fr / 1fr`).

A landing centraliza em 1200px com 16px de margem (24px a partir de `sm`); o cabeçalho tem o wordmark, as âncoras das seções (a partir de `md`), o GitHub e "Abrir o app". A partir de `lg` a hero é uma grade de duas colunas, `1fr` e `30rem`, com 56px de gap: título, texto e botões à esquerda, o caderno à direita; no celular tudo empilha. Embaixo, uma faixa de números em `surface` com bordas `line` (quatro colunas no desktop, duas no celular). As seções seguem com 112px no topo (`pt-28`): como funciona (três passos e seis recursos), redações, no papel (faixa em `surface`), código aberto (faixa sempre em `default-dark`, via `data-theme` na seção) e o fechamento centralizado. Seções de duas colunas viram uma no celular. `scroll-padding-top: 5rem` compensa a barra.

A tabela periódica é a grade da IUPAC no tamanho em que se lê, dentro de um `.card-raised`: 18 colunas medidas pela largura do cartão (container de tamanho inline), casas de no mínimo 46px (60px com zoom), altura 1,14× a largura e 3px de vão; os números dos grupos (IUPAC e antigo) em cima, os períodos à esquerda e as séries f embaixo, depois de um respiro de 0,75rem. Abaixo do mínimo, o cartão rola na horizontal em vez de encolher; no celular há também a lista, uma linha por elemento. O vão entre o H e o He (colunas 3 a 12, linhas 1 a 3) vira o painel do elemento em foco e da legenda, posicionado pela mesma geometria.

## Elevation & Depth

Híbrido, quase plano. A separação vem primeiro de tom (`bg` → `surface`) e da borda de 1 px em `line`; sombra é um realce, não a estrutura. Cada tema define a sua `--shadow` e o seu `--glow`; no OLED e nas famílias escuras de preto puro (Eclipse, Abissal, Brasa) a sombra vira contorno (`0 0 0 1px var(--line)`), e no Contraste é anel sólido.

### Shadow Vocabulary
- **Sombra do app** (`--shadow`, claro: `0 1px 2px rgba(40,14,22,0.05), 0 10px 28px rgba(40,14,22,0.07)`; escuro: `0 1px 2px rgba(0,0,0,0.34), 0 14px 34px rgba(0,0,0,0.4)`): `.card-raised` (o cartão principal da tela), item ativo do segmentado, hover de `.lift`, popover de busca da documentação.
- **Brilho da marca** (`--glow`, anel de 18% + halo de 22% da marca): definido em todo tema e exposto como `.card-glow`, mas sem uso no código atual; não é vocabulário ativo.

### Named Rules
**The Line Before Shadow Rule.** Todo cartão tem borda; `--shadow` marca os cartões principais da tela (um a dois na maioria das telas), nunca a grade inteira. A borda separa; a sombra só hierarquiza.

## Shapes

Cantos arredondados em três degraus, todos via variáveis do Tailwind que os temas podem redefinir: 8px (`lg`) para células, itens de menu e skeleton; 12px (`xl`) para botões, campos e segmentados; 16px (`2xl`) para cartões e `.slab`. Chips, barras de progresso, faixas de área e avatares são pílulas (`999px`). Cyberpunk e Terminal fecham os cantos (2 a 8px); Sakura os abre (12 a 32px). Na landing, as peças de vitrine (o caderno da hero, os cartões de recurso e o terminal) abrem para 1,25rem (`vitrine`). Bordas são sempre 1 px sólidas. As tracejadas marcam o que ainda não é fato: o dia futuro da faixa da semana e, na tabela periódica, o valor estimado ou previsto (contorno tracejado de 1px em `fg` a 55%, 2px para dentro da casa) e o marcador das séries f. Valor desconhecido é hachura a 135° em `muted` a 30% sobre `surface-2`, nunca um degrau da escala.

## Components

### Buttons
- **Shape:** cantos suaves (12px), borda de 1 px transparente para não pular ao trocar de variante.
- **Primary:** fundo `brand`, texto `brand-ink`, 600 a 0,9rem, 0,6rem × 1rem; em linha de lista encolhe para 0,375rem × 0,75rem a 0,75rem.
- **Hover / Focus:** hover escurece 12% para o preto (`color-mix`); `:active` desce 1px; foco é contorno de 2px na marca com 2px de afastamento; desabilitado a 55% de opacidade.
- **Ghost:** transparente com borda `line` e texto `fg`; hover em `surface-2`.
- **Site:** botões do site somam `.aperta` (escala 0,97 ao pressionar, 140ms em `--ease-saida`). O CTA da landing ("Começar a estudar") cresce para 1rem com 0,875rem × 1,5rem; no fechamento, 1,125rem. Botões de cabeçalho têm no mínimo 44px de altura.

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

### Caderno da hero (signature, landing)
Um caderno de prova numa folha `.card .card-raised` de 1,25rem, com duas folhas neutras (`surface-2` e `surface`, borda `line`) giradas 3° e 1,4° atrás dele. A capa é a faixa da marca com "Caderno de prova" em mono a 0,75rem e "ENEM <ano>" em Bricolage 800, e uma pílula com o formato ("Prova única" ou "Dois dias"); a capa é rosa porque é o ano escolhido. Embaixo: o total de questões, cada dia com as suas áreas e a redação, as áreas em `.chip` com o ponto na cor da área ("Interdisciplinar" até 2008) e, depois de um traço tracejado, "Tema da redação" em mono na cor `red` e o tema regular do ano em Bricolage 700, tirado do catálogo do app (2008 diz que o caderno não tem frase-tema). As regras de formato espelham o importador (`src/landing/prova.ts`). Abaixo do caderno, os 28 anos em grade de 7 colunas, botões de 44px em mono; até 2008 o fundo é `surface-2`, o ano escolhido é preenchido na marca com `--shadow`. Trocar de ano remonta a folha com a `.troca` (opacidade 0, escala 0,985 e desfoque de 6px em 260ms `--ease-saida`; sem escala e desfoque com movimento reduzido).

### Casa da tabela periódica (signature, Tabela periódica)
A folha tingida: `surface` misturada ao tom da categoria (`--tp-mix`) ou ao degrau do mapa de calor, raio 8px, sem borda, com um traço de 3px no topo no tom cheio, que é a chave da categoria (a 24% os tons ficam próximos; o traço é que separa). No mapa de calor e em valor desconhecido o traço some, porque lá ele não é dado. Dentro: número atômico em mono a 0,625rem, símbolo em Bricolage 700 a 36% da largura da casa, nome em Inter 500 (8 a 9px, omitido se não couber a 8px) e massa em mono a 0,5625rem, tudo em `fg`. Desconhecido: hachura. Estimado ou previsto: contorno tracejado interno. Aberta ou com foco: anel interno de 2px na marca (seleção, The Rose Means Act Rule); hover com ponteiro fino: anel interno de 1px em `fg` a 45%; ao pressionar, escala 0,96 em 120ms `--ease-saida`; fora do filtro, opacidade 0,2. A mesma folha tingida se repete no elemento em foco do vão (raio 12px, borda `line`, símbolo em Bricolage 800), no ladrilho da ficha (5,5 × 6,25rem) e na casa pequena da lista (2,75rem, com borda `line`). A grade é `role="grid"` e anda pelas setas.

### Ficha do elemento (Tabela periódica)
Painel lateral de 28rem colado à direita a partir de `lg` (raio 16px só do lado de dentro, borda `line` à esquerda) e folha que sobe de baixo no celular, até 88dvh (raio 16px em cima). Fundo `surface`, `--shadow`, véu preto a 40% atrás. Entra em 280ms `cubic-bezier(0.32,0.72,0,1)` e sai em 180ms `ease-in`; com movimento reduzido, sem deslocamento. Seções separadas por `border-t` em `line`, título em Bricolage 700 a 1rem. Cada dado é uma linha rótulo/valor/fonte: rótulo em 0,75rem 500 `muted` numa coluna de `minmax(7,5rem, 38%)`, valor em 0,875rem e, embaixo, a fonte em 0,6875rem `muted` sublinhada, que vira `fg` no hover; linhas divididas por 1px em `line`. Qualificadores do valor ("estimada", "calculado", "previsto") vão numa marca em pílula (`surface-2`, borda `line`, 0,6875rem 600), nunca em cor.

### Lousa e terminal (landing)
Na seção "No papel", um esboço do caderno em PDF (linhas em `line`, duas colunas) ao lado da lousa do quadro da sala, com as cores fixas da lousa. Na seção de código aberto, um `.card` com a barra "terminal" em mono `muted` sobre `surface-2` (sem botões de janela) e os comandos de instalação, cada linha com `$` em `muted`.

### Wordmark
"Op" em `fg` + "ENEM" no gradiente da marca (`.text-gradient`, 90° de `brand` a `brand-2`), Bricolage 800 a 1,25rem, `tracking-tight`. Ao lado do ícone `public/icon.svg`.

## Do's and Don'ts

### Do:
- **Do** usar os tokens (`bg-surface`, `text-muted`, `border-line`, `bg-brand`…) em toda cor de interface, para que as 18 famílias de tema e o tema personalizado funcionem sem exceção.
- **Do** guardar o rosa da marca para ação, progresso e "hoje" (The Rose Means Act Rule).
- **Do** marcar matéria com a cor de área: nome da área em `AREA_TEXT`, faixa de 4px em `AREA_DOT` nos itens de lista.
- **Do** pôr todo número em `.font-data` com `tabular-nums`.
- **Do** construir telas com `.card` (borda 1px, raio 16px) e reservar `.card-raised` ao cartão principal de cada bloco.
- **Do** limitar o movimento a transform, opacidade e um desfoque curto de entrada, com `--ease-saida` (`cubic-bezier(0.23,1,0.32,1)`) para entradas e respostas e `--ease-movimento` (`cubic-bezier(0.77,0,0.175,1)`) para deslocamentos, e deixar `prefers-reduced-motion` zerar escala e desfoque.
- **Do** importar `openem_frontend/src/index.css` em qualquer superfície nova (o site já faz), sem paleta paralela.
- **Do** tingir as casas da tabela periódica só com os tokens `tp-*` sobre `surface`, manter todo texto da casa em `fg` e passar no `tabela-periodica-tokens.test.ts` (The Table Tone Rule).
- **Do** marcar valor desconhecido com hachura e valor estimado ou previsto com contorno tracejado, e citar a fonte em cada linha da ficha.
- **Do** escrever expoente de dado em `<sup>` real (The Real Exponent Rule).
- **Do** desligar decoração de tema (brilho neon, scanlines) com `html[data-fx='off']` e `prefers-contrast: more`.

### Don't:
- **Don't** usar cor de área como cor de ação ou de estado, nem `red` (Redação) como erro: erro é `danger`.
- **Don't** escrever hex literal em componente do app; as exceções declaradas são as ligas e a lousa do quadro da sala (cores fixas, fora dos temas).
- **Don't** pôr halo da marca em sombra de estrutura: os cartões têm sombra neutra, tingida do fundo.
- **Don't** mexer no tema `default` nem aceitar uma família que falhe o teste de contraste.
- **Don't** aninhar um `.card` dentro de outro em superfície nova; divida com `divide-y`/`border-t` em `line`, como no Desempenho.
- **Don't** escrever texto corrido em mono nem números em fonte proporcional.
- **Don't** usar um tom `tp-*` fora da tabela periódica, nem como cor de área, de ação ou de estado.
- **Don't** pôr `muted` dentro de fundo tingido, nem representar valor desconhecido como um degrau da escala.
- **Don't** usar os caracteres sobrescritos do Unicode (², ⁺…) em expoente que é dado.
- **Don't** desenhar moldura de aparelho nem botões de janela falsos em volta de captura do app: ela aparece numa janela de borda fina com o nome da tela.

## Decisões em aberto

- **Eyebrow do PageHeader** (rótulo em caixa alta, 0,75rem, 600, 0,1em de espaçamento, `muted`, acima do `h1`): presente em quase todas as telas do app e nos rótulos de grupo da barra lateral e da documentação. A revisão final o apontou contra o piso de qualidade (kicker); o padrão está **mantido até decisão do usuário** e **não é regra do sistema**: superfícies novas não devem acrescentar eyebrows. Os rótulos de grupo de navegação (seções da barra lateral e da documentação) são cabeçalhos de lista, não kickers.
