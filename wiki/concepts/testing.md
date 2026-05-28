---
type: concept
tags: [testing, vitest, playwright]
sources: 2
updated: 2026-05-28
---

# Testing

## Unit / component (Vitest)

- Command: `pnpm test:run`, coverage: `pnpm test:coverage`
- Gate: **≥80%** all files; **zero** `[Vue warn]`, `[auth]`, or unhandled errors in stderr
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

## Related

- [CI and deploy](ci-deploy.md)
- Agent rules: `.claude/docs/vue.md`, `.claude/docs/workflow.md`
