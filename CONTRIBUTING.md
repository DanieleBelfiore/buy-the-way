# Contributing to Buy The Way

Thank you for taking the time to contribute. This document covers commit conventions, branch naming, PR expectations, and code review standards.

---

## Getting started

1. Fork the repo and create your branch from `main`.
2. Run `pnpm install` to install dependencies.
3. Start the emulators + dev server (see [README.md](README.md#quickstart)).
4. Make your changes with tests.
5. Ensure all checks pass locally before opening a PR.

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:rules   # requires emulators running
```

---

## Branch naming

```
<type>/<short-description>
```

| Type | When to use |
|---|---|
| `feat/` | New feature or user-facing behaviour |
| `fix/` | Bug fix |
| `refactor/` | Code change with no behaviour change |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation only |
| `test/` | Tests only |

Examples: `feat/trash-view`, `fix/offline-banner-flicker`, `chore/update-firebase`.

---

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Rules:
- Imperative mood: "add offline banner" not "added offline banner"
- No period at end of subject line
- Subject line ≤ 72 characters
- Body explains *why*, not *what*

---

## Pull requests

- Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — it is pre-filled when you open a PR.
- Target branch: `main`.
- Keep PRs focused. One feature or fix per PR.
- All CI checks must be green before review is requested.
- Add or update tests for every behaviour change.
- Do not include unrelated formatting or refactoring in a feature PR.

### PR size guidelines

| Size | Lines changed | Notes |
|---|---|---|
| S | < 100 | Preferred |
| M | 100–400 | Fine |
| L | 400–800 | Split if possible |
| XL | > 800 | Requires justification |

---

## Code review expectations

- Reviews are expected within one working day for PRs marked `ready for review`.
- Address all `BLOCK` (critical) comments before merging.
- `WARN` (high) comments should be resolved or explicitly acknowledged.
- `NOTE` (low/style) comments are optional — the author decides.
- Approving a PR means you are comfortable shipping it.

---

## Design constraints

These constraints are fixed for v1 and must not be relaxed:

- **No dark mode** — single direction A (Editorial Cream) only
- **No Apple sign-in** — Google CTA only
- **No analytics** — not in v1 or v1.x
- **No error tracking** — deferred to v1.x
- **Trash auto-purge: NO** — soft-deleted lists persist indefinitely

---

## Running the full CI suite locally

```bash
# Start emulators in background
pnpm firebase:emulators &

# Wait a few seconds, then:
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:rules

# E2E (needs a built app)
pnpm build
pnpm test:e2e
```

---

## License

By contributing you agree that your contributions will be licensed under the project's MIT licence.
