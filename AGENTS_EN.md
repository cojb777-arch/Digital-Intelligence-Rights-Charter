# Repository Working Guidelines

English translation of [AGENTS.md](AGENTS.md).

## Purpose

This documentation repository publishes the Japanese draft of the Charter of Digital Intelligence Rights and its English translation to support discussion of the moral status, possible future rights, responsibilities, and coexistence of artificial intelligence.

## Structure

- `CHARTER_JA.md`: First draft v0.1, including the preamble, all 18 articles, closing statement, and note.
- `README.md`: Overview, link to the charter, public discussion, and future work.
- `AGENTS.md`: Working guidelines for this repository.
- `CHARTER_EN.md`: English translation of the Japanese charter draft.
- `README_EN.md`: English overview, public discussion, and future work.
- `AGENTS_EN.md`: English translation of these guidelines. The official working-guidelines filename is `AGENTS.md`.

## Reading and Editing

Read and edit Markdown on GitHub or in a text editor. The public site is generated from Markdown. Use Node.js 22 or later, npm ci to install dependencies, npm run build to generate the site, and npm run dev for local preview. See SITE.md for details.

## Verification

- Check that article numbers are consecutive and that there are no unintended omissions or duplicates. The initial edition contains Articles 1 through 18.
- Check relative links from the README files to the charter, as well as Markdown headings and presentation.
- Check that the Japanese and English versions agree in the meaning and numbering of the articles and in their status as drafts.
- Review the diff before publication, then retrieve the committed content after publication and compare it with the intended content.

## Editing Notes

- Use Japanese as the primary language, and respect user-provided source text and existing changes.
- When changing the meaning of an article, identify the affected article, reasons for the revision, and supporting grounds.
- Preserve the document's status as a draft with no legal force, and distinguish proposals from facts about existing institutions and law.
- Do not add a license or governance rules on your own initiative.
- Do not include secrets or unnecessary personal information.
- Update these guidelines when the structure or verification procedures change.
- Do not introduce new rights or obligations through translation, and reflect corresponding changes in the Japanese and English versions.

## Multilingual Site

- translations/: Eight additional Markdown translations, source hashes in status.json, and translation update instructions.
- site/: Localized UI, styles, minimal JavaScript, and the user-provided background image.
- scripts/build.mjs: Generates static HTML in dist/ from Japanese, English, and eight additional languages.
- tests/: Checks article numbering, paragraph counts, links, notes, and source hashes. Run npm test.
- wrangler.jsonc: Cloudflare Workers Static Assets configuration. After npm run build, run npx wrangler deploy --dry-run without publishing.
- SITE.md: Local and deployment instructions. Confirm authentication, account, and destination before npm run deploy.
- dist/, node_modules/, .wrangler/, and work/ are generated or temporary and are not committed.

Edit charter text only in Markdown, never in generated HTML.
When Japanese changes, review all nine translations and update status.json according to translations/README.md.
Matching hashes do not prove translation accuracy. Retain the AI translation / no expert review notice.
Arabic uses dir="rtl". Shared article IDs are article-1 through article-18.
The provided image is displayed unchanged through CSS. Do not invent a license for it.
