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
- Test gate: `pnpm test:coverage` must exit 0 with zero `[Vue warn]` / `[auth]` / unhandled-error lines in stderr. Coverage is a report, not a gate (no thresholds).
- **Testing policy (overrides the global "TDD default" rule):** Tests cover the critical paths only: Firestore / Storage rules, data integrity of list and item writes, account deletion, OAuth / MCP security, domain logic with real edge cases, and regressions of real production bugs. No tests for CSS classes, icons, button order, copy, trivial wiring or thin wrappers around a mocked SDK. Prefer one emulator test over many mocked unit tests. TDD is not required: write the test after the code when that is simpler.
- Firestore rules live at `firebase/firestore.rules`
- Test setup file: `tests/setup.ts` (contains Node 26 localStorage polyfill - do not remove)
- **NEVER use the em-dash character (U+2014) anywhere in the repo.** This
  includes source, tests, i18n strings, comments, docs, commit messages, PR
  bodies, and any new file. Use a plain ASCII hyphen `-` (with surrounding
  spaces if needed), a colon `:`, or split the sentence. Existing em-dashes
  have been swept once; reintroducing one is a workflow failure. Quick
  check before any commit: `grep -rIn $'\xe2\x80\x94' . --exclude-dir={node_modules,.git,dist,dev-dist,coverage}` must return empty
  (the byte pattern matches the character without containing it).

## Source of truth

Docs under `.claude/docs/` are the source of truth for this repo. The global copies at `~/.claude/docs/` may exist on the maintainer's machine but are NOT authoritative - edit the repo copy and commit. Global docs are only seeds for new projects.
