---
type: concept
tags: [testing, vitest, playwright]
sources: 2
updated: 2026-10-15
---

# Testing

## Unit / component (Vitest)

- Command: `pnpm test:run`, coverage: `pnpm test:coverage`
- Gate: exit 0 and **zero** `[Vue warn]`, `[auth]`, or unhandled errors in stderr. Coverage is a report, no threshold (dropped 2026-10-15).
- Scope: critical paths only (rules, data integrity, account deletion, OAuth / MCP security, domain edge cases, real regressions). No tests for markup, styling, copy or trivial wiring; TDD not required. Source: `CLAUDE.md` "Testing policy".
- Setup: `tests/setup.ts` - **Node 26 localStorage polyfill** (do not remove)
- Vue hygiene: fake timers for debounced composables, `router.push` + `isReady` before mount, `@click` on autocomplete options for tests - see [claude-docs](../sources/claude-docs.md) (vue.md)

## Firestore rules

- `pnpm test:rules` (emulators required)
- Mocked Firestore in unit tests **does not** validate rules - emulator/rules tests required for new collections

## E2E (Playwright)

- Specs under `e2e/`; emulator helpers in `e2e/helpers/`
- CI: optional job gated by `vars.E2E_ENABLED` - see [ci-deploy](ci-deploy.md)

## Lint / types

`pnpm lint`, `pnpm typecheck` before PR (CONTRIBUTING).

`pnpm typecheck` runs two projects, and always with an explicit `-p`:

- `vue-tsc -p tsconfig.tests.json`: `src/`, `tests/` and `e2e/` (extends `tsconfig.app.json`).
- `tsc -p tsconfig.node.json`: Vite / Vitest / Playwright configs, `scripts/` and `netlify/`.

Never run a bare `vue-tsc --noEmit`: the root `tsconfig.json` has `files: []` and only references, so it checks nothing and exits 0. That is how the app, the tests and the functions went unchecked until 2026-10-13. `pnpm build` uses `tsconfig.app.json` (sources only).

## Related

- [CI and deploy](ci-deploy.md)
- Agent rules: `.claude/docs/vue.md`, `.claude/docs/workflow.md`
