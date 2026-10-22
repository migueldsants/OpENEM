# Plano de Implementação — UI da Fase 1 + restante da Fase 3

> Documento de trabalho. O backend das Fases 1–2 está completo; o gargalo é **UI**.
> Por isso o plano ataca primeiro a UI da Fase 1 (destrava o MVP) e só depois avança
> na Fase 3. Cada frente é um PR independente, com branch a partir de `main`.

## Status real por fase

| Fase | Backend (API) | Frontend (UI) |
|---|---|---|
| 0 — Fundação | ✅ | ✅ |
| 1 — MVP | ✅ completo | ⚠️ parcial |
| 2 — Pós-MVP | ✅ completo | ✅ |
| 3 — Avançado | 🚧 só gamificação | 🚧 só Progresso |

---

## Frente 1 — UI de Simulados (P0, maior pendência do MVP)
**Branch:** `feature/fase1-simulados` · **Esforço:** L

Pré-requisitos de backend:
- [ ] `GET /simulations/templates` em `simulations.controller.ts` (listar templates).
- [ ] Garantir que `seed.ts` popula `SimulationTemplate` (área + completo).
- [ ] Confirmar payload de `finish` (`FinishSimulationDto`) compatível com a UI.

Frontend:
- [ ] `api.ts`: `simulationTemplates()`, `startSimulation(templateId)`, `getSimulation(id)`, `finishSimulation(id, answers)` + tipos.
- [ ] `pages/Simulados.tsx` — lista de templates, iniciar.
- [ ] `pages/Simulado.tsx` — cronômetro, navegação, retomar (localStorage), finalizar.
- [ ] `pages/SimuladoResultado.tsx` — nota bruta (+ TRI), gabarito comentado, tempo/questão.
- [ ] Rota + navegação em `App.tsx`; integrar XP de gamificação no resultado.

## Frente 2 — Dashboard de Desempenho (P0)
**Branch:** `feature/fase1-desempenho` · **Esforço:** M

- [ ] `pages/Desempenho.tsx`: % de acerto por área/assunto, evolução temporal, pontos fracos.
- [ ] Gráficos leves (SVG/CSS) para respeitar o orçamento de bundle (NFR-003).
- [ ] Estender `performance.service.ts` para série temporal, se necessário.

## Frente 3 — Revisão Inteligente + Favoritos (P0/Could)
**Branch:** `feature/fase1-revisao` · **Esforço:** M

- [ ] `pages/Revisao.tsx`: fila (vencidos primeiro), responder → reagendar SM-2.
- [ ] `pages/Favoritos.tsx`: substituir o redirect por tela real.

> **Marco:** ao fim das Frentes 1–3, o fluxo e2e cadastro → questão → simulado → estatísticas fica completo na UI.

## Frente 4 — Desafio Diário (Fase 3, P1)
**Branch:** `feature/fase3-desafio-diario` · **Esforço:** M

- [ ] Lógica pura em `common/gamification.ts` (desafio determinístico do dia).
- [ ] `GET /gamification/daily-challenge` + conclusão via `POST /answers` com bônus de XP.
- [ ] Card na Home e na tela Progresso.

## Frente 5 — Motor de Recomendação (Fase 3, FR-015)
**Branch:** `feature/fase3-recomendacao` · **Esforço:** M

- [ ] Módulo `recommendation` + `common/recommendation.ts` (erros recentes → questões semelhantes).
- [ ] `GET /recommendation/next`.
- [ ] Seção "Recomendado para você" na Home.

## Frente 6 — IA: Correção de Redação (Fase 3)
**Branch:** `feature/fase3-ia-redacao` · **Esforço:** L

> **Removida (out/2026):** a correção de redação por IA saiu da API (rotas `ai-available` e `ai-evaluation`, `common/essay-ai/`, `ESSAY_AI_PROVIDER` e `AI_ESSAY_DAILY_LIMIT`). O corretor vive no repositório separado `AI-Skill-Corretor-Redacao-ENEM`, listado na tela Ferramentas. A camada `common/ai/` continua para o comentário de questão e a classificação de assunto.

- [ ] Provedor: Claude (Anthropic), `claude-opus-4-8`; chave via `.env`.
- [ ] Endpoint que gera `EssayEvaluation` (5 competências + feedback).
- [ ] Fallback para rubrica manual quando IA desabilitada.

## Frente 7 — Comunidade/Fórum (Fase 3, FR-016)
**Branch:** `feature/fase3-comunidade` · **Esforço:** L

- [ ] Modelos `ForumThread`/`ForumPost` + migration.
- [ ] Módulo `community` (CRUD básico, moderação mínima).
- [ ] UI de listagem/thread.

## Frente 8 — Infra / NFR (transversal)
- [ ] Vitest + Testing Library (frontend).
- [ ] Playwright (e2e UI).
- [ ] Acessibilidade no CI (axe/Lighthouse).
- [ ] Offline PWA (NFR-008).
- [ ] Analytics privacy-friendly.
- [ ] Apps nativos e migração PostgreSQL (conforme tração).

---

## Ordem de execução
1. Frente 1 (Simulados) — destrava o MVP.
2. Frentes 2 e 3 — completam o "quarteto essencial" na UI.
3. Frente 4 — fecha a gamificação.
4. Frentes 5, 6, 7.
5. Frente 8 em paralelo, contínuo.
