# buy-the-way — Project-Specific Setup

Stack: Vue 3 + Pinia + Vue Router + Vitest + Firebase/Firestore.

## Active docs (self-contained in repo)

@.claude/docs/workflow.md
@.claude/docs/vue.md
@.claude/docs/firebase.md

## Project conventions

- Package manager: `pnpm`
- Coverage gate: `pnpm test:coverage` (≥ 80% all files, zero `[Vue warn]` / `[auth]` / unhandled-error lines in stderr)
- Firestore rules live at `firebase/firestore.rules`
- Test setup file: `tests/setup.ts` (contains Node 26 localStorage polyfill — do not remove)

## Source of truth

Docs under `.claude/docs/` are the source of truth for this repo. The global copies at `~/.claude/docs/` may exist on the maintainer's machine but are NOT authoritative — edit the repo copy and commit. Global docs are only seeds for new projects.
