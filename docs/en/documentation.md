# Maintaining documentation

<!-- rancho-language-navigation:start -->
[Português (Brasil)](../pt-BR/documentation.md) | [English](documentation.md)
<!-- rancho-language-navigation:end -->


## What belongs in the repository

Maintain information needed by future users and contributors: architecture, configuration, UI contracts, testing, security, migration/recovery, contribution and unresolved product acceptance. Do not keep chat handoffs, dated execution diaries, private fixture IDs, machine-specific progress notes or duplicate acceptance narratives in the active documentation. Previous committed versions remain available through Git; do not rewrite shared history to reorganize docs.

Application code lives in `console/`, backend changes in pinned patches, test harnesses in `tests/`, `console/tests/` and `migration/`, and reusable tools in `scripts/`. Root compose/bootstrap files are maintained entrypoints, not historical leftovers. Ignored local backups/evidence and generated source checkouts are not distributable content; documentation cleanup does not authorize deleting those resources.

## Languages and navigation

Topic guides live under `docs/pt-BR/` and `docs/en/` with matching names. Root GitHub conventions such as README/CONTRIBUTING/SECURITY and the console README remain English canonical files with full Portuguese equivalents. Bilingual instruction files and PR templates are shared deliberately. The root index and both portals let readers select a language for each document.

`docs/translations.json` records canonical source, language, paired paths and reviewed hashes. A review hash is a contributor declaration plus mechanical freshness checks, not automatic certification of translation quality. Translate the complete active document, preserving sections, identifiers, commands, evidence and limitations. Never use an abbreviated summary or copy Portuguese under an English heading.

## Changing or adding a guide

Edit both language versions for a behavior change. Register new pairs explicitly in the manifest, with a canonical source and both paths; do not classify an untranslated document as shared bilingual. Keep topics focused and link to the source contract rather than duplicating changing implementation details across many guides.

```sh
python scripts/docs_languages.py --navigation
python scripts/docs_languages.py --review docs/pt-BR/architecture.md --catalogs
python scripts/docs_languages.py --require-complete
python -m unittest discover -s tests -p test_docs_languages.py
```

Replace the example source with the affected canonical paths; `--review` accepts multiple documents. Review text before stamping hashes. Navigation updates only its owned block and preserves body/code bytes and manual valid selectors. Catalog generation never offers a missing translation link. The strict gate rejects missing or stale translations, changed code blocks/headings, broken local links, invalid paths and unregistered Markdown.

## Reviewing interface translations

The preview catalogs in `console/src/i18n/catalogs/` track their English source by message domain in `console/src/i18n/preview-sources.json`. Run `npm run check:locales` from `console/`. A wording or placeholder change in a translated domain requires reviewing every affected locale. The gate also runs in CI and the image build.

After reviewing and updating one locale, record its current source with `node scripts/check-locales.mjs --record-preview-source fr-FR`, replacing the locale as needed. Commit the catalog and source manifest together. The record acknowledges the source version used by that catalog. Linguistic review and complete interface coverage remain separate acceptance requirements. Recording another locale updates only that locale's source hashes.

## Links and evidence

Use relative links that work in the repository, exact command/API names and clear evidence boundaries. Keep raw errors, credentials, dumps, local reports and customer information outside Git. Reference maintained test entrypoints instead of embedding one operator's run log. Manual screen-reader review, native effects and recovery cannot be replaced by a documentation checker.

Update [the roadmap](roadmap.md) when a capability or acceptance boundary changes. A completed documentation pair does not make the product production-ready. Public release remains a separate maintainer decision governed by the [release guide](release.md).
