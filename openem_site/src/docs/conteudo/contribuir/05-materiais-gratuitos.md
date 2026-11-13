---
titulo: Materiais gratuitos (Onde estudar)
descricao: As regras para incluir um link na tela Onde estudar, os testes que as cobram, o verificador semanal e como tirar um link do ar.
---

A tela **Onde estudar** lista materiais gratuitos de outras instituições. Um link errado ali pode levar um aluno a conteúdo pago, a uma cópia pirata ou a um site que mudou de dono, por isso cada regra abaixo é cobrada por teste e não depende de alguém lembrar dela.

## Onde fica o catálogo

O catálogo é código, versionado, no backend: `openem_backend/src/study-resources/study-resources-catalog.ts`. Ele tem duas listas:

- **Instituições** (`STUDY_PROVIDERS`): nome, tipo (`publico` ou `sem-fins-lucrativos`), um texto curto sobre por que o material é gratuito e as `bases`, os endereços do site da instituição.
- **Materiais** (`STUDY_RESOURCES`): id, título, endereço, instituição, tipos, matérias e assuntos da taxonomia, descrição, idioma e a data da conferência (`checkedAt`).

A rota `GET /api/v1/study-resources` devolve o catálogo para a tela, sem os materiais bloqueados e sem os de conferência vencida. Não há tabela no banco nem material enviado por aluno.

## As regras

`src/study-resources/study-resource-rules.ts` tem as regras, e `study-resources-catalog.spec.ts` roda todas sobre o catálogo real:

1. **Só instituição pública ou sem fins lucrativos.** Cursinho, editora e plataforma comercial ficam de fora, mesmo com conteúdo gratuito: o gratuito delas costuma ser vitrine para o pago.
2. **O link fica no site da instituição.** A URL tem de começar por uma das `bases` dela. Base em plataforma aberta (YouTube, Drive, Scribd, Academia.edu, blogs), encurtador ou hospedagem de arquivo é recusada: nelas não dá para saber quem publicou, e uma cópia de livro em outro site pode ser pirata.
3. **Só https**, sem usuário ou senha embutidos e sem parâmetro de rastreio, campanha ou afiliado (`utm_`, `ref`, `aff`…).
4. **Descrição do projeto.** Escreva com as suas palavras, entre 40 e 260 caracteres; não copie a descrição do site, que tem autor. Palavras de venda (assinatura, teste grátis, cupom, preço, R$) reprovam o teste.
5. **Matéria e assunto da taxonomia.** Toda matéria citada existe em `src/common/taxonomy.ts`, e todo assunto é de uma das matérias citadas. Toda matéria tem ao menos um material.
6. **Conferência com data.** `checkedAt` é o dia em que uma pessoa abriu o link. Data no futuro reprova o teste. Depois de 365 dias sem nova conferência, o material some da tela sozinho: se ninguém mantiver o catálogo, ele esvazia em vez de mandar o aluno para link quebrado.

## Como incluir um material

1. Abra o link numa janela anônima. Tudo tem de abrir sem pagar e sem criar conta; conta opcional, que só guarda progresso, pode.
2. Confira quem publica: o material tem de ser da própria instituição, no site dela. Se a instituição ainda não está no catálogo, inclua-a com a base mais estreita possível (`https://www.gov.br/inep/`, não `https://www.gov.br/`).
3. Escreva título e descrição com as suas palavras. Se o material não é em português, diga isso e use `language: 'en'` ou `'es'`.
4. Ponha a data de hoje em `checkedAt`.
5. Rode `npm test -- study-resources` e `npm run recursos:verificar` em `openem_backend/`.

Em Humanas, vale a regra dos flashcards e das trilhas: material que toma lado em debate público fica de fora, ou entra só ao lado de material com as outras posições.

## O verificador de links

`npm run recursos:verificar` (`scripts/verificar-recursos.ts`, lógica em `src/study-resources/link-check.ts`) abre cada link como um navegador e segue os redirecionamentos um a um. É **falha** quando a página não existe mais, pede login ou pagamento (401, 402 ou caminho de login, cadastro ou checkout), redireciona para fora do site da instituição ou para http, ou quando a conferência venceu. É **inconclusivo** quando o site tem proteção contra robôs (Cloudflare e afins): o script não reprova, mas avisa para conferir no navegador. Ele também avisa a conferência que vence em até 30 dias.

O workflow `.github/workflows/recursos.yml` roda o verificador toda segunda-feira. Quando ele falha, o GitHub avisa quem mantém o projeto. Ele fica fora do CI dos PRs de propósito: um site fora do ar não pode travar o trabalho de ninguém.

Para renovar uma conferência, abra o link de novo, confira que nada mudou e atualize `checkedAt`.

## Tirar um link do ar

- **Na hora, sem nova versão:** quem hospeda põe o id em `STUDY_RESOURCES_BLOCKED` (ids separados por vírgula) e reinicia o backend. Use para um pedido de remoção de quem tem direitos sobre o conteúdo, um link que passou a cobrar ou que leva a conteúdo impróprio. Veja [Variáveis de ambiente](/docs/hospedar/variaveis/).
- **De vez:** abra um PR que tira o material do catálogo.

Os Termos de Uso dizem ao aluno que o link sai da lista enquanto o pedido é analisado. Quem hospeda uma instalação precisa cumprir isso com a variável acima.
