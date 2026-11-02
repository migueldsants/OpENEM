---
titulo: ENEM data
descricao: Where OpENEM's questions and essay prompts come from, how they are imported and classified and how the dataset is fixed.
---

## Where the questions come from

The question bank comes from INEP's official exams, through the static dataset of the [enem-api](https://github.com/yunger7/enem-api) project, in the updated fork [updated-enem-api](https://github.com/migueldsants/updated-enem-api).

The dataset is GPL-2.0 and OpENEM is AGPL-3.0, so it is **never committed** to this repository. The importer downloads the tarball from GitHub (about 177 MB) into a folder ignored by git (`ENEM_DATASET_DIR`, by default `openem_backend/prisma/.enem-dataset`).

## The import

```bash
npm run db:import:enem
npm run db:import:enem -- --exam=2023
npm run db:import:enem -- --limit=5 --dry-run
```

- The script is `prisma/import-enem.ts` (with `import-enem-lib.ts`); the pure, tested mapping lives in `src/common/enem-import/mapping.ts`.
- Each dataset folder is one application of the exam.
- The area comes from the question's position in the booklet; the dataset label only counts when the number is outside the official range. Foreign language questions already arrive with a subject and topic, through the `language` field.
- All other questions arrive **without a topic** (null `topicId`) and **without an explanation** (null `explanation`).
- The images go to `ENEM_MEDIA_DIR` and the API serves them at `/media/enem/`.
- An incomplete question (no alternatives or an inconsistent answer key) is rejected and listed in the final report.
- The import is idempotent: running it again updates without duplicating and does not undo explanations or classifications made afterwards.
- It never runs inside `seed.ts`, because the e2e suite runs the seed on every run, and it refuses to run against the `test_e2e` schema.

### Applications

The folder suffix sets the application type (`ExamYear.kind`) and the letter that goes into the question code, as in `ENEM-2014T-136`:

| Folder suffix | `kind` | Letter |
| --- | --- | --- |
| none | `REGULAR` | none |
| `-reaplicacao` | `REAPLICACAO` | R |
| `-segunda-aplicacao` | `SEGUNDA_APLICACAO` | S |
| `-terceira-aplicacao` | `TERCEIRA_APLICACAO` | T |
| `-digital` | `DIGITAL` | D |
| `-belem` | `REGIONAL` | B |

The `isReapplication` field is only true for `REAPLICACAO`.

### ENEM from 1998 to 2008

Until 2008, the ENEM was a single exam of 63 interdisciplinary questions, on one day, lasting 5 hours. Each one becomes a single simulation, which the screen shows as "Prova única" (single exam).

