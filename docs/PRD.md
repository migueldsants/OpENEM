# PRD — OpENEM: Plataforma de Preparação para o ENEM

| Campo | Valor |
|---|---|
| **Produto** | OpENEM — Plataforma gratuita e open-source de preparação para o ENEM |
| **Status** | Rascunho (Draft) — planejamento inicial da aplicação completa |
| **Autor** | Equipe OpENEM |
| **Stakeholders** | Product/Eng/Design (placeholder), Comunidade de contribuidores |
| **Data de criação** | 2026-06-16 |
| **Última atualização** | 2026-06-16 |
| **Versão** | 1.1 |
| **Licença** | AGPL-3.0 |

> **Sobre este documento.** Este PRD planeja a aplicação **completa** — frontend, backend, banco de dados, infraestrutura de CI/CD em Docker e estratégia de testes automatizados — respeitando as escolhas tecnológicas já estabelecidas no repositório (NestJS, TypeScript, Tailwind, Swagger) e as decisões solicitadas (Prisma + SQLite nas migrations por enquanto, Docker Compose, testes integrados ao CI/CD). Itens que ainda não podem ser definidos aparecem marcados como **`[PLACEHOLDER]`**. As decisões de produto derivam de uma pesquisa primária com o público-alvo (34 respondentes válidos, nov–dez/2025); as respostas não são versionadas, para preservar a privacidade dos participantes.

---

## Sumário

