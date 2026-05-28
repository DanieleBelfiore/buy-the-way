# buy-the-way - Project-Specific Setup

Stack: Vue 3 + Pinia + Vue Router + Vitest + Firebase/Firestore.

## Active docs (self-contained in repo)

@.claude/docs/workflow.md
@.claude/docs/vue.md
@.claude/docs/firebase.md

## Project wiki (LLM-maintained synthesis)

@wiki/SCHEMA.md

Compiled knowledge lives under `wiki/` (overview, concepts, source summaries). Immutable ingests go under `raw/`. **Agent how-to rules stay in `.claude/docs/`** - re-ingest into the wiki when specs or architecture change.

## Project conventions

- Package manager: `pnpm`
- Coverage gate: `pnpm test:coverage` (≥ 80% all files, zero `[Vue warn]` / `[auth]` / unhandled-error lines in stderr)
- Firestore rules live at `firebase/firestore.rules`
- Test setup file: `tests/setup.ts` (contains Node 26 localStorage polyfill - do not remove)
- **NEVER use the em-dash character `—` (U+2014) anywhere in the repo.** This
  includes source, tests, i18n strings, comments, docs, commit messages, PR
  bodies, and any new file. Use a plain ASCII hyphen `-` (with surrounding
  spaces if needed), a colon `:`, or split the sentence. Existing em-dashes
  have been swept once; reintroducing one is a workflow failure. Quick
  check before any commit: `grep -r "—" --include="*.{ts,vue,json,md,yml,toml,html,css}" . | grep -v node_modules | grep -v /dist/ | grep -v /coverage/` must return empty.

## Source of truth

Docs under `.claude/docs/` are the source of truth for this repo. The global copies at `~/.claude/docs/` may exist on the maintainer's machine but are NOT authoritative - edit the repo copy and commit. Global docs are only seeds for new projects.
