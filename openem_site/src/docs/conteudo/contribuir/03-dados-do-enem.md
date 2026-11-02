---
titulo: Dados do ENEM
descricao: De onde vêm as questões e as propostas de redação do OpENEM, como elas são importadas e classificadas e como o dataset é consertado.
---

## De onde vêm as questões

O banco de questões vem das provas oficiais do INEP, pelo dataset estático do projeto [enem-api](https://github.com/yunger7/enem-api), no fork atualizado [updated-enem-api](https://github.com/migueldsants/updated-enem-api).

O dataset é GPL-2.0 e o OpENEM é AGPL-3.0, então ele **nunca é versionado** neste repositório. O importador baixa o tarball do GitHub (cerca de 177 MB) para uma pasta ignorada pelo git (`ENEM_DATASET_DIR`, por padrão `openem_backend/prisma/.enem-dataset`).

## O import

```bash
npm run db:import:enem
npm run db:import:enem -- --exam=2023
npm run db:import:enem -- --limit=5 --dry-run
```

- O script é `prisma/import-enem.ts` (com `import-enem-lib.ts`); o mapeamento puro e testado fica em `src/common/enem-import/mapping.ts`.
- Cada pasta do dataset é uma aplicação da prova.
- A área vem da posição da questão no caderno; o rótulo do dataset só vale quando o número está fora da faixa oficial. As questões de língua estrangeira já chegam com matéria e assunto, pelo campo `language`.
- As demais questões entram **sem assunto** (`topicId` nulo) e **sem comentário** (`explanation` nulo).
- As imagens vão para `ENEM_MEDIA_DIR` e a API as serve em `/media/enem/`.
- Questão incompleta (sem alternativas ou com gabarito inconsistente) é recusada e listada no relatório final.
- O import é idempotente: rodar de novo atualiza sem duplicar e não desfaz comentários nem classificações feitos depois.
- Ele nunca roda dentro do `seed.ts`, porque a suíte e2e roda o seed a cada execução, e se recusa a rodar contra o schema `test_e2e`.

### Aplicações

O sufixo da pasta define o tipo da aplicação (`ExamYear.kind`) e a letra que entra no código da questão, como em `ENEM-2014T-136`:

| Sufixo da pasta | `kind` | Letra |
| --- | --- | --- |
| nenhum | `REGULAR` | nenhuma |
| `-reaplicacao` | `REAPLICACAO` | R |
| `-segunda-aplicacao` | `SEGUNDA_APLICACAO` | S |
| `-terceira-aplicacao` | `TERCEIRA_APLICACAO` | T |
| `-digital` | `DIGITAL` | D |
| `-belem` | `REGIONAL` | B |

O campo `isReapplication` só fica verdadeiro para `REAPLICACAO`.

### ENEM de 1998 a 2008

Até 2008, o ENEM era uma prova única de 63 questões interdisciplinares, num dia só, com 5 horas. Cada uma vira um simulado só, que a tela mostra como "Prova única".

O INEP não atribui área a essas questões (o dataset traz `discipline: null`). A área que o app mostra vem de [`legacy-areas.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/common/enem-import/legacy-areas.ts) e é **classificação do OpENEM pelo conteúdo, não dado oficial**: feita com apoio de IA, conferida por amostragem e marcada como `areaClassified` no import. Questão que não está no mapa entra sem área.

O gabarito dessas provas, e o das PPL de 2010 e 2011, sai dos microdados do INEP, por `tools/enem-fix/gabaritos-antigos.mjs`.

## Classificação de assunto

Revisão espaçada, recomendação e desempenho por assunto só alcançam questão com assunto. São três etapas, nesta ordem:

```bash
npm run db:classify:keywords -- --dry-run --sample=20
npm run db:classify:keywords
npm run db:classify:catalog
npm run db:classify -- --limit=50 --dry-run
npm run db:classify
```

1. **Palavra-chave** (`prisma/classify-heuristic.ts`, com a lógica em `src/common/classification/heuristic.ts`): determinística e sem IA. Ela **se cala** quando dois assuntos empatam, porque assunto errado contamina revisão, recomendação e desempenho. Grava `classificationSource: 'keywords'` e só mexe em questão sem assunto.
2. **Catálogo de assuntos** (`prisma/classify-catalog.ts`, com a lógica em `src/common/classification/catalog.ts`): `prisma/classificacao-assuntos.json` é uma classificação feita uma vez com IA e versionada, por `externalId`, com o rótulo "Matéria / Assunto" e a confiança. Ela é **não oficial**. Só preenche questão sem assunto e ignora confiança abaixo de 0,6, assunto que saiu da taxonomia e assunto de outra área. Roda no bootstrap logo depois das palavras-chave, e com as duas o banco inteiro fica com assunto.
3. **IA** (`prisma/classify-questions.ts`): pega o que sobrou, como as questões de uma prova importada depois. Só grava decisões com confiança de pelo menos 0,6 (`--min-confidence`) e precisa de um provedor configurado; veja [Inteligência artificial](/docs/hospedar/ia/).

## O conserto do dataset

O dataset veio de uma extração de PDF e traz defeitos: questões sem o texto das alternativas, enunciados ilegíveis em 2017 e 2021 (fontes sem mapeamento para Unicode), fórmulas viradas texto solto, gabarito de espanhol repetindo o de inglês e questões que faltam. O [`tools/enem-fix/`](https://github.com/migueldsants/OpENEM/blob/main/tools/enem-fix/README.md) refaz essas questões a partir dos cadernos oficiais:

- `parse.mjs` lê o caderno pelas coordenadas, e o que não vira texto limpo é recortado como imagem;
- `gabarito.mjs` lê a resposta pela posição na página, porque o texto linearizado erra (em 2015 as colunas estão desalinhadas; em 2009 há quatro cadernos lado a lado);
- `criar.mjs` monta do zero, a partir de `provas-novas.json`, as provas que o dataset não tem, e `--comparar` valida o extrator numa prova que o dataset já tem.

Duas travas evitam casar questão errada: a numeração do caderno é conferida contra o dataset, e o gabarito oficial só substitui o do dataset quando concorda com ele em pelo menos 90% da prova. O que não passa fica de fora, como pendência no relatório.

> **Atenção:** o resultado do `enem-fix` não é versionado aqui, porque é derivado do dataset GPL-2.0. Ele vai para o repositório [updated-enem-api](https://github.com/migueldsants/updated-enem-api). Como o import sempre baixa o dataset de lá, um conserto que não for publicado nesse repositório some no próximo `db:import:enem --refresh`.

### Consertos no próprio import

Defeito que não precisa do caderno para ser consertado é tratado no mapeamento, em `src/common/enem-import/mapping.ts`, e vale para qualquer versão do dataset.

O caso de hoje é a marca d'água do caderno da reaplicação de 2022, o "ENEM 2022" repetido no fundo de cada página. A extração do PDF a transformou em texto: 63 repetições no começo do contexto da primeira questão de cada página, em 48 questões. O `removeWatermark` apaga do contexto e do comando qualquer sequência de três ou mais "ENEM AAAA" seguidos. Um "ENEM 2022" citado no texto da prova fica.

Um conserto desses só chega às questões que já estão no banco reimportando. Por isso, ao mudar o mapeamento de um jeito que altera questão já importada, **suba `ENEM_MAPPING_VERSION`** (no mesmo arquivo) e anote o motivo no comentário dela. O import completo grava no banco (`AppState`, chave `enem.mappingVersion`) a versão que usou, e o bootstrap do container compara as duas a cada subida: com a do código maior, reimporta tudo em segundo plano, com a API no ar (`src/common/bootstrap-plan.ts`). Quem hospeda não precisa fazer nada além do deploy.

Em dev, basta reimportar a prova:

```bash
npm run db:import:enem -- --exam=2022-reaplicacao
```

## Catálogo de redações

A tela **Redações** traz os temas oficiais de redação do ENEM de 1998 a 2025 (regular, PPL ou reaplicação e as demais aplicações), com a proposta, os textos motivadores e o fac-símile da página do caderno.

O catálogo é estático e versionado: `openem_frontend/src/data/redacoes.json` e as figuras em `openem_frontend/public/redacoes/`. Não há backend nem relação com o módulo `essays`. Tudo é gerado por [`tools/enem-fix/redacao/`](https://github.com/migueldsants/OpENEM/blob/main/tools/enem-fix/redacao/README.md) a partir dos cadernos do INEP, cujos PDFs ficam fora do git.

**São documentos oficiais de prova: o texto é reproduzido, nunca reescrito.** Nada de corrigir, resumir, modernizar a ortografia ou inventar rótulo. A grafia do tema é a do caderno, e letras de música entram inteiras. O que foge da transcrição está marcado no dado e avisado na tela: 2008 não tem frase-tema, e texto que o PDF só tem como imagem ou em fonte ilegível entra como figura recortada. A descrição das figuras para leitor de tela é do OpENEM e não faz parte do documento.

Não edite o JSON à mão. Mexa no roteiro e rode, de `tools/enem-fix/`:

```bash
node redacao/montar.mjs
node redacao/verificar.mjs
```

O `verificar.mjs` relê cada página com um segundo extrator e tem de terminar com 0 divergências. Depois rode `npm test` no frontend: `src/data/redacoes.test.ts` trava a estrutura do catálogo.