1. [Resumo Executivo](#1-resumo-executivo)
2. [Problema](#2-problema)
3. [Objetivos e Metas](#3-objetivos-e-metas)
4. [Personas](#4-personas)
5. [Escopo (MVP e Fases)](#5-escopo-mvp-e-fases)
6. [Requisitos Funcionais e User Stories](#6-requisitos-funcionais-e-user-stories)
7. [Requisitos Não-Funcionais](#7-requisitos-não-funcionais)
8. [Arquitetura Técnica](#8-arquitetura-técnica)
9. [Modelo de Dados (Prisma + SQLite)](#9-modelo-de-dados-prisma--sqlite)
10. [API](#10-api)
11. [Frontend](#11-frontend)
12. [Infraestrutura, Docker e CI/CD](#12-infraestrutura-docker-e-cicd)
13. [Estratégia de Testes Automatizados](#13-estratégia-de-testes-automatizados)
14. [Métricas de Sucesso](#14-métricas-de-sucesso)
15. [Roadmap e Marcos](#15-roadmap-e-marcos)
16. [Riscos e Mitigações](#16-riscos-e-mitigações)
17. [Dependências e Premissas](#17-dependências-e-premissas)
18. [Questões em Aberto](#18-questões-em-aberto)
19. [Anexo: Estrutura de Pastas Proposta](#19-anexo-estrutura-de-pastas-proposta)

---

## 1. Resumo Executivo

**Em uma frase:** O OpENEM é uma plataforma gratuita, open-source e *mobile-first* que entrega preparação **personalizada por desempenho** para o ENEM — com banco de questões pesquisável, simulados fiéis ao padrão da prova, estatísticas acionáveis e revisão inteligente.

**Visão geral.** A pesquisa com o público-alvo revela um mercado mal atendido: estudantes majoritariamente de escola pública (82%), jovens (90% entre 15–24 anos), com **pouco tempo de estudo** (50% estudam 1–2h/dia) e que usam intensamente o **celular Android** (65%). Eles querem menos videoaula que "enrola" e mais **feedback real sobre o que fazer a seguir**. As quatro funcionalidades mais desejadas — simulados no padrão ENEM, estatísticas de desempenho, revisão inteligente e questões por nível — formam o coração do MVP.

O produto será construído como um **monorepo** com backend em **NestJS/TypeScript** (API REST documentada via Swagger), persistência via **Prisma ORM** com **SQLite** na fase atual (migração planejada para PostgreSQL na produção), e um **frontend web responsivo (PWA) em React + Vite + Tailwind CSS** projetado *mobile-first*. Toda a stack é orquestrada com **Docker Compose** e validada por um pipeline de **CI/CD no GitHub Actions** que roda lint, testes automatizados (unitários, integração e e2e), build e publicação de imagens Docker.

**Impacto esperado.** Reduzir a fricção de preparação para o público de baixa renda, oferecendo gratuitamente recursos que hoje são pagos (TRI, correção de redação detalhada, recomendação personalizada), e crescer via boca a boca / WhatsApp — o canal de descoberta dominante (65%).

**Fatos rápidos:**
- **Usuários-alvo:** estudantes de ENEM, 15–24 anos, escola pública, mobile-first, pouco tempo.
- **Problema central:** preparação genérica, paga e ineficiente para quem tem pouco tempo.
- **Métrica-Norte (North Star):** nº de **simulados/sessões de estudo concluídos por usuário ativo por semana**.
- **Lançamento-alvo MVP:** `[PLACEHOLDER — definir trimestre]`.

---

## 2. Problema

### O problema

Estudantes de ENEM — especialmente os de escola pública, com pouco tempo e renda limitada — não têm uma ferramenta gratuita que lhes diga **objetivamente onde estão errando e o que estudar a seguir**. As plataformas existentes ou são pagas, ou tratam todos os usuários igual, ou afogam o estudante em conteúdo longo e genérico que não cabe em 1–2 horas por dia.

### Estado atual (como o público resolve hoje)

- **Videoaulas no YouTube/Descomplica** (73,5% usam vídeo), frequentemente longas e que "enrolam".
- **PDFs e grupos de WhatsApp** com material avulso, sem organização por assunto nem feedback.
- **Plataformas pagas** com TRI e correção de redação — fora do alcance financeiro de grande parte do público (82% de escola pública).
- Sem um diagnóstico claro, o estudante "estuda no escuro", sem saber se evolui.

### Impacto

**Impacto no usuário:**
- 50% têm ≤2h/dia e desperdiçam tempo decidindo *o que* estudar.
- Dificuldade concentrada em Matemática (67,6%) e Ciências da Natureza (64,7%) sem suporte direcionado.
- Redação (38,2% de dificuldade) sem correção acionável — só nota, sem o "como melhorar".
- Falta de feedback gera ansiedade e abandono (especialmente em veteranos com 3+ tentativas).

**Impacto no projeto/missão:**
- Lacuna social: o público que mais precisa (SISU/ProUni, 85% do total) é o pior atendido.
- Oportunidade de diferenciação: nenhuma plataforma **gratuita** popular oferece TRI + recomendação por erro + correção de redação profunda.

### Por que agora?

A pesquisa primária (nov–dez/2025) validou a demanda e o backend já está em estágio de scaffold — é o momento de definir a arquitetura completa antes de escrever os módulos de domínio, evitando retrabalho.

---

## 3. Objetivos e Metas

### Objetivos de produto/negócio

1. **Lançar um MVP gratuito e mobile-first** que entregue o "quarteto essencial" (simulados, estatísticas, revisão inteligente, questões por nível) com qualidade fiel ao padrão ENEM.
2. **Crescer via boca a boca** atingindo `[PLACEHOLDER — meta de usuários ativos]` nos primeiros `[PLACEHOLDER]` meses, alavancando WhatsApp e indicação direta.
3. **Diferenciar pela personalização**: motor de recomendação baseado nos erros recentes como vantagem competitiva.
4. **Sustentar o projeto open-source** com arquitetura limpa, testada e documentada que facilite contribuições da comunidade (AGPL-3.0).

### Objetivos do usuário

1. Descobrir rapidamente **onde está errando** e o que priorizar no tempo escasso.
2. Treinar com **simulados realistas** e medir evolução ao longo do tempo.
3. Estudar pelo **celular**, com performance boa mesmo em internet limitada.
4. Receber **feedback acionável** (não só nota), inclusive na redação.

### Não-objetivos (o que NÃO vamos fazer)

- **Não** seremos uma plataforma de videoaulas longas (mercado saturado; vídeo, se houver, será curto e complementar — fase futura).
- **Não** será desktop-only nem terá onboarding complexo de configuração manual.
- **Não** haverá paywall: o produto é **100% gratuito**, sustentado por **doações/patrocínio/grants** (nenhuma funcionalidade fica atrás de pagamento).
- **Não** trataremos todos os usuários igual — a personalização é o diferencial.

---

## 4. Personas

Resumo dos arquétipos que guiam o produto:

| Persona | Idade | Objetivo | Tempo/dia | Foco principal | Maior dor |
|---|---|---|---|---|---|
| **Lucas** — Caçador de SISU | 17 | SISU | 2–4h | Banco de questões por assunto | Não saber onde focar |
| **Isabela** — Veterana Estratégica | 19–21 | SISU (alta concorrência) | 4–6h | TRI + análise de desempenho | Plataformas sem TRI |
| **Mariana** — Vestibulanda do ProUni | 16–18 | ProUni | 1–2h | Gratuidade + mobile | Plataformas pesadas ou pagas |
| **Rafael** — Universitário em transferência | 20–24 | SISU/ProUni | 1–2h | Eficiência com pouco tempo | Plataformas que exigem muito tempo |
| **Camila** — Treineira Curiosa | 15–16 | Treineiro | 2–4h | Personalização por nível | Explicações básicas demais |
| **Diego** — Gamer Motivacional | 15–18 | SISU/ProUni | 2–4h | Gamificação + comunidade | Falta de motivação |
| **Fernanda** — Adulta em Requalificação | 25–30 | ProUni | 1–2h | Revisão rápida + redação | Interface infantilizada |
| **Pedro** — Escola Privada Meta Alta | 17–19 | SISU alta concorrência | 4–6h | Qualidade + TRI + redação | Questões fora do padrão |

**Persona primária do MVP:** **Mariana** (gratuidade + mobile + pouco tempo) representa o maior segmento e a maior restrição técnica; otimizar para ela beneficia quase todos. **Lucas** e **Rafael** validam o motor de recomendação. **Isabela/Pedro** puxam qualidade (TRI, redação) para fases seguintes.

**Citação representativa:**
> *"Que fosse possível uma análise das suas dificuldades em certas matérias e o site/app indicasse videoaulas, conteúdos, exercícios naquilo."*

---

## 5. Escopo (MVP e Fases)

### Fase 1 — MVP (o "quarteto essencial" + base)

Baseado no ranking de funcionalidades (insights §5): itens com >60% de demanda.

- **Contas e perfil**: cadastro/login, perfil com objetivo (SISU/ProUni/treineiro) e tempo disponível.
- **Banco de questões**: busca e filtro por **área → assunto granular** e **nível de dificuldade**; questões comentadas.
- **Simulados no padrão ENEM**: por área ou completos; cronômetro; correção e gabarito comentado.
- **Dashboard de desempenho**: estatísticas por área e por assunto; evolução ao longo do tempo.
- **Revisão inteligente**: fila de revisão priorizando os assuntos com mais erros (repetição espaçada simples).
- **PWA mobile-first**: instalável, leve, com modo offline básico de leitura `[PLACEHOLDER — escopo offline a confirmar]`.

### Fase 2 — Pós-MVP

- **Cronograma automático** adaptado ao tempo disponível (47% de demanda).
- **Modo sem distrações** (38%).
- **Salvar questões favoritas** (20%).
- **TRI** no cálculo de nota dos simulados (diferencial para veteranos).
- **Correção de redação** com feedback por competência (inicialmente manual/rubrica; IA em fase posterior).

### Fase 3 — Diferenciais avançados

- **Motor de recomendação** mais sofisticado (sugestão de questões semelhantes às erradas).
- **Gamificação**: streak, pontos, desafio diário (calibrada para não infantilizar — toggle).
- **Comunidade/fórum** (20%).
- **IA**: correção de redação automatizada e geração de microconteúdo. **Provedor de IA:** arquitetura multi-provedor (Anthropic Claude, OpenAI, OpenAI-compatível e Google Gemini), selecionado por `ESSAY_AI_PROVIDER` ou auto-detectado a partir das chaves configuradas. Sem provedor configurado, recai na rubrica manual.
- **Decisão:** o MVP é entregue como **PWA responsivo (React+Vite)**;

### Fora de escopo (explícito)

- Videoaulas longas próprias (mercado saturado; foco em texto/questões).
- Pagamentos/assinatura/planos pagos (produto **100% gratuito**, sustentado por doações — sem cobrança em nenhuma fase).
- Conteúdo de outros vestibulares além do ENEM (foco).

---

## 6. Requisitos Funcionais e User Stories

### Épico A — Contas e Perfil

#### A1. Cadastro e autenticação (P0)
```
Como estudante,
quero criar uma conta e fazer login,
para que meu progresso e desempenho sejam salvos entre sessões e dispositivos.
```
**Critérios de aceite:**
- [ ] Dado um e-mail/senha válidos, quando me cadastro, então recebo um token de autenticação e meu perfil é criado.
- [ ] Senhas são armazenadas com hash forte (bcrypt/argon2); nunca em texto puro.
- [ ] Login inválido retorna erro genérico (sem revelar se o e-mail existe).
- [ ] Caso de borda: e-mail já cadastrado retorna 409.

**Prioridade:** P0 · **Esforço:** M · **Depende de:** modelo `User`, módulo Auth (JWT).

#### A2. Perfil de estudo (P0)
```
Como estudante,
quero informar meu objetivo (SISU/ProUni/treineiro) e tempo disponível por dia,
para que a plataforma adapte recomendações e cronograma ao meu contexto.
```
**Critérios:** edição de perfil; valores persistidos; usados pela recomendação/cronograma.

### Épico B — Banco de Questões

#### B1. Busca granular por assunto e nível (P0)
```
Como Lucas (caçador de SISU),
quero buscar questões por assunto específico e nível de dificuldade,
para focar exatamente no que preciso, mesmo em tópicos muito específicos.
```
**Critérios:**
- [ ] Filtros combináveis: área, assunto, nível, ano da prova, "mais cobrados".
- [ ] Cada questão exibe enunciado, alternativas, gabarito e **comentário**.
- [ ] Paginação e performance adequada no mobile (resposta da API < 300ms p95 com índice).

#### B2. Responder questão avulsa e registrar tentativa (P0)
```
Como estudante,
quero responder questões e ver na hora se acertei, com explicação,
para aprender com o erro imediatamente.
```
**Critérios:** registra `Answer` com acerto/erro e tempo; alimenta estatísticas e revisão.

### Épico C — Simulados

#### C1. Realizar simulado no padrão ENEM (P0)
```
Como Pedro (meta alta),
quero simulados fiéis ao estilo, tempo e distribuição do ENEM,
para treinar nas condições reais da prova.
```
**Critérios:**
- [ ] Templates por área ou prova completa; cronômetro; navegação entre questões.
- [ ] Ao finalizar: nota (acertos brutos no MVP; **TRI em Fase 2**), gabarito comentado, tempo por questão.
- [ ] Caso de borda: retomar simulado interrompido (sessão persistida).

#### C2. Simulado personalizado por tema (P1) — entregue

```
Como Isabela (treineira),
quero montar um simulado com os temas que escolher e baixá-lo em PDF,
para treinar exatamente o que estou estudando — na tela ou no papel.
```
**Critérios:**
- [x] Área, matéria e assunto se **somam** (união). Cruzá-los devolvia vazio, porque a maior parte do banco oficial ainda não tem assunto classificado.
- [x] Prévia ao vivo com o número de questões do recorte antes de iniciar.
- [x] Recortes pessoais: só inéditas, só as que errei, só favoritas, faixa de anos, nível.
- [x] O recorte pode ser **salvo** como simulado do aluno e refeito depois (apagar preserva o histórico: arquiva quando já houve tentativa).
- [x] Idioma da língua estrangeira vem do perfil — sem isso a mesma questão entrava em inglês e em espanhol.

#### C3. Caderno em PDF (P1) — entregue

```
Como professor (ou aluno sem internet no momento do estudo),
quero imprimir o simulado como um caderno de prova,
para resolver no papel, no mesmo formato do ENEM.
```
**Critérios:**
- [x] Duas colunas com fluxo real de texto entre colunas e páginas, como o caderno oficial.
- [x] Capa com a marca do OpENEM, o que é o projeto, instruções, campo de nome e os números da prova.
- [x] **Cartão-resposta** para marcar à caneta e **gabarito** no fim; comentários opcionais.
- [x] **Tema de cor** à escolha (os mesmos do app) ou cor livre em hexadecimal.
- [x] Imagens das questões embutidas a partir de `ENEM_MEDIA_DIR`; formato que o PDF não embute vira aviso, nunca página quebrada.

### Épico D — Desempenho e Revisão

#### D1. Dashboard de desempenho (P0)
```
Como Isabela,
quero ver graficamente meu desempenho por área e por assunto ao longo do tempo,
para otimizar meu tempo de estudo onde mais perco pontos.
```
**Critérios:** % de acerto por área/assunto; tendência temporal; identificação dos pontos fracos.

#### D2. Revisão inteligente (P0)
```
Como Rafael,
quero uma fila de revisão que priorize o que mais erro,
para evoluir mesmo com pouco tempo.
```
**Critérios:** repetição espaçada simples (ex.: SM-2 simplificado) priorizando assuntos com maior taxa de erro; itens "vencidos" aparecem primeiro.

### Épico E — Cronograma (P1) · Épico F — Redação (P1/P2) · Épico G — Gamificação (P2)

Detalhados nas Fases 2–3. User stories-chave (resumo):
- **E1** Cronograma automático que cabe em 1–2h/dia (Mariana/Fernanda).
- **F1** Correção de redação com feedback **por competência** (Pedro/Isabela) — rubrica manual → IA.
- **G1** Streak e desafio diário com **toggle** para não afastar público adulto (Diego vs. Fernanda).

### Tabela de Requisitos Funcionais

| ID | Descrição | Prioridade | Fase |
|---|---|---|---|
| FR-001 | Cadastro/login com JWT e hash de senha | Must | 1 |
| FR-002 | Perfil com objetivo e tempo disponível | Must | 1 |
| FR-003 | Banco de questões com filtro por área/assunto/nível/ano | Must | 1 |
| FR-004 | Questões comentadas (gabarito + explicação) | Must | 1 |
| FR-005 | Registro de tentativas (answers) | Must | 1 |
| FR-006 | Simulados (área/completo) com cronômetro e correção | Must | 1 |
| FR-007 | Dashboard de desempenho por área/assunto e temporal | Must | 1 |
| FR-008 | Revisão inteligente (repetição espaçada) | Must | 1 |
| FR-009 | Documentação OpenAPI/Swagger de todos os endpoints | Must | 1 |
| FR-010 | Cronograma automático adaptado ao tempo | Should | 2 |
| FR-011 | Cálculo de nota por TRI | Should | 2 |
| FR-012 | Correção de redação por competência | Should | 2 |
| FR-013 | Favoritar questões / modo sem distrações | Could | 2 |
| FR-014 | Gamificação (streak, pontos, desafio diário) | Could | 3 |
| FR-015 | Motor de recomendação por erro recente | Could | 3 |
| FR-016 | Comunidade/fórum | Could | 3 |

---

## 7. Requisitos Não-Funcionais

| ID | Categoria | Descrição | Meta |
|---|---|---|---|
| NFR-001 | Performance (mobile) | Carregamento inicial em rede 3G | First Contentful Paint < 2,5s |
| NFR-002 | Performance (API) | Latência de endpoints de leitura | < 300ms p95 |
| NFR-003 | Peso do app | Bundle inicial do PWA | < 250KB gzip (rota inicial) |
| NFR-004 | Disponibilidade | Uptime em produção | ≥ 99% (alvo inicial) |
| NFR-005 | Acessibilidade | Conformidade WCAG | 2.1 AA |
| NFR-006 | Segurança | Senhas, transporte, segredos | Hash argon2/bcrypt, HTTPS, segredos fora do repo |
| NFR-007 | Privacidade | Dados de menores de idade (LGPD) | Minimização de PII; ver §17 |
| NFR-008 | Offline | Leitura básica de questões já carregadas | PWA com cache `[PLACEHOLDER]` |
| NFR-009 | Internacionalização | Idioma primário PT-BR; docs espelhadas EN | i18n-ready |
| NFR-010 | Testabilidade | Cobertura mínima de testes no core | ≥ 70% statements no backend `[PLACEHOLDER ajustável]` |
| NFR-011 | Observabilidade | Logs estruturados + healthcheck | `/health` e logs JSON |

---

## 8. Arquitetura Técnica

### Visão geral

Monorepo com dois aplicativos (backend e web) e infraestrutura compartilhada, orquestrados por Docker Compose, com pipeline de CI/CD no GitHub Actions.

```
┌───────────────────────────────────────────────────────────────┐
│                         Navegador / PWA                         │
│            React + Vite + Tailwind (mobile-first)               │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS (REST + JSON)
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                      API — NestJS (TypeScript)                  │
│  Módulos: Auth · Users · Questions · Exams · Simulations ·     │
│  Performance · Review · (Essays, Schedule, Gamification…)       │
│  Swagger em /api · Validation Pipe · Guards JWT · Logging       │
└───────────────────────────┬───────────────────────────────────┘
                            │ Prisma Client
                            ▼
┌───────────────────────────────────────────────────────────────┐
│        Persistência — Prisma ORM                                │
│        Fase atual: SQLite (arquivo em volume)                   │
│        Produção (planejado): PostgreSQL  [PLACEHOLDER migração] │
└───────────────────────────────────────────────────────────────┘
```

### Escolhas tecnológicas (respeitando o repositório)

**Backend** (já estabelecido):
- **NestJS 11 + TypeScript** — módulos de domínio adicionados ao `AppModule`.
- **Swagger/OpenAPI** (`@nestjs/swagger`) servido em `/api`.
- **Prisma ORM** — *a adicionar* (`@prisma/client`, `prisma` dev). Datasource **SQLite** na fase atual; provider trocável para PostgreSQL via env.
- **Auth**: `@nestjs/jwt` + Passport; hashing com `argon2` (ou `bcrypt`).
- **Validação**: `class-validator` + `ValidationPipe` global; DTOs tipados.
- **Config**: `@nestjs/config` lendo `.env` (já ignorado no git; manter `.env.example`).

**Frontend** (respeitando Tailwind do README + sinais do `.gitignore`):
- **React + Vite + TypeScript + Tailwind CSS**, configurado como **PWA mobile-first**.
- Estado/dados: `[PLACEHOLDER — TanStack Query recomendado para cache de API]`.
- Trilha futura **React Native/Expo** para apps nativos (entradas já presentes no `.gitignore`).

**Banco de dados:**
- **SQLite** (arquivo `openem_backend/prisma/dev.db`, persistido em volume Docker) — simples, sem serviço externo, ideal para a fase atual e para CI.
- Migrations versionadas via **Prisma Migrate**. Caminho de produção → **PostgreSQL** documentado como `[PLACEHOLDER]`.

**Infra:** Docker + **Docker Compose**; **GitHub Actions** para CI/CD.

> **Nota sobre IA:** a correção de redação por IA (Fase 3) usa uma arquitetura **multi-provedor** (`common/essay-ai/` — Anthropic Claude, OpenAI, OpenAI-compatível/Ollama/Groq/OpenRouter e Google Gemini). O provedor ativo é selecionado por `ESSAY_AI_PROVIDER` ou auto-detectado a partir das chaves/URLs configuradas; sem provedor, o app recai na rubrica manual.

---

## 9. Modelo de Dados (Prisma + SQLite)

Esquema de alto nível (campos resumidos; `[PLACEHOLDER]` onde detalhes dependem de modelagem fina). Datasource SQLite na fase atual:

```prisma
// openem_backend/prisma/schema.prisma  (rascunho)
datasource db {
  provider = "sqlite"          // fase atual; produção -> "postgresql" [PLACEHOLDER]
  url      = env("DATABASE_URL") // ex.: "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  profile      Profile?
  answers      Answer[]
  simulations  Simulation[]
  reviewItems  ReviewItem[]
}

model Profile {
  id            String  @id @default(cuid())
  userId        String  @unique
  user          User    @relation(fields: [userId], references: [id])
  goal          String  // SISU | PROUNI | TREINEIRO  (enum via string no SQLite)
  minutesPerDay Int     // tempo disponível para cronograma/recomendação
  displayName   String?
}

model Subject {      // Área do conhecimento (Matemática, Ciências da Natureza, …)
  id     String  @id @default(cuid())
  name   String  @unique
  topics Topic[]
}

model Topic {        // Assunto granular dentro da área
  id        String     @id @default(cuid())
  name      String
  subjectId String
  subject   Subject    @relation(fields: [subjectId], references: [id])
  questions Question[]
  @@unique([subjectId, name])
}

model ExamYear {     // Prova oficial do ENEM por ano (para "mais cobrados", fidelidade)
  id        String     @id @default(cuid())
  year      Int        @unique
  questions Question[]
}

model Question {
  id           String        @id @default(cuid())
  statement    String        // enunciado
  difficulty   Int           // nível 1..5 (questões por nível)
  explanation  String        // comentário / resolução
  topicId      String
  topic        Topic         @relation(fields: [topicId], references: [id])
  examYearId   String?
  examYear     ExamYear?     @relation(fields: [examYearId], references: [id])
  alternatives Alternative[]
  answers      Answer[]
  @@index([topicId, difficulty])
}

model Alternative {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id])
  text       String
  isCorrect  Boolean
}

model SimulationTemplate {   // configura simulados (área X ou completo, nº de questões, tempo)
  id          String       @id @default(cuid())
  name        String
  scope       String       // AREA | FULL
  subjectId   String?
  timeLimitMin Int?
  simulations Simulation[]
}

model Simulation {
  id          String             @id @default(cuid())
  userId      String
  user        User               @relation(fields: [userId], references: [id])
  templateId  String
  template    SimulationTemplate @relation(fields: [templateId], references: [id])
  startedAt   DateTime           @default(now())
  finishedAt  DateTime?
  rawScore    Float?             // acertos brutos (MVP)
  triScore    Float?             // nota TRI (3PL) — populada quando as questões têm calibração
  answers     Answer[]
}

model Answer {       // tentativa avulsa ou dentro de simulado
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  questionId   String
  question     Question    @relation(fields: [questionId], references: [id])
  chosenId     String?     // alternativa escolhida
  isCorrect    Boolean
  timeSpentSec Int?
  simulationId String?
  simulation   Simulation? @relation(fields: [simulationId], references: [id])
  createdAt    DateTime    @default(now())
  @@index([userId, questionId])
}

model ReviewItem {   // fila de revisão espaçada por assunto/questão
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  topicId    String
  easeFactor Float    @default(2.5)   // SM-2 simplificado
  intervalD  Int      @default(0)
  dueAt      DateTime @default(now())
}

// ---- Fase 2 (implementados) ----
// Question ganhou parâmetros TRI 3PL nullable: discrimination (a),
// irtDifficulty (b), guessing (c). Profile ganhou focusMode Boolean.

model Favorite {        // questões salvas pelo usuário
  id String @id @default(cuid())
  userId String
  questionId String
  createdAt DateTime @default(now())
  @@unique([userId, questionId])
}

model StudyPlan {       // um plano ativo por usuário
  id String @id @default(cuid())
  userId String @unique
  minutesPerDay Int
  createdAt DateTime @default(now())
  sessions StudySession[]
}

model StudySession {    // bloco de estudo de um assunto num dia do plano
  id String @id @default(cuid())
  planId String
  topicId String
  dayIndex Int
  minutes Int
  done Boolean @default(false)
}

model EssayPrompt {     // tema de redação
  id String @id @default(cuid())
  title String
  theme String
  instructions String
  year Int?
}

model EssaySubmission { // redação enviada pelo usuário
  id String @id @default(cuid())
  userId String
  promptId String
  content String
  submittedAt DateTime @default(now())
}

model EssayEvaluation { // correção por rubrica (5 competências, 0..200 cada)
  id String @id @default(cuid())
  submissionId String @unique
  c1 Int; c2 Int; c3 Int; c4 Int; c5 Int
  total Int            // 0..1000
  feedback String?
  evaluatedAt DateTime @default(now())
}

// ---- Fase 3 (implementados) ----
// model GamificationStat { points, currentStreak, longestStreak, lastActivityOn, answersCount, correctCount }
// model UserAchievement { code, unlockedAt }   // catálogo em common/gamification.ts
// model DailyChallengeLog { day, claimedAt }   // desafio diário (common/daily-challenge.ts)
// model ForumThread { title, body, questionId?, userId, posts ForumPost[] }
// model ForumPost { threadId, userId, body }
// Profile ganhou gamificationEnabled (toggle) e onboarded (Fase 3).
```

> SQLite não tem `enum` nativo no Prisma; usamos `String` com valores controlados na aplicação. Ao migrar para PostgreSQL, converter para `enum` reais.

---

## 10. API

- **Estilo:** REST/JSON, versionada sob `/api/v1`. Documentação **OpenAPI via Swagger** em `/api` (já presente em `src/main.ts`).
- **Padrões:** `ValidationPipe` global, DTOs com `class-validator`, respostas de erro padronizadas, paginação consistente (`page`/`limit`), `JwtAuthGuard` nas rotas protegidas.
- **Healthcheck:** `GET /health` para Docker/CI.

**Endpoints principais (MVP):**

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Cria conta | — |
| POST | `/api/v1/auth/login` | Autentica, retorna JWT | — |
| GET/PUT | `/api/v1/users/me` | Lê/atualiza perfil | JWT |
| GET | `/api/v1/subjects` | Lista áreas | JWT |
| GET | `/api/v1/questions` | Busca/filtra (área, assunto, nível, ano) | JWT |
| GET | `/api/v1/questions/:id` | Detalha questão comentada | JWT |
| POST | `/api/v1/answers` | Registra tentativa | JWT |
| POST | `/api/v1/simulations` | Inicia simulado (template e/ou filtros por tema) | JWT |
| POST | `/api/v1/simulations/preview` | Quantas questões o recorte tem, antes de iniciar | JWT |
| POST | `/api/v1/simulations/templates` | Salva um simulado personalizado do aluno | JWT |
| DELETE | `/api/v1/simulations/templates/:id` | Remove/arquiva um simulado salvo | JWT |
| POST | `/api/v1/simulations/pdf` | Caderno em PDF no padrão ENEM | JWT |
| POST | `/api/v1/simulations/:id/pdf` | PDF de um simulado já feito | JWT |
| GET | `/api/v1/simulations/pdf-themes` | Temas de cor do caderno | JWT |
| POST | `/api/v1/simulations/:id/finish` | Finaliza e corrige | JWT |
| GET | `/api/v1/performance` | Estatísticas por área/assunto/tempo | JWT |
| GET | `/api/v1/review/queue` | Fila de revisão devida | JWT |

**Endpoints da Fase 2:**

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST/GET/DELETE | `/api/v1/favorites` (`/:questionId` no DELETE) | Salva/lista/remove questões favoritas | JWT |
| POST | `/api/v1/study-plan/generate` | Gera o cronograma a partir do desempenho e do tempo disponível | JWT |
| GET | `/api/v1/study-plan` | Cronograma atual (sessões por dia) | JWT |
| PATCH | `/api/v1/study-plan/sessions/:id` | Marca uma sessão como concluída | JWT |
| GET | `/api/v1/essays/prompts` · `/prompts/:id` | Temas de redação | JWT |
| POST/GET | `/api/v1/essays/submissions` (`/:id` no detalhe) | Envia/lista/detalha redações | JWT |
| POST | `/api/v1/essays/submissions/:id/evaluation` | Corrige por competência (rubrica, 5×0–200) | JWT |

**Endpoints da Fase 3 (implementados):**

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/v1/gamification/me` | Resumo: XP, nível, liga, progresso, sequência (streak) e conquistas | JWT |
| GET | `/api/v1/gamification/achievements` | Catálogo de conquistas com status de desbloqueio | JWT |
| GET | `/api/v1/gamification/daily-challenge` | Desafio diário (meta determinística por dia) | JWT |
| POST | `/api/v1/gamification/daily-challenge/claim` | Resgata a recompensa do desafio concluído | JWT |
| GET | `/api/v1/recommendation/next` | Questões recomendadas a partir dos erros recentes | JWT |
| GET | `/api/v1/community/threads` | Lista tópicos do fórum (com contagem de respostas) | JWT |
| POST | `/api/v1/community/threads` | Cria um tópico (vínculo a questão opcional) | JWT |
| GET | `/api/v1/community/threads/:id` | Detalha tópico com posts | JWT |
| POST | `/api/v1/community/threads/:id/posts` | Responde a um tópico | JWT |
| GET | `/api/v1/essays/ai-available` | Indica se a IA está configurada + provedor ativo | JWT |
| POST | `/api/v1/essays/submissions/:id/ai-evaluation` | Corrige redação por IA (multi-provedor) | JWT |

Notas: a nota **TRI** é devolvida em `POST /simulations/:id/finish` (e em `GET /simulations/:id`) quando todas as questões respondidas têm parâmetros TRI calibrados; o **modo sem distrações** é a flag `focusMode` em `PUT /users/me/profile`. **Gamificação** (Fase 3): ao responder questões (`POST /answers`) o usuário ganha **XP** (= base × **combo** da streak, + **bônus diário** na 1ª atividade do dia), sobe de **nível** (curva quadrática) e progride por **ligas** (Bronze→Diamante); o delta `gamification` da resposta inclui `xpGained`/`breakdown`/`level`/`leveledUp`/`league`/`newAchievements`. Tudo é derivado de `GamificationStat.points` (XP total) + streak — **sem novas colunas**. Controlado pela flag `gamificationEnabled` em `PUT /users/me/profile`; a lógica e o catálogo de conquistas vivem em `common/gamification.ts`. O frontend expõe a tela **Progresso**, um widget na Home e feedback de XP ao responder. A Fase 3 também entrega **desafio diário** (`GET /gamification/daily-challenge` + `POST .../claim`), **recomendação** (`GET /recommendation/next` — questões de tópicos fracos a partir dos erros recentes), **comunidade/fórum** (`community` — tópicos + respostas) e **IA de redação** multi-provedor (Anthropic, OpenAI, OpenAI-compatível, Gemini; `POST /essays/submissions/:id/ai-evaluation`, `GET /essays/ai-available`). O **onboarding** (objetivo + minutos/dia) é coletado no 1º acesso via `PUT /users/me/profile` (`onboarded` em `Profile`). O **simulado por tema** (C2) aceita filtros que se somam (`subjectAreaIds`/`subjectIds`/`topicIds`, mais prova, ano, nível e recortes pessoais), tem prévia de contagem (`POST /simulations/preview`) e pode ser salvo como `SimulationTemplate` do aluno (`scope: CUSTOM`, `ownerId`, `filters` em JSON). O **caderno em PDF** (C3) é gerado com PDFKit (`common/pdf/`), no padrão de duas colunas do ENEM, com capa, cartão-resposta, gabarito e tema de cor. Para o filtro por tema alcançar o banco oficial, a classificação de assunto ganhou um passe **determinístico por palavra-chave** (`common/classification/heuristic.ts`, `npm run db:classify:keywords`) que roda antes da classificação por IA e cala quando está em dúvida. Apps nativos (React Native/Expo) estão fora de cogitação por enquanto.

---

## 11. Frontend

**Princípios de UX (derivados dos insights):**
- **Mobile-first**, leve e rápido em internet limitada (NFR-001/003).
- **Direto ao ponto** — sem "enrolação", sem promessas irreais (frustração recorrente).
- **Feedback acionável** sempre visível (o que errei, o que revisar a seguir).
- **Gamificação opcional** (toggle) para não infantilizar o público adulto (Fernanda) mas engajar o Diego.

**Telas-chave (MVP):**
1. Onboarding curto (objetivo + tempo disponível).
2. Home/dashboard com pontos fracos e "próxima revisão".
3. Banco de questões com filtros (área/assunto/nível).
4. Player de questão (responder → feedback comentado imediato).
5. Simulado (cronômetro + navegação) e tela de resultado.
6. Estatísticas de desempenho (gráficos por área/assunto/tempo).

**Mockups/Design system:** `[PLACEHOLDER — Figma/links]`. Componentes com Tailwind; tema sóbrio com modo claro/escuro.

**Acessibilidade:** WCAG 2.1 AA — navegação por teclado, contraste ≥ 4.5:1, leitores de tela, validação automatizada (axe/Lighthouse no CI).

---

## 12. Infraestrutura, Docker e CI/CD

### Docker

Cada app tem seu **Dockerfile multi-stage** (build → runtime enxuto).

- **`openem_backend/Dockerfile`**: estágio de build (instala deps, `prisma generate`, `nest build`) → estágio runtime (`node dist/main`, usuário não-root, `EXPOSE 3000`, healthcheck em `/health`).
- **`openem_frontend/Dockerfile`**: multi-stage — build Vite → `nginx:1.27-alpine` servindo estáticos, `EXPOSE 80`, proxy de `/api` e `/health` para o backend.

### Docker Compose

`docker-compose.yml` na raiz orquestra os serviços. SQLite é arquivo em **volume nomeado** (sem serviço de banco separado na fase atual):

```yaml
# docker-compose.yml (rascunho)
services:
  backend:
    build: ./openem_backend
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=file:/data/dev.db
      - PORT=3000
    volumes:
      - sqlite-data:/data
    command: sh -c "npx prisma migrate deploy && node dist/main"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  frontend:                       # PWA React+Vite servido via Nginx
    build: ./openem_frontend
    ports: ["8080:80"]
    depends_on:
      backend:
        condition: service_healthy

volumes:
  sqlite-data:
```

`docker-compose.override.yml` (já ignorado no git) para ajustes locais de desenvolvimento (hot-reload, bind mounts).

> Caminho de produção: trocar `backend` para usar **PostgreSQL** e adicionar serviço `db` (Postgres) — `[PLACEHOLDER]` quando a migração ocorrer.

### CI/CD — GitHub Actions

Pipeline em `.github/workflows/ci.yml`, disparado em **push** e **pull_request** para `main` e branches `feature/**`/`fix/**`.

**Jobs:**
1. **lint** — `npm ci` + `npm run lint` (backend; e frontend quando existir).
2. **test** — `prisma generate` + `prisma migrate deploy` (SQLite efêmero) + `npm test` (unit) + `npm run test:e2e`; sobe **cobertura** como artefato.
3. **build** — `npm run build` (backend) e build do frontend; falha o pipeline se não compilar.
4. **docker** — `docker build` das imagens (valida os Dockerfiles em todo PR). Push para registry fica desativado por enquanto — `[PLACEHOLDER — registry/credenciais via secrets quando houver hospedagem]`.
5. **deploy** — **Decisão atual:** sem deploy automático em servidor remoto. Enquanto não houver VPS, a aplicação roda via **`docker compose up` na máquina do mantenedor**; o CI apenas garante que as imagens **constroem e passam nos testes**. Quando uma VPS for provisionada, adicionar job de deploy (acionado só na `main`).

**Princípios:**
- Todo PR deve passar lint + testes antes do merge (branch protection — `[PLACEHOLDER configurar no GitHub]`).
- Segredos via **GitHub Secrets**, nunca no repo (alinha com `SECURITY.md`).
- Conventional Commits validados (opcional: job de lint de commit).

---

## 13. Estratégia de Testes Automatizados

Toda a pirâmide integrada ao CI (job **test**), respeitando o Jest já configurado.

| Camada | Ferramenta | Escopo | Onde |
|---|---|---|---|
| **Unitários** | Jest (`*.spec.ts`) | Services, regras (correção, TRI, repetição espaçada) com mocks de Prisma | `openem_backend/src` |
| **Integração** | Jest + Prisma em **SQLite efêmero** | Repositórios/serviços contra banco real de teste | backend |
| **E2E (API)** | Jest + Supertest (`*.e2e-spec.ts`) | Fluxos HTTP (auth, questões, simulado→correção) | `openem_backend/test` |
| **Frontend (unit/componentes)** | Vitest + Testing Library | Componentes e hooks | `openem_frontend` |
| **E2E (UI)** | Playwright `[PLACEHOLDER]` | Fluxos críticos no navegador | frontend |
| **Acessibilidade** | axe / Lighthouse CI `[PLACEHOLDER]` | WCAG AA nas telas-chave | CI |

**Metas:** cobertura ≥ 70% no core do backend (NFR-010, ajustável); todo bug corrigido acompanha teste de regressão; testes rodam em todo PR e bloqueiam merge em falha.

---

## 14. Métricas de Sucesso

**Framework:** combinação de **North Star** + **HEART** + **AARRR**.

**Métrica-Norte:** **simulados/sessões de estudo concluídos por usuário ativo por semana** — captura o valor central (estudo efetivo e recorrente).

| Categoria (HEART) | Métrica | Alvo |
|---|---|---|
| Happiness | NPS / satisfação | `[PLACEHOLDER]` |
| Engagement | Sessões/semana por usuário ativo | `[PLACEHOLDER]` |
| Adoption | % de novos que completam onboarding | ≥ 70% |
| Retention | Retenção D7 / D30 | `[PLACEHOLDER]` |
| Task success | % de simulados iniciados que são concluídos | ≥ 80% |

**AARRR (resumo):** Aquisição via WhatsApp/indicação; Ativação = 1º simulado concluído; Retenção = revisão recorrente; Receita = N/A no MVP (gratuito); Indicação = convites/compartilhamento.

**Eventos a instrumentar:** `signup`, `onboarding_completed`, `question_answered`, `simulation_started`, `simulation_finished`, `review_completed`, `performance_viewed`. Ferramenta de analytics: `[PLACEHOLDER — preferir solução self-host/privacy-friendly]`.

---

## 15. Roadmap e Marcos

> Datas como `[PLACEHOLDER]` — preencher conforme capacidade da equipe/comunidade.

| Fase | Entregáveis | Status |
|---|---|---|
| **0 — Fundação** | Prisma+SQLite integrado, módulo Auth, Docker Compose, pipeline CI/CD, scaffold do frontend | ✅ Implementada |
| **1 — MVP (backend)** | Banco de questões (busca/filtro), respostas, simulados (iniciar/finalizar/corrigir), desempenho por área/assunto, revisão inteligente (SM-2) | ✅ Implementada (API + UI) |
| **2 — Pós-MVP** | Cronograma automático, TRI, correção de redação (rubrica), favoritos, modo sem distrações | ✅ Implementada (API + UI) |
| **3 — Avançado** | Recomendação por erro, gamificação, comunidade, IA de redação (multi-provedor), onboarding | ✅ Implementada (API + UI) · Apps nativos fora de cogitação por enquanto |

**Marcos-chave:**
- Esquema Prisma + 1ª migration SQLite versionada.
- Pipeline CI verde (lint + testes + build + docker) em PR.
- Primeiro fluxo e2e: cadastro → responder questão → simulado → estatísticas.

---

## 16. Riscos e Mitigações

| Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|
| Over-engineering do MVP | Alto | Média | Travar escopo no "quarteto essencial"; fases explícitas |
| Experiência mobile ruim | Alto | Média | Mobile-first desde o design; orçamento de performance no CI (Lighthouse) |
| Questões fora do padrão ENEM | Alto | Média | Curadoria e fidelidade ao estilo; usar provas oficiais (`ExamYear`) |
| Correção de redação superficial | Médio | Média | Não lançar até ter feedback por competência de qualidade (rubrica antes de IA) |
| Gamificação infantiliza adultos | Médio | Média | Tornar gamificação opcional (toggle) |
| Custo de IA/TRI vs. produto 100% gratuito | Médio | Alta | Produto sempre grátis; custos cobertos por doações/patrocínio; recursos caros entram por fase conforme financiamento disponível |
| Migração SQLite→Postgres custosa | Médio | Baixa | Prisma abstrai provider; evitar SQL cru; cobrir com testes de integração; migração planejada só ao validar o MVP |
| LGPD com menores de idade | Alto | Média | Minimização de PII desde o início; consentimento claro; formalização jurídica/consentimento parental quando houver tração |

---

## 17. Dependências e Premissas

**Dependências internas:**
- [x] Adicionar Prisma ao `openem_backend` e definir `schema.prisma` — implementado (SQLite, 7 migrations).
- [x] Criar o app `openem_frontend` (React+Vite+Tailwind PWA) — implementado, cobrindo Fases 1–3.
- [ ] Conteúdo seed **misto**: provas oficiais do ENEM + questões autorais da comunidade, com **comentários próprios** escritos pela equipe/colaboradores.

**Dependências externas:**
- [x] Provas oficiais do ENEM (INEP/MEC, domínio público) para fidelidade/curadoria — importadas do dataset aberto do enem-api (`npm run db:import:enem`): 26 provas, ~4 mil questões com gabarito e imagens. Comentário e classificação por assunto via IA, sob demanda.
- [ ] Questões autorais sob licença compatível (AGPL/CC) — definir rubrica de curadoria.
- [x] Provedor de IA (Fase 3) — arquitetura multi-provedor implementada (Anthropic, OpenAI, OpenAI-compatível, Gemini); escolha do provedor padrão por configuração via env.
- [ ] Registry de imagens / VPS — **adiado**; por enquanto execução local via Docker Compose.

**Premissas:**
- O público é majoritariamente mobile/Android com internet limitada (validado na pesquisa).
- O produto é **100% gratuito** e assim permanece; sustentação por doações/patrocínio, sem bloquear nenhuma funcionalidade.
- Contribuições seguem AGPL-3.0, Conventional Commits e fluxo de branches (`main` protegida).

---

## 18. Decisões Tomadas e Questões em Aberto

### Decisões tomadas (v1.1)

- [x] **Sustentabilidade/monetização** → **100% gratuito**, sustentado por doações/patrocínio/grants. Sem paywall em nenhuma fase.
- [x] **Origem do conteúdo** → **misto**: provas oficiais do ENEM (INEP, domínio público) + questões autorais da comunidade, com comentários próprios. Licença das questões autorais compatível com AGPL/CC.
- [x] **Banco de produção** → manter **SQLite até validar o MVP**; migrar para **PostgreSQL** antes do lançamento público com tração. Prisma abstrai a troca de provider.
- [x] **Estratégia mobile** → **PWA responsivo (React+Vite)** no MVP e por enquanto. Apps nativos (React Native/Expo) estavam previstos na Fase 3, mas estão **fora de cogitação no curto prazo** — o PWA atende o público-alvo (mobile-first, Android) com manutenção de uma única base. Reavaliar somente se um requisito nativo (ex.: notificações push, integração com OS) tornar-se crítico.
- [x] **Provedor de IA** → arquitetura **multi-provedor** (Fase 3): Anthropic Claude, OpenAI, OpenAI-compatível (Ollama/Groq/OpenRouter) e Google Gemini. Seleção por `ESSAY_AI_PROVIDER` ou auto-detecção a partir das chaves configuradas; sem provedor, recai na rubrica manual.
- [x] **LGPD** → **minimização de PII desde o início** (coletar o mínimo, consentimento claro); formalização jurídica/consentimento parental quando houver tração.
- [x] **Deploy/hospedagem** → enquanto **não houver VPS**, execução via **`docker compose up` na máquina do mantenedor**; o CI/CD apenas constrói imagens e roda testes. Job de deploy remoto entra quando uma VPS for provisionada.

### Ainda em aberto

- [ ] **Rubrica de curadoria** das questões autorais (quem revisa, critérios de fidelidade ao padrão ENEM). Owner: `[PLACEHOLDER]`.
- [ ] **Metas numéricas** de usuários ativos, retenção (D7/D30) e datas do roadmap. Owner: `[PLACEHOLDER]`.
- [ ] **Escopo do modo offline** do PWA (o que fica disponível sem internet). Owner: `[PLACEHOLDER]`.
- [ ] **Ferramenta de analytics** (preferência por solução self-host/privacy-friendly). Owner: `[PLACEHOLDER]`.

---

## 19. Anexo: Estrutura de Pastas Proposta

```
OpENEM/
├── openem_backend/              # API NestJS (já existe)
│   ├── prisma/
│   │   ├── schema.prisma        # [a criar] datasource sqlite
│   │   ├── migrations/          # [a criar] Prisma Migrate
│   │   └── seed.ts              # [a criar] dados iniciais
│   ├── src/
│   │   ├── auth/                # [a criar] JWT, guards
│   │   ├── users/              # [a criar]
│   │   ├── questions/          # [a criar]
│   │   ├── simulations/        # [a criar]
│   │   ├── performance/        # [a criar]
│   │   ├── review/             # [a criar]
│   │   ├── prisma/             # [a criar] PrismaModule/Service
│   │   ├── health/             # [a criar] /health
│   │   └── main.ts             # Swagger em /api (existe)
│   ├── test/                    # e2e (existe)
│   └── Dockerfile               # [a criar]
├── openem_frontend/             # [a criar] React + Vite + Tailwind (PWA)
│   ├── src/
│   ├── Dockerfile
│   └── ...
├── docs/
│   └── PRD.md                   # este documento
├── docker-compose.yml           # [a criar]
├── docker-compose.override.yml  # local (gitignored)
├── .github/
│   ├── workflows/ci.yml         # [a criar] CI/CD
│   └── docs/                    # espelhos EN
├── README.md  ·  CONTRIBUTING.md  ·  SECURITY.md  ·  LICENSE
```

---

### Changelog

| Versão | Data | Autor | Mudanças |
|---|---|---|---|
| 1.0 | 2026-06-16 | Equipe OpENEM | Rascunho inicial: planejamento completo (front, back, dados, Docker, CI/CD, testes) |
| 1.1 | 2026-06-16 | Equipe OpENEM | Decisões resolvidas: 100% gratuito (doações), conteúdo misto, PWA no MVP, SQLite→Postgres pós-MVP, IA adiada p/ Fase 3, minimização de PII, deploy local via Docker Compose até haver VPS |
</content>
</invoke>
