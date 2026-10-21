---
version: 1
slug: "openem-site-src-landing-landing-tsx"
primary_target: "openem_site/src/landing/Landing.tsx"
related_targets: ["openem_site/index.html"]
---

# Landing do OpENEM (`openem_site/`, rota `/`)

Modo: Persuade. Público: só alunos (Mariana do PRD: escola pública, 16 a 18 anos, Android, 1 a 2 h por dia, chega pelo link do WhatsApp). Ação principal: começar a estudar no app (cadastro gratuito); a ação em forma real na página é responder uma questão oficial do ENEM. Prova disponível: provas oficiais de 1998 a 2025, 48 temas de redação, recursos reais do app e capturas de tela reais. Proibido inventar depoimentos, números de usuários, aprovação ou parcerias. Estética do app mantida (pedido do usuário).

Momento memorável: o aluno responde a questão 137 do ENEM 2024 dentro do celular da página e vê o que o OpENEM faz com aquela resposta.

Em aberto: contagem exata de questões do banco (conferir antes de publicar número); domínio público final.

## Direction contract

THESIS: A landing é a primeira hora de estudo do aluno, não uma vitrine. O celular com o app de verdade fica no centro, a primeira tela já tem uma questão oficial respondível, e uma régua de 0 a 60 minutos avança com a rolagem. Recusa o padrão título-mais-mockup com três cartões de recursos embaixo.

OWN-WORLD: o próprio app: fundo #f5f1f6 (escuro #15111c), superfícies brancas com borda #ece5ee e raio 16 px, sombra suave do app, rosa #d91748 (#fb5277 no escuro) só para ação, progresso e o marcador da régua, Bricolage Grotesque 800 nos títulos, Inter no texto, JetBrains Mono tabular nos minutos e anos, ícones Phosphor, as cinco cores de área marcando matérias, wordmark Op + ENEM em gradiente.

STORY: A visitante entende em segundos que é o ENEM de verdade e de graça, responde a questão na página, vê o que acontece com o acerto ou o erro (revisão, recomendação), percorre a hora (revisão, questões recomendadas, flashcards, redação, desempenho), vê o simulado de fim de semana e o arquivo 1998 a 2025, e toca em Começar a estudar.

FIRST VIEWPORT: celular 390x844 primeiro: barra de 56 px com wordmark e Entrar; régua 0 a 60 min com marcador rosa no 0; título de duas linhas "Uma hora por dia com a prova de verdade."; uma frase de apoio; Começar a estudar com "Grátis, sem anúncio" ao lado; o celular com a questão respondível começa logo abaixo, cortado pela borda. Desktop: régua vertical de minutos na margem esquerda, título e ação no alto da coluna de texto, celular grande fixo à direita, já com a questão.

FORM: "Uma hora no celular", posição 3 na lista ordenada; seed:ac6014ae8904ed29. Interação assinatura: rolagem amarrada à régua de minutos; o celular fixo troca de tela a cada etapa da hora; a questão do topo é respondível de verdade, com retorno.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
