---
version: 1
slug: "openem-frontend-src-pages-desempenho-tsx"
primary_target: "openem_frontend/src/pages/Desempenho.tsx"
related_targets: []
---

# Desempenho semana a semana (`/desempenho`, issue #90)

Modo: Operate. Tarefa: o aluno abre para saber como foi a semana e o que praticar agora, em sessões curtas no celular. Dados: `GET /performance/weeks` (semanas de segunda a domingo no fuso de Brasília, acerto por área, minutos de foco contra `Profile.minutesPerDay`, dias estudados, variação contra a semana anterior, 3 prioridades do último mês com peso na prova, respostas sem assunto, sequência) e o mapa de assuntos existente (`/performance/heatmap`). Progresso (`/progresso`) continua sendo a tela da gamificação; a semana mostra a sequência e leva a ele quando a gamificação está ligada. Estados: carregando, erro com "Tentar de novo", aluno sem nenhuma atividade, semana atual vazia com semanas anteriores cheias, sem prioridade, gamificação desligada.

## Direction contract

THESIS: Desempenho responde "como foi a minha semana e o que pratico agora". A semana atual abre no topo contra a meta de minutos do próprio aluno, as anteriores ficam dobradas embaixo com a variação. Recusa o painel de números soltos, curva diária e lista inteira de assuntos.

OWN-WORLD: o próprio app: `.card` com borda e raio de 16 px, `.font-data` nos números, as cores de área (mat, nat, hum, lin) nas áreas, rosa da marca só para ação, progresso e o dia de hoje, `.btn-primary` em Praticar, PageHeader do app.

STORY: o aluno vê em quais dias estudou, quantos minutos fez contra a meta, quantas questões e o acerto, o acerto de cada área, e toca em Praticar no assunto que mais pesa; desce para comparar com as semanas passadas e, se quiser, abre todos os assuntos.

FIRST VIEWPORT: celular 390: barra do app; título Seu desempenho com a meta na linha de apoio; cartão Esta semana com o intervalo de datas, a faixa dos 7 dias (estudado em rosa cheio, hoje com contorno), dois blocos (Minutos x de meta com barra; Questões n e % de acerto), a linha das 4 áreas e as prioridades com Praticar.

FORM: "Semana a semana", posição 6 na lista ordenada; seed:b84608a8257845b3. Movimento assinatura: a faixa dos 7 dias, a sequência vista como semana de calendário, e as setas de variação nas semanas passadas.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
