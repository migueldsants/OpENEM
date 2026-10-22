# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- App (`openem_frontend/`): React 19 + Vite + Tailwind v4, PWA mobile-first, ícones Phosphor. Já existente.
- Site público (`openem_site/`, landing em `/` e documentação em `/docs/`): **React + Vite**, escolha do usuário em 20/10/2026. Projeto separado do app, no mesmo repositório.

## Users

Estudante que vai fazer o ENEM, majoritariamente de escola pública (82% na pesquisa do PRD), 15 a 24 anos (90%), que estuda pelo **celular Android** (65%), em geral 1 a 2 horas por dia (50%), e que quer ir para o ensino superior por SISU/ProUni. Descobre ferramentas pelo boca a boca e pelo WhatsApp (65%). Persona primária: **Mariana**, vestibulanda do ProUni, 16 a 18 anos, que precisa de algo gratuito, leve e que diga o que estudar a seguir.

A landing page fala **só com alunos** (decisão do usuário, 20/10/2026); código aberto e self-host aparecem nela como informação secundária. A documentação atende alunos primeiro e também quem hospeda ou contribui (issue #89).

## Product Purpose

Dar de graça ao estudante de baixa renda o que hoje é pago: questões oficiais do ENEM, simulados no padrão da prova com nota TRI, estatísticas de desempenho, revisão inteligente e recomendação do que estudar a seguir, cabendo em 1 a 2 horas por dia no celular. Sucesso é o aluno saber objetivamente onde está errando e o que fazer na próxima sessão.

## Positioning

- Gratuito e de código aberto (AGPL-3.0), sem anúncio e sem plano pago.
- Banco com as **provas oficiais do INEP de 1998 a 2025**, incluindo reaplicações, PPL e as demais aplicações; os textos de prova são reproduzidos, nunca reescritos.
- Personalização pelo desempenho do próprio aluno (recomendação a partir dos erros recentes, revisão espaçada SM-2), não conteúdo igual para todos.
- Feito para celular barato e internet limitada (PWA; questões já abertas funcionam offline e as respostas sobem depois; avaliar flashcards e entregar simulado precisam de conexão).

## Operating Context

- Estudo em sessões curtas no celular, muitas vezes no transporte, no intervalo da escola ou em casa à noite.
- Simulado também no papel: o app gera o caderno em PDF no padrão do ENEM e uma lousa de tempo ("quadro da sala") para quem imprime.
- Turmas inteiras podem usar ao mesmo tempo atrás do mesmo IP de escola.
- O link chega pelo WhatsApp; a primeira visita costuma ser no celular.

## Capabilities and Constraints

Recursos que existem hoje no app:

- Questões oficiais com filtros, comentário (gerado por IA sob demanda, com cota), anotações e favoritos.
- Simulados: por prova, por tema (área, matéria e assunto somados), com timer, nota TRI quando as questões são calibradas, caderno em PDF no padrão ENEM e quadro da sala.
- Revisão espaçada (SM-2) e flashcards com catálogo público por área.
- Redações: todos os temas oficiais de 1998 a 2025 (48 temas), com proposta, textos motivadores e fac-símile da página.
- Caderno de fórmulas (catálogo + fórmulas do aluno) com PDF.
- Desempenho (gráficos por matéria, heatmap por assunto), Progresso (XP, nível, ligas Bronze → Diamante, sequência, conquistas, desafio diário), metas semanais.
- Cronograma semanal, Pomodoro com minutos por matéria, cronômetros avulsos.
- Comunidade (fórum), perfil público, ranking.
- Temas de cor (clássicos, criativos, OLED, acessibilidade) e tema personalizado.
- Gamificação pode ser desligada no perfil (não infantilizar o público adulto).

Restrições:

- Português do Brasil como idioma principal; documentação com espelho em inglês.
- Desempenho em 3G: First Contentful Paint < 2,5 s.
- A CSP do nginx só aceita script da própria origem.
- Ainda não decidido: contagem exata de questões do banco para uso público (conferir no banco antes de publicar um número).

## Brand Commitments

- Nome: **OpENEM**.
- Identidade do app preservada e expandida (decisão do usuário, 20/10/2026): vermelho-rosado do tema padrão (`--brand` `#d91748` claro / `#fb5277` escuro), ícone do app (`openem_frontend/public/icon.svg`), as cinco cores de área do ENEM (Matemática azul, Natureza verde, Humanas laranja, Linguagens roxo, Redação rosa) como sistema de cor do conteúdo.
- **Manter a estética do app** em toda superfície nova, landing e documentação incluídas (pedido do usuário, 20/10/2026): mesmos tokens de `openem_frontend/src/index.css` e `themes.css` (família `default`), Bricolage Grotesque nos títulos, Inter no texto, JetBrains Mono nos números, cartões com borda e raio de 16 px, ícones Phosphor e o wordmark "Op" + "ENEM" em gradiente da marca.
- Tom direto e acolhedor, em português simples, sem promessa de aprovação.

## Evidence on Hand

- Pesquisa primária com o público (34 respondentes, nov–dez/2025), resumida em `docs/PRD.md`; as respostas individuais não são públicas.
- Catálogo de redações: `openem_frontend/src/data/redacoes.json` (48 temas, 1998–2025) e figuras em `openem_frontend/public/redacoes/`.
- Catálogos de flashcards (`openem_backend/prisma/seed-flashcards-data.json`) e fórmulas (`openem_backend/prisma/seed-formulas-lib.ts`).
- O app em si, que pode ser capturado para imagens reais de tela.
- **Não existem**: depoimentos de alunos, número de usuários, taxa de aprovação, parcerias com escolas, cobertura de imprensa. Nada disso pode ser inventado.

## Product Principles

1. Grátis de verdade: nenhum recurso essencial atrás de pagamento ou cadastro desnecessário.
2. Fiel à prova: o que é do ENEM é reproduzido como o INEP publicou.
3. O próximo passo, não mais conteúdo: cada tela ajuda o aluno a decidir o que estudar agora.
4. Leve primeiro: celular simples e internet ruim são o caso normal, não a exceção.
5. Respeito ao tempo do aluno: sessões curtas, nada que enrole.

## Accessibility & Inclusion

- Contraste testado em todos os temas (`theme-palettes.test.ts`): texto ≥ 7:1, secundário ≥ 4,5:1.
- Temas de acessibilidade e efeitos desligáveis (`data-fx='off'`, `prefers-contrast: more`).
- `prefers-reduced-motion` respeitado; navegação por teclado e leitores de tela nas telas novas.
