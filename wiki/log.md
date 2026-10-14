# Wiki log

Append-only timeline. Newest entries at the bottom.

## [2026-05-28] bootstrap | Project docs wiki

- Created `wiki/`, `raw/`, `wiki/SCHEMA.md`, initial concept pages and source summaries.
- Ingested (read-only from live repo): `SPEC.md`, `README.md`, `.claude/docs/workflow.md`, `.claude/docs/vue.md`, `.claude/docs/firebase.md`.
- Pages touched: overview, all `concepts/*`, `sources/spec`, `sources/readme`, `sources/claude-docs`, `index.md`.
- Open: `CONTRIBUTING.md`, `firestore.rules`, and `tasks/plan.md` not yet summarized as source pages.

## [2026-06-07] sync | FCM removed, notifications now in-app inbox

- Trigger: docs described FCM Web Push, but code removed it (S4.1 -> S4.2 swap, per `netlify/functions/notify-list-event.ts` header). `push.service.ts`, `firebase-messaging-sw.js`, `pushEnabled`, `fcmTokens` all gone; only a harmless `messagingSenderId` config field remains.
- Pages touched: overview, concepts/data-model, concepts/auth-and-collaboration, concepts/ci-deploy, sources/spec.
- Also synced (outside wiki): `.claude/docs/firebase.md`, `README.md`, `SPEC.md` (user story, stack table, file tree, checklist; added a changelog entry recording the swap, kept the old strikethrough history).
- Notes: notifications are now an in-app inbox - `notify-list-event` writes one doc per recipient into `users/{uid}/notifications/{id}`, rendered in an anchored popover, FIFO-capped at 50/user, no browser permission / service worker.

## [2026-10-05] sync | History-based suggestions (wand)

- Trigger: new feature. `src/domain/suggest.ts` (`buildSuggestions`), `SuggestSheet.vue`, wand button in the `ListDetailView` header, new `addedVia` value `suggested` (rules + rules test).
- Pages touched: concepts/data-model (history now has a reader, new suggestions section, provenance table).
- Also synced (outside wiki): `SPEC.md` and `README.md` file trees.
- Notes: heuristic only, no AI or external service. History recording is unchanged; every recorded entry and item counts as bought.

## [2026-10-05] sync | Notifications switched off, favorites cap 60, suggest sheet restyle

- Trigger: owner request. `src/domain/features.ts` adds `FEATURES.notifications = false` (bell hidden in `ListsView`, `notifyListEvent` no-op, e2e spec skipped). `FAVORITES_MAX` raised 30 -> 60. `SuggestSheet` rows now use the favorites tile look, grouped by category with per-product icons.
- Pages touched: overview (notifications status), sources/spec (favorites cap).
- Also synced (outside wiki): `SPEC.md` favorites cap, `tasks/todo.md` backlog entry for removing notifications.
- Notes: notification code, rules and the Netlify function are still in the repo on purpose; only the switch changed.

## [2026-10-05] sync | UI polish pass on lists and list detail

- Trigger: owner-requested frontend review. List detail: stats strip now leads with a bought-progress bar (`stat-progress`) plus `bought/total`, item count and last-updated moved to a smaller second row next to the wand button; row action icons (priority, settings, remove) are muted gray, orange stays for urgent only; the empty-list footer button is neutral; the empty state offers "suggest a shop"; long list names wrap on two lines. Lists overview: logo shrinks once the account has lists; pin button is a 44px target. App version moved from the lists overview to the settings view.
- Pages touched: none beyond this log (no architecture or data change).
- Follow-up same day: item rows gained a check circle on the left (empty = to buy, filled = bought), list cards always show a count line ("Empty" when there are no items), and the header wand is hidden on an empty list because the empty state already offers the same action.
- Notes: red is now reserved for confirm dialogs. The double loading indicator (global overlay over skeleton cards) was seen only on the local emulator and is still to be checked on a real device.

## [2026-10-13] sync | Cold boot no longer waits on Firestore

- Trigger: owner report of a 1-3 s spinner on every open and on return from background (installed PWA, Android). Cause: up to five sequential Firestore round trips before the first view.
- Code: `auth.service.ts` (`onAuthChanged` backgrounds the profile sync on a restored session), `stores/auth.ts` (`cachedDefaultListId`), `router/index.ts` (guard reads the cache), `stores/lists.ts` (`lastSeenLoaded`), `ListsView.vue` (subscribe without awaiting the seen map).
- Pages touched: concepts/routing, concepts/offline-and-sync (new cold boot section), concepts/auth-and-collaboration, index.
- Also fixed in routing: `/` was documented as a redirect, it is the `home` route (LandingView).
- Notes: not yet measured on a real device.
- Follow-up same day: the `dotlottie` player (about 330 kB) was a static import of `ListsView`, `ListDetailView` and `CompletionCelebration`, so it was parsed on every boot although it only renders in empty states and the celebration. All three now use `src/components/ui/LazyDotLottie.ts` (`defineAsyncComponent`); the chunk stays in the service worker precache, so it still works offline.

## [2026-10-13] sync | Rules escalation closed, list delete no longer orphans data

