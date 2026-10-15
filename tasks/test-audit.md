# Test audit (2026-10-15)

**Done 2026-10-15.** Unit tests 1588 -> 510 (60 files); rules 120, MCP integration 32, E2E 22 unchanged. Coverage after: 41.7% statements, 31.1% branches (report only).

Policy: `CLAUDE.md`, "Testing policy". Keep tests that protect critical paths: rules, data integrity, account deletion, OAuth / MCP security, domain logic with real edge cases, real regressions. Drop tests of markup, styling, copy, icons, button order, trivial wiring, thin wrappers around a mocked SDK.

Today: 1588 unit tests + 116 rules + 32 MCP integration + 22 E2E. Estimated after: about 600 unit tests; rules, MCP and E2E unchanged.

Legend: **Keep** as is, **Trim** keep only the listed behaviours, **Delete** the whole file.

## Keep untouched (emulator and browser)

| Area | Tests | Why |
|---|---|---|
| `tests/rules/` | 116 | Only real protection of the data |
| `tests/mcp-integration/` | 32 | OAuth / MCP security, real Firestore |
| `e2e/` | 22 | Real user flows |

## Unit tests

### `components/` (33 files, 382 tests): Delete all

Every file asserts rendering, emitted events, classes, icons or aria labels. Breakage there is visible at first use; the logic worth testing lives in `domain/` and services.

### `views/` (11 files, 166 tests)

| File | Tests | Action |
|---|---|---|
| `OAuthAuthorizeView` | 9 | **Keep**: never follows a redirect returned by describe (open-redirect guard) |
| `EmailLinkCallbackView` | 6 | **Keep**: magic-link sign-in |
| `LoginView` | 12 | **Trim** to return-after-login (OAuth consent), ~3 |
| `SettingsView` | 28 | **Trim** to the delete-account flow (re-auth before wiping, partial deletion), ~6 |
| `ListsView` | 55 | **Trim** to live counts and default-list redirect, ~8 |
| `ListDetailView`, `ListSettingsView`, `StatsView`, `AboutView`, `LandingView`, `LegalViews` | 56 | **Delete** (UI; permissions are enforced by the rules) |

### `composables/` (20 files, 167 tests)

| File | Tests | Action |
|---|---|---|
| `useListDetailActions` | 40 | **Trim** to empty list + history snapshot, bulk delete, undo, ~12 |
| `useUndoDelete` | 7 | **Keep**: deletes must really commit or roll back |
| All the others (focus trap, haptics, fit text, share, speech, modal back, debounce...) | 120 | **Delete** |

### `stores/` (7 files, 124 tests)

| File | Tests | Action |
|---|---|---|
| `listItemCounts` | 9 | **Keep**: the counts that replaced the drifting fields |
| `auth` | 27 | **Trim** to boot / redirect result / default list, ~8 |
| `lists`, `items`, `catalog` | 64 | **Trim** to subscription lifecycle and pending deletes, ~15 |
| `theme`, `listFavorites` | 24 | **Delete** |

### `services/` (16 files, 323 tests)

Most of these assert calls on a mocked Firestore; the rules and MCP integration suites test the same code for real.

| File | Tests | Action |
|---|---|---|
| `deleteAccount` | 14 | **Keep** |
| `lists.collab` | 24 | **Keep**: leave, transfer ownership, admins |
| `history.service` | 13 | **Keep**: snapshot and pruning to 50 |
| `items.service` | 81 | **Trim** to batch chunking (500-op cap), move/copy atomicity, empty list, ~15 |
| `lists.service` | 49 | **Trim** to duplicate names, delete cascade, ~10 |
| `auth.service` | 32 | **Trim** to PWA redirect sign-in, re-auth, ~8 |
| `users.service` | 35 | **Trim** to pending-invite claim and private-state migration, ~8 |
| `export.service` | 7 | **Trim** to "export contains every user collection", ~2 |
| `connectedApps.service` | 9 | **Trim** to `revokeAllConnectedApps`, ~3 |
| `catalog`, `listFavorites`, `notifications`, `notify`, `invites`, `itemPhotos`, `oauth` | 59 | **Delete** |

### `netlify/` (19 files, 127 tests): Keep almost all

Server code exposed to the internet: OAuth, rate limits, user lookup, emails, redirects, firebase-admin contract.

| File | Tests | Action |
|---|---|---|
| `http`, `firebase-admin` | 3 | **Delete** (covered by the contract test and the endpoints) |
| `oauth-revoke-grant` | 8 | **Trim** to auth, ownership, bad body, ~4 |
| Everything else | 116 | **Keep** |

### Other folders

| File | Tests | Action |
|---|---|---|
| `domain/*` | 144 | **Keep**, except `features`, `priority`, `wallpapers` (10): **Delete** |
| `router/guard` | 17 | **Trim** to auth gating and returnTo, ~8 |
| `pwa/manifest` | 11 | **Trim** to the navigateFallback denylist (`/mcp`, `/oauth/*`, `/__/`), ~3 |
| `pwa/serviceWorkerUpdates`, `pwa/sw-retire` | 5 | **Keep** |
| `pwa/installPrompt` | 18 | **Delete** |
| `i18n/locale` | 7 | **Trim** to it/en key parity, ~2 |
| `i18n/resolveLocale` | 9 | **Trim**, ~3 |
| `scripts/drop-list-counters` | 7 | **Keep** (writes to production) |
| `scripts/report-*` | 16 | **Trim** to HTML escaping of user data, ~4 |
| `firebase/rules-parity`, `firebase/indices` | 2 | **Keep** |
| `placeholder.test.ts` | 1 | **Delete** |

## After the cleanup

- `pnpm test:coverage` keeps running in CI; the badge will drop (no threshold, by choice).
- Test hygiene rules in `.claude/docs/vue.md` stay valid for the component tests that remain.
