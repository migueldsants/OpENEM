---
titulo: Free materials (Where to study)
descricao: The rules for adding a link to the Where to study screen, the tests that enforce them, the weekly checker and how to take a link down.
---

The **Onde estudar** (Where to study) screen lists free materials from other institutions. A bad link there could send a student to paid content, to a pirated copy or to a site that changed hands, so each rule below is enforced by a test and does not depend on someone remembering it.

## Where the catalog lives

The catalog is code, versioned in the backend: `openem_backend/src/study-resources/study-resources-catalog.ts`. It has two lists:

- **Institutions** (`STUDY_PROVIDERS`): name, kind (`publico` for public or `sem-fins-lucrativos` for non-profit), a short text on why the material is free, and the `bases`, the addresses of the institution's website.
- **Materials** (`STUDY_RESOURCES`): id, title, address, institution, types, subjects and topics from the taxonomy, description, language and the date of the check (`checkedAt`).

The `GET /api/v1/study-resources` route returns the catalog to the screen, without blocked materials and without those whose check has expired. There is no database table and no material sent by students.

## The rules

`src/study-resources/study-resource-rules.ts` holds the rules, and `study-resources-catalog.spec.ts` runs all of them on the real catalog:

1. **Only public or non-profit institutions.** Prep courses, publishers and commercial platforms are left out, even with free content: their free part is usually a storefront for the paid one.
2. **The link stays on the institution's website.** The URL must start with one of its `bases`. A base on an open platform (YouTube, Drive, Scribd, Academia.edu, blogs), a URL shortener or a file host is refused: there is no way to know who published there, and a copy of a book on another site may be pirated.
3. **https only**, with no embedded user or password and no tracking, campaign or affiliate parameter (`utm_`, `ref`, `aff`…).
4. **The project's own description.** Write it in your own words, between 40 and 260 characters; do not copy the site's description, which has an author. Sales words (subscription, free trial, coupon, price, R$) fail the test.
5. **Subject and topic from the taxonomy.** Every subject cited exists in `src/common/taxonomy.ts`, and every topic belongs to one of the subjects cited. Every subject has at least one material.
6. **A dated check.** `checkedAt` is the day a person opened the link. A date in the future fails the test. After 365 days without a new check, the material leaves the screen on its own: if nobody maintains the catalog, it empties instead of sending students to broken links.

## How to add a material

1. Open the link in a private window. Everything must open without paying and without creating an account; an optional account that only saves progress is fine.
2. Check who publishes it: the material must belong to the institution itself, on its own website. If the institution is not in the catalog yet, add it with the narrowest possible base (`https://www.gov.br/inep/`, not `https://www.gov.br/`).
3. Write the title and description in your own words. If the material is not in Portuguese, say so and use `language: 'en'` or `'es'`.
4. Put today's date in `checkedAt`.
5. Run `npm test -- study-resources` and `npm run recursos:verificar` in `openem_backend/`.

In the humanities, the rule of the flashcards and study tracks applies: material that takes a side in a public debate is left out, or comes in only next to material with the other positions.

## The link checker

`npm run recursos:verificar` (`scripts/verificar-recursos.ts`, logic in `src/study-resources/link-check.ts`) opens each link like a browser and follows redirects one by one. It is a **failure** when the page no longer exists, asks for login or payment (401, 402 or a login, sign-up or checkout path), redirects outside the institution's website or to http, or when the check has expired. It is **inconclusive** when the site has bot protection (Cloudflare and the like): the script does not fail, but asks you to check in the browser. It also warns about checks that expire within 30 days.

The `.github/workflows/recursos.yml` workflow runs the checker every Monday. When it fails, GitHub notifies the project maintainers. It stays out of the pull request CI on purpose: a site being down must not block anyone's work.

To renew a check, open the link again, make sure nothing changed and update `checkedAt`.

## Taking a link down

- **Right away, without a new version:** whoever hosts the instance puts the id in `STUDY_RESOURCES_BLOCKED` (ids separated by commas) and restarts the backend. Use it for a removal request from a rights holder, a link that started charging or one that leads to inappropriate content. See [Environment variables](/docs/en/hospedar/variaveis/).
- **For good:** open a pull request that removes the material from the catalog.

The Terms of Use tell students that the link is removed from the list while the request is reviewed. Whoever hosts an instance must honor that with the variable above.