INEP assigns no area to these questions (the dataset has `discipline: null`). The area the app shows comes from [`legacy-areas.ts`](https://github.com/migueldsants/OpENEM/blob/main/openem_backend/src/common/enem-import/legacy-areas.ts) and is **OpENEM's classification by content, not official data**: made with the help of AI, checked by sampling and flagged as `areaClassified` in the import. A question that is not in the map comes in without an area.

The answer key of these exams, and of the 2010 and 2011 PPL, comes from INEP's microdata, through `tools/enem-fix/gabaritos-antigos.mjs`.

## Topic classification

Spaced review, recommendations and performance by topic only reach questions that have a topic. There are three steps, in this order:

```bash
npm run db:classify:keywords -- --dry-run --sample=20
npm run db:classify:keywords
npm run db:classify:catalog
npm run db:classify -- --limit=50 --dry-run
npm run db:classify
```

1. **Keywords** (`prisma/classify-heuristic.ts`, with the logic in `src/common/classification/heuristic.ts`): deterministic and without AI. It **stays silent** when two topics tie, because a wrong topic contaminates review, recommendations and performance. It writes `classificationSource: 'keywords'` and only touches questions without a topic.
2. **Topic catalog** (`prisma/classify-catalog.ts`, with the logic in `src/common/classification/catalog.ts`): `prisma/classificacao-assuntos.json` is a classification made once with AI and committed, keyed by `externalId`, with the "Subject / Topic" label and the confidence. It is **not official**. It only fills questions without a topic and ignores confidence below 0.6, topics that left the taxonomy and topics from another area. It runs in the bootstrap right after the keywords, and with both steps the whole bank ends up with a topic.
3. **AI** (`prisma/classify-questions.ts`): takes what is left, such as the questions of an exam imported later. It only writes decisions with a confidence of at least 0.6 (`--min-confidence`) and needs a configured provider; see [Artificial intelligence](/docs/en/hospedar/ia/).

## Fixing the dataset

The dataset came from a PDF extraction and has defects: questions without the text of the alternatives, unreadable statements in 2017 and 2021 (fonts without a Unicode mapping), formulas turned into loose text, a Spanish answer key repeating the English one and missing questions. [`tools/enem-fix/`](https://github.com/migueldsants/OpENEM/blob/main/tools/enem-fix/README.md) rebuilds those questions from the official booklets:

- `parse.mjs` reads the booklet by coordinates, and whatever does not turn into clean text is cropped as an image;
- `gabarito.mjs` reads the answer by its position on the page, because the linearized text gets it wrong (in 2015 the columns are misaligned; in 2009 there are four booklets side by side);
- `criar.mjs` builds from scratch, from `provas-novas.json`, the exams the dataset does not have, and `--comparar` validates the extractor on an exam the dataset already has.

Two safeguards keep a question from being matched wrongly: the booklet numbering is checked against the dataset, and the official answer key only replaces the dataset's one when they agree on at least 90% of the exam. Whatever does not pass is left out, as an open item in the report.

> **Warning:** the output of `enem-fix` is not committed here, because it is derived from the GPL-2.0 dataset. It goes to the [updated-enem-api](https://github.com/migueldsants/updated-enem-api) repository. Since the import always downloads the dataset from there, a fix that is not published in that repository disappears on the next `db:import:enem --refresh`.

### Fixes in the import itself

A defect that does not need the booklet to be fixed is handled in the mapping, in `src/common/enem-import/mapping.ts`, and applies to any version of the dataset.

Today's case is the watermark of the 2022 reapplication booklet, the "ENEM 2022" repeated in the background of every page. The PDF extraction turned it into text: 63 repetitions at the start of the context of the first question on each page, in 48 questions. `removeWatermark` deletes from the context and the prompt any run of three or more consecutive "ENEM YYYY". A single "ENEM 2022" quoted in the exam text stays.

A fix like this only reaches the questions already in the database by reimporting. So, when you change the mapping in a way that alters an already imported question, **bump `ENEM_MAPPING_VERSION`** (in the same file) and note the reason in its comment. The full import records in the database (`AppState`, key `enem.mappingVersion`) the version it used, and the container's bootstrap compares the two on every start: when the code's is higher, it reimports everything in the background, with the API up (`src/common/bootstrap-plan.ts`). Whoever hosts only needs to deploy.

In dev, just import the exam again:

```bash
npm run db:import:enem -- --exam=2022-reaplicacao
```

## Essay prompt catalog

The **Redações** (essays) screen has the official ENEM essay prompts from 1998 to 2025 (regular, PPL or reapplication and the other applications), with the prompt, the supporting texts and the facsimile of the booklet page.

The catalog is static and committed: `openem_frontend/src/data/redacoes.json` and the figures in `openem_frontend/public/redacoes/`. There is no backend and no relation to the `essays` module. Everything is generated by [`tools/enem-fix/redacao/`](https://github.com/migueldsants/OpENEM/blob/main/tools/enem-fix/redacao/README.md) from INEP's booklets, whose PDFs stay out of git.

**These are official exam documents: the text is reproduced, never rewritten.** No correcting, summarizing, modernizing the spelling or making up labels. The spelling of the prompt is the booklet's, and song lyrics go in whole. Whatever departs from the transcription is flagged in the data and shown on screen: 2008 has no prompt sentence, and text the PDF only has as an image or in an unreadable font goes in as a cropped figure. The screen reader descriptions of the figures are OpENEM's and are not part of the document.

Do not edit the JSON by hand. Change the script and run, from `tools/enem-fix/`:

```bash
node redacao/montar.mjs
node redacao/verificar.mjs
```

`verificar.mjs` rereads each page with a second extractor and has to end with 0 differences. Then run `npm test` in the frontend: `src/data/redacoes.test.ts` locks the catalog structure.