- Trigger: whole-app review. Both issues reproduced on the Firestore emulator before the fix.
- Rules: the non-admin self-leave branch on `lists/{listId}` whitelisted `admins` without pinning its value, so a plain collaborator could leave, name themself sole admin in the same write, then take over or delete the list. `admins` is no longer writable from that branch. `leaveList` only sends `admins` when the leaver is an admin.
- `deleteList`: the list doc was deleted first, after which the rules (which read the parent list) denied every item read or delete, so items and history were orphaned on every delete and `favoriteState` was never purged at all. Order is now photos, items, history, favoriteState, list doc last; a failed purge rejects and keeps the list doc so the delete can be retried.
- Pages touched: none beyond this log.
- Notes: lists deleted before this change left orphan `items` / `history` / `favoriteState` docs in production; removing them needs a one-off admin script. `removeCollaborator` still sends `admins: arrayRemove(uid)` on legacy lists without an `admins` field.

## [2026-10-13] sync | Review follow-ups: invite claim, list validation, magic-link cap, functions typecheck, local Lottie WASM

- Rules: `isPendingInvitee` now requires `email_verified`. List updates run through `validListUpdateValues()` (type and size checks on changed fields only, so docs with older out-of-bounds values are not frozen; counters are not bounded below because they can drift).
- `send-magic-link`: second rate-limit bucket keyed by caller IP (`sendMagicLinkIp`, 10 per hour), checked before the per-recipient one. Unknown IP shares a single bucket.
- Typecheck: `pnpm typecheck` now also runs `tsc -p tsconfig.functions.json` over `netlify/`. It caught a missing `greeting` field on `BrandedEmailHtml`.
- Lottie: the WASM runtime is bundled from the installed `dotlottie-web` (alias `dotlottie-player-wasm`, resolved in `scripts/dotlottie-wasm-path.ts`) and set through `setWasmUrl` in `LazyDotLottie.ts`. `jsdelivr` and `unpkg` are gone from the CSP `connect-src`. `.wasm` and `.lottie` are runtime-cached (CacheFirst, cache `lottie-runtime`), not precached.
- Pages touched: none beyond this log.
- Open: `vue-tsc --noEmit` on the root tsconfig (`files: []`, references only) checks no files, so `src/` is not typechecked by `pnpm typecheck` or `pnpm build`. Running it with `-p tsconfig.app.json` reports 16 errors.
- Decision (owner, same day): the live item-count listeners per list (`stores/listItemCounts.ts`, review item I5) stay as they are. Exact, realtime counts on the overview are worth the extra item reads; do not re-raise this as a performance finding.

## [2026-10-13] sync | App typecheck made real

- Cause: `vue-tsc --noEmit` ran against the root `tsconfig.json` (`files: []`, references only) and therefore checked no files, in `pnpm typecheck`, `pnpm build` and CI alike.
- Fix: both scripts now pass `-p tsconfig.app.json`. Removed the deprecated `baseUrl` from that config (TS 6 reports it as an error; `paths` resolves without it).
- The 16 errors this surfaced are fixed: unused imports, missing `ULID` casts at string boundaries, Chart.js callback types in the two stats charts, a `vue-i18n` plural call in `FavoritesSheet`, two stale `@ts-expect-error` in the theme store.
- `domain/stats.ts` still reads `excluded` / `pinned`, which `CatalogEntry` no longer declares (they moved to the per-list favorite state). Typed locally as optional legacy flags; behaviour unchanged.
- Open: `tsconfig.node.json` (vite / vitest / playwright configs, scripts) is still not checked by any script; `playwright.config.ts` has one error there (`reducedMotion` is not a valid `use` option, so it is ignored).

## [2026-10-13] sync | Typecheck now covers tests, e2e and node-side configs

- `pnpm typecheck` = `vue-tsc -p tsconfig.tests.json` (src + tests + e2e) and `tsc -p tsconfig.node.json` (configs, scripts, netlify). The short-lived `tsconfig.functions.json` from earlier today is gone, superseded by the node project.
- Fixed 96 type errors across 22 unit test files. Mostly casts and helper signatures; a few were stale tests: priority values `high` / `low` that are not in the enum (now `urgent` / `optional`), an `addCollaborator` mock with the wrong result shape in `ListSettingsView.test.ts`.
- `playwright.config.ts`: `reducedMotion` moved under `use.contextOptions`. Directly under `use` it is not a known key and was silently ignored, so e2e never ran with reduced motion.
- Pages touched: concepts/testing.
- Notes: e2e not re-run locally after the Playwright change (browser binary not installed on the dev machine).


## [2026-10-14] ingest | Domain move to buytheway.app, MCP server phases M1-M2

- Source: `.claude/docs/firebase.md` (new "Domain moves" note, auth domain now `buytheway.app`), `tasks/domain-migration.md`, `tasks/mcp-plan.md`.
- The site moves from `buy-the-way.danielebelfiore.dev` to `buytheway.app`. The old host 301-redirects (path and query kept) and serves `public/sw-retire.js` as `/sw.js` so installed PWAs unregister and follow the redirect.
- MCP server in progress: M1 (services runnable in Node via `netlify/mcp/firebase-node.ts`, `pnpm test:mcp`) and M2 (OAuth 2.1 authorization server in `netlify/functions/oauth-*`, consent screen `/oauth/authorize`, private-beta gate `config/mcp`).
- Pages touched: none yet. A concept page for the MCP server is planned with M4, once the tool surface is final.
- Notes: Firestore collections `oauthClients`, `oauthCodes`, `oauthTokens`, `oauthGrants`, `config` are new and not yet in concepts/data-model.
