---
version: 1
slug: "openem-site-src-landing-landing-tsx"
primary_target: "openem_site/src/landing/Landing.tsx"
related_targets: ["openem_site/index.html"]
---

# Landing do OpENEM (`openem_site/`, rota `/`)

Modo: Persuade. Público: só alunos (Mariana do PRD: escola pública, 16 a 18 anos, chega pelo link do WhatsApp). Ação principal: começar a estudar no app (cadastro gratuito); a ação em forma real na página é responder uma questão oficial do ENEM. Prova disponível: provas oficiais de 1998 a 2025, 48 temas de redação, recursos reais do app e capturas de tela reais. Proibido inventar depoimentos, números de usuários, aprovação ou parcerias. Estética do app mantida (pedido do usuário).

Redesenho de 21/10/2026 (pedido do usuário): refazer a landing inteira pensando primeiro no desktop, com uma hero impressionante; a mensagem principal é "é o ENEM de verdade" e a questão respondível fica dentro da hero. Temas de cor ficam em segundo plano: nada de nomes de família, só "temas customizáveis".

Momento memorável: o título da prova em letras de cartaz, cortado pela questão 137 do ENEM 2024, que o aluno responde ali mesmo; a faixa de anos de 1998 a 2025 embaixo troca a questão.

Em aberto: contagem exata de questões do banco (conferir antes de publicar número); domínio público final.

## Direction contract

THESIS: A hero é um letreiro: a frase "A prova de verdade. De graça." em Bricolage 800 do tamanho da tela, cortada por uma questão oficial respondível, sobre um chão com todos os anos do ENEM. Recusa o título com mockup de celular ao lado e a fileira de três cartões de recurso.

OWN-WORLD: o próprio app, tema default: fundo #f5f1f6 (escuro #15111c), cartões brancos de borda #ece5ee e raio 16 a 20 px, sombra suave do app, rosa #d91748 só para ação, ano selecionado e progresso, Bricolage Grotesque 800 em escala de cartaz, Inter no texto, JetBrains Mono tabular em anos e números, cores de área marcando matéria, janelas do app desktop (capturas reais) com moldura de navegador mínima.

STORY: Entende em um olhar que é o ENEM oficial e de graça, responde a questão na hero, troca de ano na faixa, vê numa janela do app o que acontece depois (revisão, questões recomendadas, flashcards, desempenho), vê o simulado de fim de semana e o arquivo de redações 1998 a 2025, lê que é aberto e sem anúncio e toca em Começar a estudar.

FIRST VIEWPORT: Desktop 1440x900: barra de 72 px (wordmark, Documentação, GitHub, Entrar). Título em duas linhas a ~10vw ocupando a largura. Cartão da questão de 520 px sobreposto ao canto direito da segunda linha, respondível. Abaixo do título, à esquerda, frase de apoio e Começar a estudar com "Sem anúncio, sem plano pago". Chão de 92 px com os 28 anos 1998 a 2025 em mono; 2018, 2023 e 2024 são botões que trocam a questão. Abaixo de 1100 px o cartão desce para o fluxo; no celular a faixa de anos rola de lado.

FORM: "Letreiro", posição 6 na lista ordenada; seed:088e81d686edaea5. Interação assinatura: escolher um ano no chão troca a questão do cartão com a troca por camada (opacidade, escala 0,985, desfoque); responder mostra gabarito, resolução e o que o app faria. Segunda interação: janela do app com abas que trocam capturas reais.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
