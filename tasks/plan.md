# Implementation Plan: Buy The Way

## Overview

Mobile-first PWA for real-time shared shopping lists. Stack: Vue 3 + TS + Pinia + Firebase (Auth + Firestore) + Vite + vite-plugin-pwa. UI direction: Editorial Cream (single canonical look, no dark mode, no Apple sign-in).

Plan is **vertically sliced**: each phase after Phase 0 ships one complete user-visible capability (auth → list home → list detail → shelf → collaborators → settings → PWA → ship). Foundation (Phase 0) is bottom-up because nothing else can stand without it.

## Architecture Decisions

- **Firestore data model**: `lists/{listId}` with `ownerUid: string` and `collaboratorUids: string[]`; items as subcollection `lists/{listId}/items/{itemId}`; per-user `catalog/{ownerUid}/entries/{entryId}`; global `users/{uid}` (uid, email lowercased, displayName, lastLoginAt) populated on auth.
- **IDs**: ULID via `newId()`; never raw timestamps or non-ordered random.
- **Last-write-wins**: every mutation updates `updatedAt`; conflict resolution is the latest `updatedAt` per item. No CRDT.
- **Favorites ranking**: `domain/ranking.ts` exposes `FAVORITES_MIN_USES = 2`, `FAVORITES_HALF_LIFE_DAYS = 30`, `FAVORITES_MAX = 30`. `CatalogEntry` carries optional `pinned` and `excluded` flags. `excluded` never surfaces; `pinned` always surfaces and is not counted against the cap; the rest must meet the minimum usage to appear, then are sorted by recency-weighted score and clipped at `FAVORITES_MAX - pinned.length`.
- **Hard delete**: list deletion from List Settings is immediate and irreversible — purges all items in batched writes then deletes the list doc. No soft-delete, no trash, no recovery (Phase 6 cancelled).
- **Service boundary**: components/stores never touch Firestore SDK directly; only `services/*.service.ts` do.
- **Offline**: rely on Firestore SDK persistence (IndexedDB); SW caches static shell only.
- **Realtime**: `onSnapshot` subscriptions wrapped via `useFirestoreCollection` composable.
- **i18n**: `vue-i18n` Composition API, `legacy: false`; every UI string in `i18n/locales/{it,en}.json`.
- **Auth guard**: router beforeEach blocks all routes except `/login` until `onAuthStateChanged` fires with a user.
- **Style isolation**: design tokens live in `styles/tokens.css` as CSS custom properties; Tailwind theme bridges to them. No new hex codes outside the canonical palette.
- **Firestore rules per task**: whenever a task introduces a new Firestore collection or subcollection, `firebase/firestore.rules` must be updated in that same task — never deferred. Default-deny means missing rules cause silent failures at runtime.
- **View self-containment**: any view reachable via direct URL (e.g. `/lists/:id`) must subscribe to all required stores in its own `onMounted`. Never assume a parent view has already run and populated shared state.

## Invariants (enforced at every checkpoint)

Run these before marking a checkpoint complete — do not wait for user to ask:

```bash
pnpm test:coverage   # must exit 0; ≥ 80% on all files; zero stderr warnings
pnpm typecheck       # must exit 0
pnpm build           # must exit 0
```

If `pnpm test:coverage` produces any `[Vue warn]`, `[auth]`, or Vitest unhandled-error lines in stderr, treat them as failures and fix before proceeding.

## Checkpoint recap protocol

At the end of every phase/checkpoint, before asking for human approval, the agent MUST emit a **Human Verification Recap** with:

1. **Automated gates run** — list each command + result (tests count, coverage %, build status, lint).
2. **What the human must check manually** — bullet list of UI/UX/device/browser/Lighthouse/E2E items not covered by automated gates, with exact steps (URL, viewport, action) and expected outcome.
3. **Files changed** — clickable list grouped by purpose.
4. **Pending / deferred** — anything blocked by external action (Lighthouse, install test, E2E spec in later phase).
5. **Commit plan** — proposed commit messages, one per task, awaiting `I authorize this commit`.

Recap is non-optional. No "phase done" message without it.

## Phase 0 — Foundation

Bottom-up. No user-visible value yet. Required by every later slice.

### Task 1 — Project scaffold

**Description:** Init Vite + Vue 3 + TS strict + Pinia + vue-router + Tailwind + Vitest + Playwright + ESLint + Prettier. pnpm package manager. Configure `@/` alias to `src/`.

**Acceptance criteria:**
- [ ] `pnpm dev` boots Vite on 5173 with a blank `App.vue` rendering "Buy The Way".
- [ ] `pnpm typecheck` passes (`vue-tsc --noEmit`, strict).
- [ ] `pnpm lint` passes on a clean repo.
- [ ] `pnpm test:run` runs and reports 0 tests.
- [ ] `pnpm build` produces `dist/` with no errors.

**Verification:**
- [ ] `pnpm dev` opens 5173 and shows the placeholder.
- [ ] `pnpm build && pnpm preview` shows the same.

**Dependencies:** None.

**Files likely touched:** `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `src/main.ts`, `src/App.vue`.

**Estimated scope:** M (5 files+config)

---

### Task 2 — Design tokens + Tailwind bridge

**Description:** Encode the Editorial Cream palette as CSS custom properties in `styles/tokens.css`, bridge to Tailwind theme. Add Hanken Grotesk via `index.html` `<link>` (weights 400/500/600). Add base reset in `styles/global.css`.

**Acceptance criteria:**
- [ ] CSS vars: `--cream`, `--cream-soft`, `--offwhite`, `--charcoal`, `--muted-gray`, `--ring-blue`, `--ink-04/03/40/82/83/100`, all nine `--cat-*` hues.
- [ ] Tailwind config exposes `bg-cream`, `text-charcoal`, `border-cream-soft`, etc.
- [ ] Hanken Grotesk loaded; `body { font-family: 'Hanken Grotesk', ... }`.
- [ ] No hex codes outside the canonical palette anywhere under `src/`.

**Verification:**
- [ ] A test page using `bg-cream text-charcoal` renders the cream surface in browser at 375 px.
- [ ] `grep -rE '#[0-9a-fA-F]{3,6}' src/styles` returns only canonical tokens.

**Dependencies:** Task 1.

**Files likely touched:** `src/styles/tokens.css`, `src/styles/global.css`, `tailwind.config.ts`, `index.html`, `src/main.ts`.

**Estimated scope:** S

---

### Task 3 — Domain layer (types, id, categories, ranking)

**Description:** Pure logic, no I/O. `domain/id.ts` (ULID branded type). `domain/types.ts` (List, Item, User, CatalogEntry, Category, Locale). `domain/categories.ts` (enum + label keys). `domain/ranking.ts` (recency-weighted score: `usageCount * exp(-age/halfLifeDays)`; halfLife = 14 days). 100% unit-test coverage.

**Acceptance criteria:**
- [ ] All types in SPEC.md section "Code Style" exported.
- [ ] `newId()` returns 26-char ULID; types it as `ULID` brand.
- [ ] `rankCatalog(entries, now)` returns entries sorted descending; ties broken by `lastUsedAt` desc.
- [ ] Ranking handles edge cases: empty array, single entry, all-zero usage, very old entries (score → 0).
- [ ] 100% coverage on `domain/`.

**Verification:**
- [ ] `pnpm test:run -- tests/unit/domain` green.
- [ ] `pnpm test:coverage` shows 100% on `src/domain/`.

**Dependencies:** Task 1.

**Files likely touched:** `src/domain/id.ts`, `src/domain/types.ts`, `src/domain/categories.ts`, `src/domain/ranking.ts`, `tests/unit/domain/id.test.ts`, `tests/unit/domain/ranking.test.ts`, `tests/unit/domain/categories.test.ts`.

**Estimated scope:** M

---

### Task 4 — i18n setup (it/en)

**Description:** Install `vue-i18n@10`, configure with `legacy: false`, `globalInjection: true`. Locale files in `i18n/locales/{it,en}.json`. Default locale = browser language; fallback `en`. Persisted in `localStorage.locale`.

**Acceptance criteria:**
- [ ] `useI18n()` returns a working `t()` in any component.
- [ ] `{{ t('app.name') }}` renders "Buy The Way" / "Buy The Way" (same brand mark, but tagline differs by locale).
- [ ] Switching `locale.value` toggles the page string instantly.
- [ ] `localStorage.locale = 'it'` causes IT to load on reload.

**Verification:**
- [ ] Unit test: setting `i18n.global.locale.value = 'en'` returns the EN translation for a known key.
- [ ] Manual: change locale in console, page text updates without reload.

**Dependencies:** Task 1.

**Files likely touched:** `src/i18n/index.ts`, `src/i18n/locales/it.json`, `src/i18n/locales/en.json`, `src/main.ts`, `tests/unit/i18n/locale.test.ts`.

**Estimated scope:** S

---

### Task 5 — Firebase init + emulator config

**Description:** `services/firebase.ts` exports `app`, `auth`, `db`. Read config from `import.meta.env.VITE_FIREBASE_*`. In dev (`import.meta.env.DEV`), connect to Auth emulator (9099) and Firestore emulator (8080). Add `firebase.json`, `.firebaserc`, `firestore.rules` (default-deny stub), `firestore.indexes.json` (empty). Add `pnpm firebase:emulators` script.

**Acceptance criteria:**
- [ ] `pnpm firebase:emulators` boots Auth + Firestore emulator on the documented ports.
- [ ] Dev app connects to emulators automatically.
- [ ] `firestore.rules` default-denies all reads/writes initially.
- [ ] `.env.example` documents required `VITE_FIREBASE_*` vars; real keys never committed.

**Verification:**
- [ ] Browser console shows "Firestore: Using emulator at localhost:8080" in dev.
- [ ] An unauthenticated read from console fails with `permission-denied`.

**Dependencies:** Task 1.

**Files likely touched:** `src/services/firebase.ts`, `firebase.json`, `.firebaserc`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `.env.example`, `package.json`.

**Estimated scope:** M

---

### Task 6 — Router + auth guard stub

**Description:** vue-router 4 with routes for all 7 views (lazy-loaded). `beforeEach` guard redirects unauthenticated users to `/login`. Auth state read from a placeholder `useAuth()` composable that returns `{ user: ref(null), ready: ref(true) }` until Task 8 wires it.

**Acceptance criteria:**
- [ ] Visiting `/` while unauthenticated redirects to `/login`.
- [ ] Visiting `/login` is allowed regardless of auth.
- [ ] All route components lazy-loaded (`() => import(...)`).
- [ ] Guard waits for `ready.value === true` before deciding.

**Verification:**
- [ ] Unit test on guard: ready=false → no redirect; ready=true + user=null → redirect to /login; user!=null → allow.
- [ ] Manual: visiting `/lists` shows /login.

**Dependencies:** Tasks 1, 3.

**Files likely touched:** `src/router/index.ts`, `src/composables/useAuth.ts` (stub), `src/views/LoginView.vue` (stub), 6 more stub views, `tests/unit/router/guard.test.ts`.

**Estimated scope:** M

---

### Checkpoint A — Foundation

- [ ] `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build` all green.
- [ ] Dev server boots; root redirects to `/login`; placeholder login renders.
- [ ] Emulators boot via `pnpm firebase:emulators`.
- [ ] Domain coverage = 100%.
- [ ] **Human approval before Phase 1.**

---

## Phase 1 — Vertical Slice: Sign in + Lists Home

User story: open app → sign in with Google → see my (empty) home → create a list → see it on home.

### Task 7 — Auth service + users upsert

**Description:** `services/auth.service.ts` exports `signInWithGoogle()`, `signOutCurrent()`, `onAuthStateChanged()` wrapper. On every successful sign-in (and on `onAuthStateChanged` rehydrate), upsert `users/{uid}` with `{ uid, email: lowercase+trim, displayName, lastLoginAt: Date.now() }`. Errors propagate; never swallow.

**Acceptance criteria:**
- [ ] `signInWithGoogle()` opens the Google popup (or emulator's mock chooser).
- [ ] After sign-in, `users/{uid}` document exists with normalized email.
- [ ] Re-sign-in updates `lastLoginAt` but does not duplicate the doc.
- [ ] Rules allow only the authenticated user to write their own `users/{uid}` doc (rule added in Task 27 — for now permissive in dev).

**Verification:**
- [ ] Integration test against emulator: sign-in (mocked) creates `users/{uid}` with lowercase email.
- [ ] Manual: emulator UI shows the user doc post-login.

**Dependencies:** Tasks 5, 6.

**Files likely touched:** `src/services/auth.service.ts`, `src/composables/useAuth.ts` (real impl now), `tests/unit/services/auth.int.test.ts`.

**Estimated scope:** M

---

### Task 8 — Auth Pinia store + guard wiring

**Description:** `stores/auth.ts` exposes `{ user, ready, signIn(), signOut() }`. Initialize subscription in `main.ts` so guard's `ready` becomes true after first auth event. Replace router stub with real composable.

**Acceptance criteria:**
- [ ] After app boot, `ready` flips to `true` within 1s.
- [ ] `signIn()` populates `user`; `signOut()` clears it and redirects to `/login`.
- [ ] Guard redirects unauthenticated → `/login`; authenticated visiting `/login` → `/lists`.

**Verification:**
- [ ] Unit test on store: simulating `onAuthStateChanged` callback updates state.
- [ ] Manual: log in → land on `/lists`; log out → land on `/login`.

**Dependencies:** Task 7.

**Files likely touched:** `src/stores/auth.ts`, `src/main.ts`, `src/router/index.ts`, `tests/unit/stores/auth.test.ts`.

**Estimated scope:** S

---

### Task 9 — LoginView

**Description:** Editorial Cream login screen. Wordmark + tagline + single primary CTA "Continua con Google" / "Continue with Google" (charcoal fill, offwhite text). Loading + error states. No email/password, no Apple button.

**Acceptance criteria:**
- [ ] CTA triggers `auth.signIn()`.
- [ ] During sign-in, button shows a spinner and is disabled.
- [ ] On error, an inline message in `--muted-gray` appears below.
- [ ] All strings via `t()`.

**Verification:**
- [ ] Unit test: click CTA invokes store's `signIn()`.
- [ ] Manual at 375 px: layout per design (centered, no decoration).

**Dependencies:** Tasks 2, 4, 8.

**Files likely touched:** `src/views/LoginView.vue`, `src/components/ui/Button.vue`, `src/i18n/locales/{it,en}.json`.

**Estimated scope:** S

---

### Task 10 — lists.service: createList + subscribeUserLists

**Description:** `services/lists.service.ts` exports `createList(name, ownerUid)` (returns `ULID`), `subscribeUserLists(uid, onChange, onError)` returns unsubscribe. Query filters out `deletedAt != null`. New list has `ownerUid`, `collaboratorUids: [ownerUid]`, `deletedAt: null`, `createdAt = updatedAt = Date.now()`.

**Acceptance criteria:**
- [ ] `createList` writes a valid `List` doc to `lists/{id}`.
- [ ] `subscribeUserLists(uid)` returns all lists where `ownerUid == uid` OR `uid in collaboratorUids`, sorted by `updatedAt` desc.
- [ ] Soft-deleted lists are excluded.
- [ ] Errors propagate to `onError`.

**Verification:**
- [ ] Integration test against emulator: create 3 lists, subscription emits 3, soft-delete one → emits 2.

**Dependencies:** Tasks 3, 5.

**Files likely touched:** `src/services/lists.service.ts`, `firebase/firestore.indexes.json` (composite on `collaboratorUids` + `updatedAt`), `tests/unit/services/lists.int.test.ts`.

**Estimated scope:** M

---

### Task 11 — Lists Pinia store + ListsView

**Description:** `stores/lists.ts` subscribes via service when `auth.user` is set; exposes `lists`, `loading`, `error`, `createList(name)`. `ListsView` renders a header (wordmark + avatar), a list of `ListCard` components, a FAB ("+") that opens an inline create-list field. Empty state when 0 lists.

**Acceptance criteria:**
- [ ] After login, home shows "no lists yet" empty state for a fresh user.
- [ ] Tapping FAB reveals an input; submitting calls `createList`.
- [ ] New list appears immediately at the top.
- [ ] Tapping a list card navigates to `/lists/:id`.

**Verification:**
- [ ] E2E (golden path): login → create list "Spesa" → card visible → reload → still visible.
- [ ] A11y: FAB has aria-label; input has aria-label.

**Dependencies:** Tasks 8, 10.

**Files likely touched:** `src/stores/lists.ts`, `src/views/ListsView.vue`, `src/components/list/ListCard.vue`, `src/components/ui/FAB.vue`, `e2e/list-crud.spec.ts` (partial).

**Estimated scope:** M

---

### Checkpoint B — Auth + Home

- [ ] Lint + typecheck + test:run + build green.
- [ ] E2E `list-crud.spec.ts`: login + create + reload all pass.
- [ ] Coverage ≥ 80% on touched files.
- [ ] **Human approval before Phase 2.**

---

## Phase 2 — Vertical Slice: List Detail (items CRUD)

User story: open a list → add items via autocomplete → see them grouped by category → check/uncheck.

### Task 12 — items.service + catalog write-through

**Description:** `services/items.service.ts`: `subscribeItems`, `addItem`, `toggleChecked`, `removeItem`. Each `addItem` also bumps the per-user catalog entry (insert or `usageCount += 1`, `lastUsedAt = now`).

**Acceptance criteria:**
- [ ] `addItem` writes `lists/{listId}/items/{itemId}` with all fields including `updatedAt`.
- [ ] `toggleChecked` patches only `checked` + `updatedAt`.
- [ ] `removeItem` deletes the doc (hard delete on items; soft delete is list-level only).
- [ ] After `addItem`, `catalog/{uid}/entries` contains a matching entry; second call increments `usageCount`.

**Verification:**
- [ ] Integration: add same item twice → entry `usageCount == 2`.
- [ ] Realtime: two subscribers see the same emission within 1s.

**Dependencies:** Tasks 3, 5, 10.

**Files likely touched:** `src/services/items.service.ts`, `src/services/catalog.service.ts` (partial), `tests/unit/services/items.int.test.ts`.

**Estimated scope:** M

---

### Task 13 — Items store + realtime subscription

**Description:** `stores/items.ts` subscribes to items of current list. Switching list id resubscribes. Groups items by category for the view.

**Acceptance criteria:**
- [ ] On `setCurrentList(id)`, store subscribes and unsubscribes the previous one.
- [ ] `itemsByCategory` getter returns a map sorted by category order from `domain/categories.ts`.
- [ ] Within a category, items sorted: unchecked first (createdAt asc), then checked (createdAt asc).

**Verification:**
- [ ] Unit test on `itemsByCategory` with fixtures.
- [ ] Manual: add 3 items in different categories → sections appear in canonical order.

**Dependencies:** Task 12.

**Files likely touched:** `src/stores/items.ts`, `src/composables/useFirestoreCollection.ts`, `tests/unit/stores/items.test.ts`.

**Estimated scope:** M

---

### Task 14 — CategoryHeader + ListItemRow + CategorySection

**Description:** Atoms for list rendering. `CategoryIcon` colored by `--cat-*` token. `ListItemRow` shows name + quantity; tap toggles checked (strikethrough + dimmed). `CategorySection` wraps a category header + its item rows.

**Acceptance criteria:**
- [ ] Checked items render with `--ink-40` text + strikethrough.
- [ ] Icons render at 14 px stroke, colored from the category hue.
- [ ] Tap target ≥ 44×44 px.
- [ ] All strings via `t()`.

**Verification:**
- [ ] Unit test on `ListItemRow`: click emits `toggleChecked` with negated bool.
- [ ] A11y: each row has aria-label "mark as bought" / "mark as to buy" depending on state.

**Dependencies:** Tasks 2, 3, 4.

**Files likely touched:** `src/components/list/CategoryIcon.vue`, `src/components/list/CategoryHeader.vue`, `src/components/list/CategorySection.vue`, `src/components/list/ListItemRow.vue`.

**Estimated scope:** M

---

### Task 15 — ItemAutocomplete

**Description:** Input + dropdown of suggestions from catalog (matched by `name startsWith`, case-insensitive). Keyboard nav (↑/↓/Enter/Esc). ARIA combobox. Debounced 120 ms. If no match → "Add as custom item" pinned at the bottom.

**Acceptance criteria:**
- [ ] Typing "lat" surfaces "Latte" if in catalog.
- [ ] ↑/↓ moves selection; Enter commits; Esc closes.
- [ ] Custom-item branch creates a new catalog entry on first use.
- [ ] aria-activedescendant correctly tracks highlighted option.

**Verification:**
- [ ] Unit test on keyboard nav + commit.
- [ ] E2E: type query → pick suggestion → item appears in list.

**Dependencies:** Tasks 4, 12, 13, 14.

**Files likely touched:** `src/components/list/ItemAutocomplete.vue`, `src/composables/useDebouncedRef.ts`, `src/stores/catalog.ts`, `src/services/catalog.service.ts`.

**Estimated scope:** L (justified — coordinated input + store + service)

---

### Task 16 — ListDetailView assembly

**Description:** Wire the list-detail screen: back button, list name, autocomplete on top, category sections below, dashed hairline + `EmptyListButton` placeholder (full impl in Phase 4).

**Acceptance criteria:**
- [ ] Opens via `/lists/:id` from a card.
- [ ] Switching back navigates to `/lists`.
- [ ] Subscribes/unsubscribes items on mount/unmount.
- [ ] Empty list shows the "Empty list" state from i18n.

**Verification:**
- [ ] E2E: open list → add 2 items → check one → reload → state preserved.

**Dependencies:** Tasks 13, 14, 15.

**Files likely touched:** `src/views/ListDetailView.vue`.

**Estimated scope:** S

---

### Checkpoint C — Items working end-to-end

- [ ] E2E `list-crud.spec.ts` covers create-list → open → add → check → reload.
- [ ] Realtime: two browser contexts converge in < 1s on a list edit.
- [ ] Coverage ≥ 80% project-wide.
- [ ] **Human approval before Phase 3.**

---

## Phase 3 — Vertical Slice: MostUsedShelf ("Lo Scaffale")

User story: I see my recurring items as a dense always-visible 2-column grid; one tap re-adds to current list.

### Task 17 — Catalog ranking subscription

**Description:** `services/catalog.service.ts` exports `subscribeCatalog(ownerUid, onChange)`. Store applies `rankCatalog(entries, Date.now())` from `domain/ranking.ts` to derive ordered list. Capped at 24 visible entries.

**Acceptance criteria:**
- [ ] Adding an item updates catalog reactively (write-through from Task 12).
- [ ] `rankedCatalog` reflects recency-weighted order live.
- [ ] First two entries flagged as "top" for the editorial accent.

**Verification:**
- [ ] Unit test: simulated entries with varying age + count produce the expected ordering.
- [ ] Integration: bump usage 5x on entry X → moves to top.

**Dependencies:** Tasks 3, 12, 13.

**Files likely touched:** `src/services/catalog.service.ts`, `src/stores/catalog.ts`, `tests/unit/stores/catalog.test.ts`.

**Estimated scope:** M

---

### Task 18 — MostUsedShelf component

**Description:** Dense 2-column grid, all entries visible (no scroll, page grows). Header has title + count + chevron collapse toggle (sessionStorage-persisted, default open). Top-2 entries get an editorial accent bar + bolder weight. Entries already in current list dimmed + strikethrough + ✓ badge. Tap adds to current list with one call.

**Acceptance criteria:**
- [ ] 24 entries render in 12 rows × 2 cols at 375 px without internal scroll.
- [ ] Tapping an entry calls `items.addItem`; UI dims the entry immediately.
- [ ] Chevron toggles open/closed; state survives navigation within session, resets on tab close.
- [ ] If catalog has 0 entries, shelf renders an inline empty state ("Aggiungi articoli per popolare lo scaffale").

**Verification:**
- [ ] Visual at 375 px: top-2 styled distinctly, dimmed entries have strikethrough.
- [ ] Unit test: collapse toggle persists across remounts in same session.
- [ ] E2E: tap entry → appears in correct category section.

**Dependencies:** Tasks 4, 12, 14, 17.

**Files likely touched:** `src/components/list/MostUsedShelf.vue`, `src/components/list/ShelfTile.vue`, `src/views/ListDetailView.vue` (wire-in).

**Estimated scope:** L (justified — single coherent component with multiple visual states)

---

### Checkpoint D — Shelf shipped

- [ ] Shelf renders in `ListDetailView`; one-tap add works.
- [ ] Coverage ≥ 80%; ranking domain still at 100%.
- [ ] **Human review at 375 px before Phase 4.**

---

## Phase 4 — Vertical Slice: Empty List + Item Removal

User story: I can wipe the list in one action with confirmation; I can remove a single item.

### Task 19 — EmptyListButton + bulk delete

**Description:** Ghost-destructive pill under category sections, separated by a dashed hairline. Shows total count badge. Hidden when list is empty OR autocomplete is active. Tap → confirmation modal → batched `deleteDoc` for all items (max 500 per batch; if more, paginate).

**Acceptance criteria:**
- [ ] Pill visible only with items present and autocomplete inactive.
- [ ] Confirmation modal blocks UI; "Cancel" closes; "Empty" wipes.
- [ ] After wipe, list shows empty state; no items remain in Firestore.
- [ ] Operation tolerant to > 500 items via batched commits.

**Verification:**
- [ ] E2E: add 3 items → empty list → 0 items remain → reload still 0.
- [ ] Integration: add 600 items → empty → all gone.

**Dependencies:** Tasks 13, 16.

**Files likely touched:** `src/components/list/EmptyListButton.vue`, `src/components/ui/ConfirmModal.vue`, `src/services/items.service.ts` (bulk delete helper).

**Estimated scope:** M

---

### Task 20 — Single-item removal (swipe + button)

**Description:** Long-press or trailing trash icon on `ListItemRow` reveals "Remove". Calls `items.service.removeItem`.

**Acceptance criteria:**
- [ ] Removing an item also decrements is **not** required (catalog only tracks adds).
- [ ] Removal is instant via optimistic update from realtime subscription.
- [ ] Undo: a toast with "Undo" re-adds within 5 s (best-effort, optional for v1).

**Verification:**
- [ ] E2E: remove one item, remaining items intact.

**Dependencies:** Task 16.

**Files likely touched:** `src/components/list/ListItemRow.vue`, `src/services/items.service.ts`.

**Estimated scope:** S

---

### Checkpoint E — Item ops complete

- [ ] All single-list flows work: add, check, remove, empty.
- [ ] **Human approval before Phase 5.**

---

## Phase 5 — Vertical Slice: Collaborators + Sharing

User story: As owner I add a collaborator by email; as collaborator I see the new list with a "new" badge; I can leave a shared list.

### Task 21 — users.service.findUserByEmail

**Description:** Query `users` collection by `email == lowercase(input)`. Return `UserProfile | null`. Normalize input (trim + lowercase) before query.

**Acceptance criteria:**
- [ ] Match found → returns profile.
- [ ] No match → returns `null`.
- [ ] Mixed-case input matches the lowercased indexed field.

**Verification:**
- [ ] Integration test: seed two users, lookup by exact + uppercase email succeed; unknown email returns null.

**Dependencies:** Tasks 5, 7.

**Files likely touched:** `src/services/users.service.ts`, `firebase/firestore.indexes.json` (single-field `email`).

**Estimated scope:** S

---

### Task 22 — lists.service: addCollaborator / removeCollaborator / leave

**Description:** Owner-only `addCollaborator(listId, email)` flow: lookup → if null, throw `UserNotFoundError`; else `arrayUnion(uid)` on `lists/{id}.collaboratorUids`. `removeCollaborator(listId, uid)` only by owner; `leaveList(listId)` only by self; both via `arrayRemove`. `ownerUid` can never be removed (guarded client-side; enforced server-side in Task 27).

**Acceptance criteria:**
- [ ] Adding a collaborator updates `collaboratorUids` and bumps `updatedAt`.
- [ ] Adding twice is idempotent (arrayUnion).
- [ ] Removing `ownerUid` is a no-op + error toast.
- [ ] Leaving removes self from the array; list disappears from leaver's home.

**Verification:**
- [ ] Integration with emulator: A creates list, adds B's email → B's subscription emits the list.

**Dependencies:** Tasks 10, 21.

**Files likely touched:** `src/services/lists.service.ts`, `tests/unit/services/lists.collab.int.test.ts`.

**Estimated scope:** M

---

### Task 23 — AddCollaboratorForm + CollaboratorList

**Description:** `AddCollaboratorForm`: email input, submit calls service, shows three states (idle, found = success toast, not-found = inline error). `CollaboratorList`: chips of members; owner sees "Remove" per non-owner; self sees "Leave list" pill.

**Acceptance criteria:**
- [ ] Not-found state shows: "No registered user with that email" (i18n) and does not send anything.
- [ ] Owner cannot remove themselves (button hidden).
- [ ] Non-owner sees only the "Leave" button.

**Verification:**
- [ ] E2E `collaborators.spec.ts`: A adds B → B sees list → B leaves → list gone from B.

**Dependencies:** Task 22.

**Files likely touched:** `src/components/collaborators/AddCollaboratorForm.vue`, `src/components/collaborators/CollaboratorList.vue`, `e2e/collaborators.spec.ts`.

**Estimated scope:** M

---

### Task 24 — "New since last visit" badge on home

**Description:** Track `users/{uid}.lastSeenLists` (timestamp). On home open, compare each list's `updatedAt` (or `addedAt` derived from when the user was added — simpler: any list with `updatedAt > lastSeenLists` AND uid in collaboratorUids that is NOT owned by you) → render badge. On home dismount, set `lastSeenLists = Date.now()`.

**Acceptance criteria:**
- [ ] A list newly shared with B shows the "new" badge on B's first home open.
- [ ] After scrolling/closing the home, reopening clears the badge.
- [ ] Owner's own lists never show "new".

**Verification:**
- [ ] E2E (two contexts): A shares with B → B opens home → badge visible → B reloads → badge gone.

**Dependencies:** Tasks 11, 22.

**Files likely touched:** `src/stores/lists.ts`, `src/views/ListsView.vue`, `src/components/list/ListCard.vue`, `src/services/users.service.ts`.

**Estimated scope:** M

---

### Task 25 — ListSettingsView

**Description:** Per-list settings: rename (owner only), manage collaborators (owner: add/remove; non-owner: leave), hard-delete (owner only — purges all items in batches then deletes the list doc; irreversible, confirmed by modal).

**Acceptance criteria:**
- [ ] Rename writes `name` + bumps `updatedAt`.
- [ ] Hard-delete navigates back to home; list + all items removed from Firestore; irreversible.
- [ ] Non-owner cannot see rename/delete UI.

**Verification:**
- [ ] E2E: owner renames → both clients see new name in < 1s.

**Dependencies:** Tasks 22, 23.

**Files likely touched:** `src/views/ListSettingsView.vue`.

**Estimated scope:** M

---

### Checkpoint F — Sharing complete

- [ ] Two-context E2E for share + leave + rename + badge passes.
- [ ] **Human approval before Phase 6.**

---

## Phase 6 — **CANCELLED** (Trash + Soft-delete Recovery)

Trash + recover/purge dropped from v1. List deletion in Task 25 is immediate and irreversible (purges items + deletes list doc), guarded by a confirmation modal that explicitly states the action cannot be undone. Rationale: trash adds storage cost + query complexity for a feature with minimal real-world value at this product's scale. If users later request recovery, reintroduce as a separate phase.

---

## Phase 7 — Vertical Slice: Settings + i18n switcher

### Task 27 — SettingsView (language, account, logout) + Firestore rules

**Description:** SettingsView: locale toggle (it/en), display user email + name, "Sign out" button. Persist locale to `localStorage`. **Also**: write the final Firestore security rules and composite indexes.

**Rules summary:**
- `users/{uid}`: any authenticated user can read; user can write only their own doc.
- `lists/{id}`: read if `request.auth.uid in resource.data.collaboratorUids`. Create requires `ownerUid == request.auth.uid` and `ownerUid in collaboratorUids`. Update of `name`, `updatedAt` only by owner. Update of `collaboratorUids`: owner can add/remove anyone except cannot remove `ownerUid`; non-owner can only remove their own uid. Delete only by owner.
- `lists/{id}/items/{itemId}`: read + write if requesting user is in parent list's `collaboratorUids`.
- `catalog/{uid}/entries/{eid}`: read + write only by `uid` itself.

**Acceptance criteria:**
- [ ] Locale toggle switches UI language live.
- [ ] Sign-out clears auth + returns to /login.
- [ ] Rules test suite (`@firebase/rules-unit-testing`) covers every allow/deny case above; all pass.

**Verification:**
- [ ] `pnpm test:rules` green.
- [ ] Manual: language toggles instantly.

**Dependencies:** Tasks 4, 8, 22.

**Files likely touched:** `src/views/SettingsView.vue`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `tests/rules/firestore.rules.test.ts`, `package.json` (test:rules script).

**Estimated scope:** L (justified — view + rules + rules tests bundled because rules need to be written against the now-stable schema)

---

### Checkpoint H — Rules locked

- [ ] No unauthorized access path remains; emulator rules suite green.
- [ ] **Human approval before Phase 7.5.**

---

## Phase 7.5 — UX / Polish (pre-PWA)

Pre-PWA polish slice covering copy, icon system, illustrations, sort order, category collapse + counter, public catalog seed, item edit (long-press), duplicate-name guard, haptic, confetti, skeletons, slide-out animation. Each task is its own commit. Ordered by dependency / blast-radius.

### Task 27.A — i18n + copy rename

**Description:** Rename three user-facing labels across `it.json` + `en.json` and update all dependent component strings, tests, and SPEC references.

- `collaborators.owner`: "Proprietario" → "Amministratore"; "Owner" → "Admin".
- `listSettings.rename`: "Rinomina" → "Nome"; "Rename" → "Name".
- `shelf.title`: "Lo Scaffale" → "I preferiti"; "Most Used" → "Favorites".

**Acceptance criteria:**
- [ ] Both locale files updated; no other key affected.
- [ ] Existing unit tests asserting on old strings updated.
- [ ] SPEC.md MostUsedShelf user story updated.

**Files likely touched:** `src/i18n/locales/{it,en}.json`, `tests/unit/views/ListSettingsView.test.ts`, `tests/unit/components/MostUsedShelf.test.ts`, `tests/unit/components/CollaboratorList.test.ts`, `SPEC.md`.

**Estimated scope:** S

---

### Task 27.B — Quick UX fixes (red delete, shelf-title collapse)

**Description:**
- `ListSettingsView` "Elimina lista" button full red: red fill + offwhite text (use existing red tokens; no new hexes).
- `MostUsedShelf`: clicking the title text toggles collapse (parity with chevron). Keep chevron functional; both targets share the same handler.

**Acceptance criteria:**
- [ ] Delete-list button background red, text contrasts AA.
- [ ] Test: click on shelf title node toggles `collapsed` state.

**Files likely touched:** `src/views/ListSettingsView.vue`, `src/components/list/MostUsedShelf.vue`, related tests.

**Estimated scope:** S

---

### Task 27.H — Alphabetical sort (categories + items)

**Description:** Categories rendered in alphabetical order **by translated label** (locale-aware via `Intl.Collator`). Items within each category sorted alphabetically by name (locale-aware). Sort is a pure function in `domain/sort.ts` with unit tests; consumed by `ListDetailView` / `CategorySection`. Order recomputes on locale change.

**Acceptance criteria:**
- [ ] `sortCategories(categories, locale)` deterministic, locale-aware, tested.
- [ ] `sortItemsByName(items, locale)` deterministic, locale-aware, tested.
- [ ] No re-ranking of MostUsedShelf (that stays recency-weighted).

**Files likely touched:** `src/domain/sort.ts`, `src/views/ListDetailView.vue`, `src/components/list/CategorySection.vue`, `tests/unit/domain/sort.test.ts`.

**Estimated scope:** S

---

### Task 27.I — Category collapse + bought/total counter

**Description:** Each `CategoryHeader` becomes a button. Click toggles section collapse. Header shows the live counter `bought/total` (e.g. "Latticini · 2/5"). Collapsed sections still show the counter; the items list is hidden. Collapse state persisted per-list in `localStorage` (`buy-the-way:list:{listId}:collapsedCategories`).

**Acceptance criteria:**
- [ ] Click header toggles section.
- [ ] Counter updates live when items added/checked/removed.
- [ ] State restored on reload of same list.

**Files likely touched:** `src/components/list/CategoryHeader.vue`, `src/components/list/CategorySection.vue`, `src/composables/useCollapsedCategories.ts`, tests.

**Estimated scope:** M

**Dependencies:** Task 27.H (counter rendered after sort is in place).

---

### Task 27.C — Icon system + leading icons on every button

**Description:** Install `@lucide/vue` for UI affordances (Plus, Trash2, Check, X, ArrowLeft, LogOut, UserPlus, Star, Settings). Category and per-item icons stay as Unicode emoji rendered through a `<span aria-hidden>` with the category cssVar tint applied. Apply pattern on CTAs: `<Icon class="size-4 mr-2" />` then label. Apply across:

- FAB (Plus)
- Add item (Plus)
- Save / Confirm (Check)
- Cancel (X)
- Delete / Empty list (Trash2)
- Leave list (LogOut)
- Sign out (LogOut)
- Add collaborator (UserPlus)
- Google login (custom official Google SVG, in `public/branding/google-g.svg`)
- "I preferiti" header (Star) and shelf chevron (existing)

Replace category-color dot in `ListItemRow` with `CategoryIcon` (already exists). Replace dot in any other category-marker site.

**Acceptance criteria:**
- [ ] `pnpm add @lucide/vue` recorded in lockfile.
- [ ] Every primary button on every view renders an icon left of its label.
- [ ] Google button uses official Google G SVG (per Google Brand Guidelines).
- [ ] Star icon on "I preferiti" title.
- [ ] CategoryIcon renders the category emoji tinted with `--cat-*`.

**Files likely touched:** `package.json`, `src/components/ui/IconButton.vue`, all views and components with CTAs, `public/branding/google-g.svg`, related tests.

**Estimated scope:** L (cross-cutting)

**Dependencies:** Task 27.A (label keys final).

---

### Task 27.G — Item edit via long-press

**Description:** Long-press (500 ms) on `ListItemRow` opens a bottom-sheet edit panel (`ItemEditSheet.vue`): name, quantity, note, category. `updateItem(listId, itemId, patch)` service. Realtime sync verified. Long-press detection uses `pointerdown`/`pointerup` with timer (no external lib); cancels on scroll. Tap remains the toggle-checked action.

**Acceptance criteria:**
- [ ] Long-press 500 ms opens sheet; tap < 500 ms still toggles checked.
- [ ] Edit persists name/quantity/note/category; `updatedAt` updated.
- [ ] Sheet has Cancel + Save (with icons per 27.C).
- [ ] Two-context realtime: edit on one tab visible on the other < 1 s.

**Files likely touched:** `src/services/items.service.ts` (`updateItem`), `src/stores/items.ts`, `src/components/list/ListItemRow.vue`, `src/components/list/ItemEditSheet.vue`, tests.

**Estimated scope:** M

**Dependencies:** Task 27.C (icons in sheet CTAs).

---

### Task 27.D — Visual polish: logo + illustrations

**Description:**
- `LoginView`: large logo (`public/branding/logo-icon.svg` derived from `logo-original.png`, square cart-only) above the wordmark, with a CSS keyframe animation on mount (scale 0.9 → 1, opacity 0 → 1, ~600 ms, ease-out; gentle hover float optional). Respects `prefers-reduced-motion`.
- `ListsView` header: small logo (24 px) next to the "Buy The Way" title.
- Empty-state illustrations (cactus SVG or equivalent friendly mark, in `src/assets/illustrations/`):
  - `ListsView` empty: above "Nessuna lista".
  - `ListDetailView` empty: above "Nessun articolo".
  - `MostUsedShelf` empty: above the empty hint.

Illustrations are inline SVG via Vue `<component>` or `<img>` with `loading="lazy"`. Size ~120 px. Tinted with `currentColor` where possible.

**Acceptance criteria:**
- [ ] Logo on LoginView visible + animated; reduced-motion users see static.
- [ ] Logo small next to ListsView title.
- [ ] Three empty-state illustrations present and a11y-friendly (`aria-hidden="true"` since the heading carries semantic).

**Files likely touched:** `src/views/LoginView.vue`, `src/views/ListsView.vue`, `src/views/ListDetailView.vue`, `src/components/list/MostUsedShelf.vue`, `src/assets/illustrations/*.svg`, `public/branding/logo-icon.svg`.

**Estimated scope:** M

---

### Task 27.E — Public catalog seed + autocomplete merge

**Description:** Add `src/domain/public-catalog.ts` exporting `PUBLIC_CATALOG: ReadonlyArray<{ slug: string; name_it: string; name_en: string; category: Category; icon?: string }>` with ~200 common Italian grocery items spread across all categories. Normalized slugs to enable dedupe.

`ItemAutocomplete`:
- Builds search index from user catalog + public catalog (locale-aware name).
- Dedupes by normalized name (user entry wins on conflict).
- Results sorted: exact prefix match → contains match → ranked by user-catalog usage (if present).
- Custom-item path remains as fallback when 0 matches and input is non-empty.

**Acceptance criteria:**
- [ ] ≥ 200 entries covering all 9 categories with reasonable distribution.
- [ ] Typing "lat" suggests "Latte" (it) / "Milk" (en) from public catalog.
- [ ] User-catalog entry with same name overrides public.
- [ ] Custom-item creation path still works for novel names.
- [ ] Unit tests for merge + dedupe + locale switch.

**Files likely touched:** `src/domain/public-catalog.ts`, `src/components/list/ItemAutocomplete.vue`, `src/stores/catalog.ts`, tests.

**Estimated scope:** M

**Dependencies:** Task 27.A (locale field names stable).

---

### Task 27.F1 — Prevent duplicate list names per user

**Description:** `createList(name, ownerUid)` rejects when the user already owns or collaborates on a list whose name matches case-insensitive trim. Check runs client-side against the in-memory `listsStore.lists`. New error `DuplicateListNameError` shown via i18n in `ListsView` create flow.

**Acceptance criteria:**
- [ ] Create list "Spesa" then "spesa " → second fails with explicit error.
- [ ] Error toast/message uses `list.duplicateName` i18n key.
- [ ] Unit test for the duplicate check; no Firestore call when duplicate detected.

**Files likely touched:** `src/services/lists.service.ts` (signature accepts the existing-names set), `src/stores/lists.ts`, `src/views/ListsView.vue`, i18n locales, tests.

**Estimated scope:** S

---

### Task 27.F2 — Per-item icon for non-custom items

**Description:** `PUBLIC_CATALOG` carries a Unicode emoji per entry. `ListItemRow`, `ShelfTile`, and `ItemAutocomplete` suggestion rows render the matched emoji left of the name; custom items (no public match) show the generic `📦` emoji. Icon is purely decorative (`aria-hidden`).

**Acceptance criteria:**
- [ ] Public-catalog items render their dedicated icon.
- [ ] Custom items render a generic placeholder icon.
- [ ] No layout shift; CategoryIcon already on row stays where it is.

**Files likely touched:** `src/domain/public-catalog.ts` (icon field), `src/components/list/ListItemRow.vue`, `src/components/list/ShelfTile.vue`, tests.

**Estimated scope:** S

**Dependencies:** Tasks 27.C and 27.E.

---

### Task 27.J — Polish bundle (haptic, auto-collapse, skeleton, slide-out)

**Description:**
- **Haptic**: `navigator.vibrate(10)` on add-item, toggle-checked, and confirm-remove. Feature-detect; respect `prefers-reduced-motion` and a `localStorage` opt-out key `buy-the-way:haptic` (default on).
- **Auto-collapse**: when the last unchecked item of a category becomes checked (transition any-unchecked → all-checked for that category), auto-collapse that category via `useCollapsedCategories`. No confetti, no toast — just collapse.
- **Skeleton loaders**: `ListsView` shows 3 skeleton cards while `loading`. `ListDetailView` shows a skeleton block while items are initial-loading.
- **Slide-out animation**: removing an item plays a 200 ms slide-left + fade transition before unmount (`<TransitionGroup>` on the items list). Respects reduced-motion (instant unmount).

**Acceptance criteria:**
- [ ] Haptic fires only on touch-capable devices; no errors on desktop.
- [ ] Auto-collapse triggers exactly once per category-completion transition; uncheck re-arms the trigger.
- [ ] Skeletons visible until first snapshot.
- [ ] Slide-out animates on remove; reduced-motion bypasses.

**Files likely touched:** `src/composables/useHaptic.ts`, `src/composables/useReducedMotion.ts`, `src/components/ui/SkeletonCard.vue`, `src/views/ListsView.vue`, `src/views/ListDetailView.vue`, `src/components/list/CategorySection.vue`, tests.

**Estimated scope:** M

**Dependencies:** Tasks 27.C (icons), 27.H/I (no conflicts).

---

### Checkpoint H.5 — UX/Polish complete

- [ ] All 11 Phase 7.5 tasks shipped; each is its own commit.
- [ ] `pnpm test:run` + `pnpm test:coverage` green; coverage ≥ 80%.
- [ ] `pnpm build` green; `pnpm lint` clean.
- [ ] Manual smoke at 375 px: every CTA has an icon; sort + collapse + counter work; long-press edit works; duplicate name rejected; haptic + confetti + skeleton + slide-out verified on a touch device.
- [ ] **Human approval before Phase 8.**

---

## Phase 8 — Vertical Slice: PWA + Offline

User story: install to home screen; use app offline; edits sync when online.

### Task 28 — vite-plugin-pwa + manifest + icons

**Description:** Install `vite-plugin-pwa`. Generate icons from `public/branding/logo-original.png` (script `scripts/build-icons.ts`): square 1024 → 192, 512 (maskable), apple-touch 180, favicon multi-size. Manifest with `name`, `short_name`, `theme_color: #1c1c1c`, `background_color: #f7f4ed`, `display: standalone`.

**Acceptance criteria:**
- [ ] All required icons in `public/icons/` (already present per repo).
- [ ] `dist/manifest.webmanifest` is valid.
- [ ] Lighthouse "Installable" check passes.

**Verification:**
- [ ] Chrome → Install button visible on `pnpm preview`.

**Dependencies:** Task 1.

**Files likely touched:** `vite.config.ts`, `scripts/build-icons.ts`, `public/icons/*` (verify already there).

**Estimated scope:** S

---

### Task 29 — SW registration + update prompt + offline banner

**Description:** Register SW in `src/pwa/registerSW.ts`; when an update is available, show a non-blocking toast "New version available — Reload". When `navigator.onLine` is false, show a charcoal banner "Offline — modifiche sincronizzate al rientro".

**Acceptance criteria:**
- [ ] On a deploy, returning users see the update prompt.
- [ ] Going offline shows the banner within 1 s; back online hides it.
- [ ] Cache strategy: static assets cache-first, Firestore data network-first (delegated to SDK).

**Verification:**
- [ ] DevTools → Offline → banner appears; refresh works (shell cached).

**Dependencies:** Task 28.

**Files likely touched:** `src/pwa/registerSW.ts`, `src/components/ui/OfflineBanner.vue`, `src/components/ui/Toast.vue`, `src/App.vue`.

**Estimated scope:** M

---

### Task 30 — Offline persistence + last-write-wins verification

**Description:** Enable Firestore IndexedDB persistence (`enableIndexedDbPersistence` or modular `persistentLocalCache`). Verify last-write-wins: two clients edit the same item offline; on reconnect, the later `updatedAt` wins.

**Acceptance criteria:**
- [ ] Cold reload offline still shows previously loaded lists/items.
- [ ] Editing an item offline queues; comes online → write hits Firestore.
- [ ] Concurrent offline edits resolve by `updatedAt` (latest wins).

**Verification:**
- [ ] E2E `offline-sync.spec.ts`: setOffline → edit → setOnline → server has edit.
- [ ] Manual two-tab test for last-write-wins.

**Dependencies:** Task 29.

**Files likely touched:** `src/services/firebase.ts`, `e2e/offline-sync.spec.ts`.

**Estimated scope:** M

---

### Checkpoint I — PWA ready

- [ ] Lighthouse PWA ≥ 90, Performance mobile ≥ 85, Accessibility ≥ 95.
- [ ] Offline E2E green.
- [ ] **Human install + use offline before Phase 9.**

---

## Phase 9 — Hardening: a11y + realtime + full E2E

### Task 31 — E2E suite finalization + axe a11y

**Description:** Complete `e2e/auth.spec.ts`, `list-crud.spec.ts`, `collaborators.spec.ts`, `share-realtime.spec.ts`, `offline-sync.spec.ts`. Add `@axe-core/playwright` checks on `/login`, `/lists`, `/lists/:id`, `/lists/:id/settings`, `/settings`, `/trash`. Mock Google sign-in via emulator's `signInWithCredential`.

**Acceptance criteria:**
- [ ] All 5 E2E specs green against emulator.
- [ ] axe finds 0 serious/critical violations on the 6 routes.
- [ ] Realtime spec uses two browser contexts; sync verified < 1 s.

**Verification:**
- [ ] `pnpm test:e2e` runs in < 5 min and is green.

**Dependencies:** Tasks 9, 11, 16, 23, 26, 27, 30.

**Files likely touched:** `e2e/*.spec.ts`, `playwright.config.ts`, `package.json`.

**Estimated scope:** L (justified — five specs share fixtures; bundling avoids per-spec rework)

---

### Checkpoint J — Tests complete

- [ ] Coverage ≥ 80% (statements, branches, functions, lines).
- [ ] E2E green; axe green.
- [ ] **Human approval before Phase 10.**

---

## Phase 10 — Ship: CI + Deploy

### Task 32 — GitHub Actions CI + Netlify deploy

**Description:** `.github/workflows/ci.yml`: lint + typecheck + test:run + test:rules + build. Boots Firebase emulators for rules/integration tests. `.github/workflows/deploy.yml`: on push to `main`, build + deploy to Netlify. `netlify.toml`: SPA fallback (`/* → /index.html`), security headers (CSP, X-Frame-Options).

**Acceptance criteria:**
- [ ] CI green on a fresh push.
- [ ] First Netlify deploy live at `*.netlify.app`.
- [ ] All Success Criteria in SPEC.md checked.

**Verification:**
- [ ] CI badge green on the PR.
- [ ] Production URL: log in (with prod Firebase project), create list, share with second test account.

**Dependencies:** Task 31.

**Files likely touched:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `netlify.toml`, `README.md` (links).

**Estimated scope:** M

---

### Checkpoint K — Shipped

- [ ] CI green on `main`.
- [ ] Production deploy reachable; smoke test passes.
- [ ] SPEC.md Success Criteria fully checked.

---

## Phase 11 — UX additions: shelf, wallpapers, item controls, account ops

Ten user-requested enhancements landing after the v1 ship. Ordered by dependency / blast radius. Each task is its own commit. High-risk irreversible operation (Task 42 — delete account) is gated by an intra-phase checkpoint.

### Task 33 — Auto-reopen collapsed category on new item (S)

**Description:** When a category is collapsed (manually or by Task 27.J auto-collapse-when-all-checked) and a new item is added to that category — via autocomplete, custom-item path, shelf one-tap, or copy/move (Task 39) — the category section must expand. Reuse `useCollapsedCategories` API: drop the category from the `collapsed` Set when its item set transitions from "no items in category" or grows in size while collapsed; arm the auto-collapse-when-completed trigger fresh.

**Acceptance criteria:**
- [ ] Add item to a collapsed category → section expands; `localStorage` collapse-set persisted state reflects the change.
- [ ] Re-checking the new item to complete the category re-triggers Task 27.J auto-collapse (trigger re-arms).
- [ ] No regression on the existing collapse-by-completion behavior.

**Verification:**
- [ ] Unit test on `ListDetailView` watcher: collapsed Set { Bakery } + add item Bakery via `addItem` → toggleCollapsed called for Bakery.
- [ ] Manual 375 px: collapse Dairy → add "Latte" → Dairy expanded.

**Dependencies:** Tasks 27.I, 27.J.

**Files likely touched:** `src/views/ListDetailView.vue`, `src/composables/useCollapsedCategories.ts` (only if a helper is added), tests.

**Estimated scope:** S

---

### Task 34 — Favorites grouped by category + stable order on selection (M)

**Description:** Split `MostUsedShelf` rendering into per-category sub-sections (sorted alphabetically by translated category label, reusing `sortCategoriesByLabel`). Within a sub-section, entries keep the ranking order returned by `rankCatalog`. Critically: selecting a tile (one-tap add) MUST NOT reorder the shelf — selection bumps the catalog's `usageCount`/`lastUsedAt` which would re-rank live; capture a stable snapshot in the component when the entry set's id-membership changes and only refresh ordering when membership changes (entry added, removed, pinned/excluded), not when scores change. Pinned vs. non-pinned visual treatment unchanged; "top-2 editorial accent" computed off the snapshot.

**Acceptance criteria:**
- [ ] Shelf renders one mini-section per category present in `entries`; section header uses CategoryHeader styling (smaller variant), no collapse toggle.
- [ ] Tapping a tile to add to the list does not visually reorder tiles in the same render-pass or subsequent re-renders triggered solely by score changes.
- [ ] Adding a NEW entry (first-time use of an item) does refresh the snapshot — the new tile appears in its category section.
- [ ] Excluding via the X button removes the tile and refreshes the snapshot.
- [ ] Empty-category sections are not rendered.

**Verification:**
- [ ] Unit test on `MostUsedShelf`: mount with 3 entries → pointerup-add an entry → snapshot order unchanged; supply new entry-list prop with a new id → snapshot recomputes.
- [ ] Manual 375 px: open list → tap second tile → first tile still first.

**Dependencies:** Tasks 17, 18, 27.H.

**Files likely touched:** `src/components/list/MostUsedShelf.vue`, `src/domain/sort.ts` (`groupCatalogByCategory` helper), tests.

**Estimated scope:** M

---

### Task 35 — Favorites count title + per-list show/hide toggle (M)

**Description:** Two coupled changes to the favorites surface:

1. **Title rewrite**: shelf header text becomes "I tuoi {n} articoli preferiti" / "Your {n} favorite items", where `{n}` is the count of currently visible (rendered) favorites entries. `FAVORITES_MAX` (30) stays the upper bound. Title falls back to a generic label when n = 0 (shelf is hidden in that case anyway). Pluralized i18n.
2. **Per-list visibility toggle (admin-only, decision locked)**: new `List.showFavorites?: boolean` field (default `true` when undefined). `ListSettingsView` exposes a toggle visible to the list admin only — non-admins do not see the control. `ListDetailView` conditionally renders `<MostUsedShelf>` based on `list.showFavorites !== false`. Service: `setListShowFavorites(listId, value)`. Firestore rules: owner-update branch already permits arbitrary `name/updatedAt`-bearing patches by owner — extend whitelist if rule narrows fields; otherwise add the field to the allowed owner-update keys explicitly.

**Acceptance criteria:**
- [ ] `MostUsedShelf` title shows the localized "{n} favorite items" string; updates live as the snapshot count changes.
- [ ] `ListSettingsView` shows a toggle (admin only); state persists to Firestore and round-trips on reload.
- [ ] When toggled off, `MostUsedShelf` does not render in `ListDetailView` (DOM absent, no subscription cost).
- [ ] Collaborator (non-admin) sees the resulting state but cannot toggle it.
- [ ] Rules test confirms non-owner cannot write `showFavorites`.

**Verification:**
- [ ] Unit test: shelf title with n=0, 1, 5, 30.
- [ ] Unit test: `ListDetailView` v-if guards on `list.showFavorites`.
- [ ] Rules unit test: non-owner update with `showFavorites` patch → denied.
- [ ] Manual: admin toggles off → reload → shelf gone; non-admin sees no toggle.

**Dependencies:** Tasks 25 (settings view), 34 (snapshot count).

**Files likely touched:** `src/domain/types.ts`, `src/services/lists.service.ts`, `src/views/ListSettingsView.vue`, `src/views/ListDetailView.vue`, `src/components/list/MostUsedShelf.vue`, `src/i18n/locales/{it,en}.json`, `firebase/firestore.rules`, `tests/rules/firestore.rules.test.ts`, unit tests.

**Estimated scope:** M

---

### Task 36 — List wallpapers: random on create + admin picker (L)

**Description:** Use the 10 background images already in `public/wallpapers/` (`01.jpg`–`10.jpg`). Each list gets a wallpaper chosen randomly on creation; admin can change it from list settings; rendered as background on `ListCard` in `ListsView` ONLY (with a darkening scrim for text legibility). `ListDetailView` does NOT render the wallpaper — decision locked.

- `List.wallpaper?: string` (filename, e.g. `"05.jpg"`).
- New `src/domain/wallpapers.ts`: `WALLPAPERS = ['01.jpg', …, '10.jpg'] as const`, `pickRandomWallpaper()` (uniform).
- `createList(name, ownerUid, existingNames)` picks random and writes `wallpaper`.
- New service `setListWallpaper(listId, filename)` (admin only — validated against the allowlist).
- New `WallpaperPicker.vue` (grid of 10 thumbnails, current one ringed); inserted into `ListSettingsView` admin section.
- `ListCard.vue` renders the image as a CSS background-image with `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))` overlay; falls back gracefully when `wallpaper` is undefined (legacy lists). `ListDetailView` is NOT modified — wallpaper appears only on the list-of-lists screen.
- Firestore rules: owner-update branch allows `wallpaper`; reject non-allowlisted values via field-level shape check (string length, prefix). Non-owners may not write the field.
- Lazy-loading: `<img loading="lazy">` on picker thumbnails; preload only the assigned wallpaper per card.

**Acceptance criteria:**
- [ ] Creating a list assigns a random wallpaper from the 10-file set and persists it.
- [ ] Admin sees a picker grid in list settings; selecting one updates the list and reloads `ListsView` cards with the new background.
- [ ] Non-admin in settings sees the current wallpaper (read-only) or the picker is hidden — pick UX path during impl.
- [ ] Existing lists without a `wallpaper` field render the cream-only card (no errors, no 404 on missing image).
- [ ] Rules test: non-owner write to `wallpaper` → denied; owner write with bogus filename (`"../etc/passwd.jpg"`) → denied.

**Verification:**
- [ ] Unit test: `createList` writes a wallpaper filename matching the allowlist.
- [ ] Unit test: `setListWallpaper` rejects out-of-allowlist filenames.
- [ ] Rules unit test: non-owner blocked.
- [ ] Manual at 375 px: cards show wallpapers with legible text; picker selects + persists; legacy list still renders.

**Dependencies:** Task 25.

**Files likely touched:** `src/domain/wallpapers.ts`, `src/domain/types.ts`, `src/services/lists.service.ts`, `src/components/list/ListCard.vue`, `src/components/list/WallpaperPicker.vue`, `src/views/ListSettingsView.vue`, `firebase/firestore.rules`, `tests/rules/firestore.rules.test.ts`, unit tests.

**Estimated scope:** L — justified: domain helper + service + 2 views + new component + rules + rules tests in one slice keeps the wallpaper feature coherent; splitting would force a partial-feature merge.

---

### Task 37 — Item priority (urgent / optional) (M)

**Description:** Each item gains an optional priority: `'urgent'`, `'optional'`, or undefined (default). Surface as a **single inline button** on `ListItemRow` next to the trash icon — decision locked. The button cycles none → urgent → optional → none on each tap, with the icon + tooltip changing to reflect the next state. Visual on row: urgent = red dot/flame badge + red accent, optional = muted ghost + smaller font, default unchanged. Sort order within a category: urgent first (preserving alphabetical inside the group), then unprioritized, then optional (each subgroup alphabetical). Service patch via existing `updateItem`. The 3-chip variant inside `ItemEditSheet` is also added for the long-press/settings path so users can jump directly to a state.

**Acceptance criteria:**
- [ ] `Item.priority` typed as `'urgent' | 'optional' | undefined`.
- [ ] Cycling button updates Firestore and re-sorts the section live.
- [ ] Urgent items show a clear visual cue (red); optional items appear muted; default unchanged.
- [ ] Sort: urgent > none > optional, then alphabetical (locale-aware) within each tier.
- [ ] Rules: any collaborator can patch `priority` (it's an item field — already covered by item-write rule).
- [ ] Long-press edit sheet also exposes priority selection (3 chips).

**Verification:**
- [ ] Unit test on `sortItemsByPriorityThenName`: mixed inputs sorted correctly per locale.
- [ ] Unit test on `ListItemRow`: clicking priority button emits the right next state.
- [ ] Manual 375 px: add 3 items, set one urgent → it moves to top of section; set another optional → it sinks to bottom.

**Dependencies:** Tasks 14, 16, 27.G.

**Files likely touched:** `src/domain/types.ts`, `src/domain/sort.ts`, `src/services/items.service.ts` (`ItemPatch` adds `priority`), `src/stores/items.ts` (re-sort), `src/components/list/ListItemRow.vue`, `src/components/list/ItemEditSheet.vue`, `src/i18n/locales/{it,en}.json`, tests.

**Estimated scope:** M

---

### Task 38 — Item settings shortcut button on row (S)

**Description:** Add a `Settings` lucide icon button on `ListItemRow`, placed between the priority button and the trash button. Tapping it emits the existing `long-press` event (same payload), opening `ItemEditSheet`. Provides discoverability for users who don't know about the 500 ms long-press. Tap target ≥ 44×44 px.

**Acceptance criteria:**
- [ ] Button visible on every `ListItemRow`; aria-label uses `item.openSettings` i18n key.
- [ ] Tapping opens `ItemEditSheet` with the same item context as long-press.
- [ ] Long-press still works; both paths produce identical sheet state.
- [ ] Row layout at 375 px remains legible with all icon buttons (priority + settings + trash); name + qty + note still wraps cleanly.

**Verification:**
- [ ] Unit test on `ListItemRow`: click settings button emits `long-press` with item.
- [ ] Visual regression at 375 px: row width remains ≥ legible threshold.

**Dependencies:** Tasks 20, 27.G, 37 (priority button is the neighbor — ordering matters).

**Files likely touched:** `src/components/list/ListItemRow.vue`, `src/i18n/locales/{it,en}.json`, tests.

**Estimated scope:** S

---

### Task 39 — Copy / Move item between lists (M)

**Description:** Add a button to `ListItemRow` (lucide `ArrowRightLeft` icon) that opens a bottom-sheet `ListPickerSheet`. The sheet contains exactly two actions and no others — decision locked: **Copy** (keeps original) and **Move** (deletes original after destination write). User first picks the destination list from the sheet, then taps Copy or Move. Use atomic two-step: write new item in destination → on success, delete from source (move) or no-op (copy). On destination, run the same `addItem` flow so the catalog write-through fires for the destination user too.

**Services:**
- `copyItem(srcListId, item, dstListId, byUid)` — wraps `addItem` on dst.
- `moveItem(srcListId, item, dstListId, byUid)` — `copyItem` then `removeItem` on src; not transactional across documents, accept eventual consistency.

**Edge cases:**
- Destination list has an item with same name (case-insensitive): skip the copy/move with a toast `item.duplicateInDestination`.
- User has no other lists: sheet shows "No other lists" state, no actions.
- Source list disappears mid-flow (deleted by another collaborator): catch and surface error.

**Acceptance criteria:**
- [ ] Sheet opens, lists candidate destinations, each row has Copy + Move buttons.
- [ ] Copy: original stays, destination has the new item; both lists' realtime subscriptions reflect the change < 1 s.
- [ ] Move: original removed, destination has it.
- [ ] Duplicate-name in destination is rejected with toast; nothing is mutated.
- [ ] Sheet closes after action; trash & priority buttons unaffected.

**Verification:**
- [ ] Unit test `copyItem`: writes addItem on dst with correct fields.
- [ ] Unit test `moveItem`: writes dst then deletes src.
- [ ] Unit test: duplicate detection branch.
- [ ] Manual two-tab: copy item from A to B → both visible. Move item from A to B → gone from A, present in B.

**Dependencies:** Tasks 12, 20, 38 (row layout).

**Files likely touched:** `src/services/items.service.ts` (`copyItem`, `moveItem`), `src/components/list/ListPickerSheet.vue`, `src/components/list/ListItemRow.vue`, `src/i18n/locales/{it,en}.json`, tests.

**Estimated scope:** M

---

### Checkpoint L.1 — Item-row controls + favorites + wallpapers

- [ ] Tasks 33–39 each landed as separate commits.
- [ ] `pnpm test:coverage` ≥ 80%; `pnpm typecheck` green; `pnpm build` green; `pnpm lint` clean.
- [ ] Rules tests for `showFavorites` and `wallpaper` ownership branches green.
- [ ] Manual smoke at 375 px: auto-reopen, grouped shelf, stable on tap, count title, show-favorites toggle, wallpaper picker, priority cycle, settings icon, copy + move.
- [ ] **Human approval before Task 40 (cart animation) and Task 42 (delete account).**

---

### Task 40 — Animated cart on list-detail page (S) — **CANCELLED post-implementation**

Cart was implemented + landed under test, then removed on user feedback (2026-05-19): visual noise on the header outweighed the playfulness signal. `AnimatedCart.vue` and its test suite were deleted; the trigger hook in `ListDetailView` was removed. CompletionCelebration (Task 41) covers the only retained motion cue.

Historical spec retained below for context:

**Description:** Render a small shopping-cart SVG (~28 px) inline in the `ListDetailView` header, positioned to the right of the list title (or just below it on narrow screens), as a persistent decorative element. The cart has two visible wheels and a basket. Animation has three states driven purely by CSS classes:

1. **Idle (default, list has at least one unbought item):** wheels rotate continuously at one full turn per ~4 s. The basket itself does not translate — the wheels do the rolling. Imagine the cart parked but ready, wheels turning slowly as if rolling in place. This is the ambient motion the user requested.
2. **On add-item (one-shot, ~600 ms):** the entire cart translates +12 px to the right, then back to origin, while wheels spin briefly faster (one turn in ~400 ms). Triggered each time `addItem` resolves successfully (also when adding from autocomplete, custom item, shelf one-tap, copy/move into the current list). Re-triggering during an in-flight animation restarts it.
3. **All bought (sticky):** when `boughtCount === itemCount && itemCount > 0`, wheels stop, the cart tilts back ~6° (subtle "done" pose), and stays there until any item becomes unchecked or the list grows. This is a calm rest-state cue, not a celebration (Task 41 handles the celebration).

Implementation: a single `AnimatedCart.vue` component takes a `state: 'idle' | 'rolling' | 'parked'` prop. `ListDetailView` derives the state from store values and bumps a `triggerKey` on every successful add to retrigger the rolling class. Pure CSS keyframes — no JS animation lib, no canvas. `prefers-reduced-motion`: cart renders as a static icon, all three states resolve to the same frame (no rotation, no translate, no tilt).

**Acceptance criteria:**
- [x] Cart SVG visible in `ListDetailView` header; not present on other views.
- [x] Idle state: wheels rotate continuously, ~4 s/turn (CSS keyframe, GPU-friendly transform).
- [x] Add-item triggers the 600 ms forward-bump + faster wheel spin; rapid successive adds restart via `triggerKey` increment.
- [x] Parked state: when list fully bought, wheels stop and cart tilts back; un-checking returns to idle.
- [x] `prefers-reduced-motion`: `cart-reduced` class forces static rendering (also enforced via `@media` query).
- [x] No layout shift between states (cart occupies fixed footprint via inline width/height on SVG).

**Verification:**
- [x] Unit test: state computed from `itemCount` + `boughtCount` (parked when all checked & non-empty; idle otherwise); add-item bumps `triggerKey` (8 tests in `tests/unit/components/AnimatedCart.test.ts`).
- [x] Unit test: reduced-motion forces `cart-reduced` class.
- [ ] Manual at 375 px: visual on Chrome + Safari iOS (pending human verification).

**Dependencies:** Task 16, Task 27.J (reused `useReducedMotion`).

**Files likely touched:** `src/components/list/AnimatedCart.vue`, `src/views/ListDetailView.vue`, `src/composables/useReducedMotion.ts` (reuse, no changes).

**Estimated scope:** S

---

### Task 41 — Completion celebration effect + message (M)

**Description:** When a list transitions from `itemCount > 0 AND boughtCount < itemCount` to `boughtCount === itemCount` (all items bought), trigger a celebration: CSS-confetti burst over the page (~2 s, ≤ 30 particles, all positioned absolutely under a non-interactive overlay) + a centered toast with a randomly-picked playful message ("Hai conquistato la spesa! 🛒", "Frigorifero, preparati 🎉", etc., ≥ 5 strings per locale). Auto-dismiss after 2.5 s. Reduced-motion: skip confetti, show message only. Trigger fires at most once per "completion transition" (uncheck + re-check does not re-trigger unless the list went off-complete in between).

**Acceptance criteria:**
- [x] Triggers exactly once when last unchecked item becomes checked (watcher in `ListDetailView` uses `_completeArmed` flag to gate first transition).
- [x] Does NOT trigger on initial mount of an already-fully-checked list (`_completeArmed` starts false).
- [x] Re-arms after any item becomes unchecked.
- [x] Empty list (0 items) never triggers (arm flag only set when `items > 0`).
- [x] Confetti is purely decorative (`aria-hidden`); message has `role="status"` for SR users.
- [x] Reduced-motion: no confetti, message-only.

**Verification:**
- [x] Unit test on `CompletionCelebration`: overlay/message visibility, aria-hidden, role=status, particle count cap (≤30), reduced-motion suppression, 2.5 s auto-dismiss (8 tests in `tests/unit/components/CompletionCelebration.test.ts`).
- [x] Unit test: locale message pools verified ≥ 5 entries per locale (en + it = 7 each).
- [ ] Manual 375 px: add 3 items → check all → confetti + message (pending human verification).

**Dependencies:** Tasks 16, 27.J (haptic + useReducedMotion).

**Files likely touched:** `src/components/ui/CompletionCelebration.vue`, `src/views/ListDetailView.vue`, `src/i18n/locales/{it,en}.json`, tests.

**Estimated scope:** M

---

### Task 42 — Delete account (L)

**Description:** Add a `Delete account` button to `SettingsView` (placed to the **left** of the existing sign-out button, both buttons sharing one horizontal row, same destructive red styling). Trigger uses the standard plain `ConfirmModal` (decision locked — no typed-email gate) with explicit destructive copy stating that all data and the account will be permanently removed. Service `deleteAccount(uid)` performs in order:

1. For each list with `ownerUid === uid`:
   - If `collaboratorUids.length > 1` (shared list): call `transferListOwnership(listId, uid, nextUid)` where `nextUid` is the first non-self collaborator. The list survives under the new admin; the deleted user is dropped from `collaboratorUids` atomically.
   - Else (solo-owned list): call `deleteList(listId)` (purges items + list doc, batched).
2. For each list where `uid` is in `collaboratorUids` but not owner: call `leaveList(listId, uid)`.
3. Delete every doc under `catalog/{uid}/entries/*` in batches of 500.
4. Delete the `users/{uid}` doc.
5. Call `firebaseUser.delete()` on the auth user.
6. Redirect to `/login`.

If step 5 throws `auth/requires-recent-login`, service raises `RequiresRecentLoginError`; UI swaps the confirm modal to a "Please sign in again to confirm" modal whose confirm action calls `reauthenticateGoogle()` then retries `deleteAccount`.

Steps 1–4 are best-effort and must not block step 5 if isolated writes fail (log + continue) — orphaned data is acceptable; the auth identity going away is the hard requirement.

Firestore rules add a dedicated **owner-transfer** branch under `lists/{id}` update: caller must be the current owner, new ownerUid must already be a collaborator, new ownerUid stays in `collaboratorUids`, old owner is removed, `name` + `createdAt` unchanged.

**Acceptance criteria:**
- [x] Button visible in `SettingsView`, **left of the sign-out button on the same row**, requires explicit `ConfirmModal` confirmation.
- [x] On success for a user with no shared owned lists: cascade runs (lists → items deleted, shared-as-guest lists left, catalog purged, `users/{uid}` deleted, Firebase Auth user deleted), redirect to `/login`.
- [x] On success for a user who owns at least one **shared** list: ownership transfers to the first non-self collaborator; that list survives for the remaining collaborators with the new admin; the deleted user is removed from `collaboratorUids`.
- [x] `requires-recent-login` path: service throws `RequiresRecentLoginError`; UI swaps to a re-auth `ConfirmModal` whose confirm action calls `reauthenticateGoogle()` then retries `deleteAccount`.
- [x] Collaborators on previously-owned **solo** lists no longer see those lists (since `deleteList` removes the list doc — moot, no such collaborators exist).
- [x] Rules unit tests cover: self can delete own `users/{uid}` doc; self can delete own catalog entries; self can delete own lists; owner can transfer ownership to existing collaborator (denied for: non-collaborator target, leaving old owner in collaboratorUids, renaming during transfer, non-owner caller). Non-self denied for all cascade self-deletes.

**Verification:**
- [x] Unit test: service orchestration calls each step in order; per-list/catalog/user-doc failures logged + continue; transfer vs. delete vs. leave routing matches list ownership + share state; `requires-recent-login` surfaced as `RequiresRecentLoginError`; other auth errors propagated as-is; 500-entry catalog batches (10 tests in `tests/unit/services/deleteAccount.test.ts`).
- [x] Unit test: `transferListOwnership` writes new ownerUid + `arrayRemove(oldOwner)` + `updatedAt`; throws when old == new (2 tests in `tests/unit/services/lists.collab.test.ts`).
- [x] UI tests: confirm modal flow, cascade trigger, reauth prompt + retry, error message rendering (8 tests in `tests/unit/views/SettingsView.test.ts`).
- [x] Rules test: cross-user delete attempts denied; same-user delete succeeds; owner-transfer branch covers all guard conditions (11 new tests total).
- [ ] Manual via emulator: create user A with one solo + one shared list (with B as collaborator) + catalog usage, run delete → verify: shared list still visible to B with B as admin, solo list + items + A's catalog + A's users doc + A's Firebase Auth user all gone, app at /login.

**Dependencies:** Tasks 7, 25 (deleteList), 27 (rules).

**Files likely touched:** `src/services/auth.service.ts` (`deleteAccount`), `src/views/SettingsView.vue`, `src/stores/auth.ts` (action), `src/i18n/locales/{it,en}.json`, `firebase/firestore.rules` (audit; no new rules expected but verify), `tests/rules/firestore.rules.test.ts`, unit tests.

**Estimated scope:** L — justified: irreversible multi-step cascade across 3 Firestore collections + Firebase Auth + UI gating; bundling avoids leaving the app in a state where the button exists but the cascade is incomplete.

---

### Task 43 — List-name title-case enforcement (S)

`createList` + `renameList` route the input through `capitalizeListName(name)` before write: trims whitespace, uppercases the first character using `toLocaleUpperCase()` (handles `über → Über`, etc.), leaves remaining characters untouched. Duplicate-name guard remains case-insensitive (`normalizeListName`). 5 unit tests on the helper + 4 branches on `createList`/`renameList`.

**Files:** `src/services/lists.service.ts`, `tests/unit/services/lists.service.test.ts`, `tests/unit/services/lists.collab.test.ts`.

---

### Task 44 — Animated hero logo via @vueuse/motion (S)

Shared composable `useLogoMotion()` returns either undefined (when `prefersReducedMotionSync()` is true) or a variant object: spring `enter` (scale + rotate + slide), then `visibleOnce` infinite y-float (±6 px) + sway (±2°). Applied to both `LoginView` and `ListsView` hero logos via `v-motion`. No `hovered`/`tapped` variants — they sticky-interrupt the loop on touch devices.

**Files:** `src/composables/useLogoMotion.ts`, `src/views/LoginView.vue`, `src/views/ListsView.vue`, `src/main.ts` (`app.use(MotionPlugin)`). Dep: `@vueuse/motion` (~34 KB precache delta).

---

### Task 45 — Decorative animations migrated to Lottie (S)

Replaces CSS confetti, animated cart, and SVG placeholders with `.lottie` files rendered through `@lottiefiles/dotlottie-vue` (~320 KB chunk, lazy on routes that use it).

- `CompletionCelebration.vue` → `/animations/success.lottie`, autoplay no-loop, dismiss on `complete` event + 3.5 s fallback timer, `playKey` forces remount on retrigger. Reduced-motion: overlay suppressed entirely.
- `ListsView` empty state → `/animations/empty.lottie` (loop).
- `ListDetailView` empty state → `/animations/cart_empty.lottie` (loop).
- Removed unused `empty-lists.svg` + `empty-items.svg` + old webm placeholders.
- `tests/setup.ts` globally mocks `@lottiefiles/dotlottie-vue` (jsdom has no WASM).

---

### Task 46 — Stats page (M)

New `/stats` route + `BarChart3` entry button in `ListsView` header.

**Domain helpers (catalog-only, no extra Firestore reads):**
- `topUsedItems(entries, limit=10)` — excludes `excluded` + zero-usage, sorts by usageCount desc then name asc.
- `categoryBreakdown(entries)` — sums usageCount per category, computes share, sorts desc.
- `computeTotals(entries, lists, selfUid, FAVORITES_MIN_USES)` — listsCount, uniqueCollaborators (non-self), catalogEntries (excluded skipped), favorites (pinned ∪ usageCount ≥ threshold), totalUsage.

**Components:** `TopItemsChart.vue` (horizontal Bar chart, category-color bars, label = `<icon> name`, tooltip body `<icon> name: count`, no title); `CategoryDonut.vue` (60% cutout, bottom legend with `<icon> name — pct%`, tooltip `<icon> name: pct% (n articoli)` with locale-aware pluralization).

Subscribes to `listsStore` + `catalogStore` on mount. Empty state when `totalUsage === 0`. Loading state respects both stores.

**Deps:** `chart.js` + `vue-chartjs` (~50 KB gz combined; both lazy-loaded via the `/stats` route chunk).

**Files:** `src/domain/stats.ts`, `src/views/StatsView.vue`, `src/components/stats/TopItemsChart.vue`, `src/components/stats/CategoryDonut.vue`, `src/router/index.ts`, `src/views/ListsView.vue`, `src/i18n/locales/{it,en}.json`, 12 domain tests + 5 view tests, global stubs for chart.js + vue-chartjs in `tests/setup.ts`.

---

### Task 47 — Owner-transfer Firestore rule branch (S)

Added under `lists/{id}` update rule: caller is current owner, new ownerUid is already a collaborator and stays in collaboratorUids, old owner removed, `name` + `createdAt` unchanged. Enables `transferListOwnership(listId, oldUid, newUid)` in `lists.service` (writes `ownerUid` + `arrayRemove(oldOwner)` + `updatedAt`) — used by `deleteAccount` cascade for shared owned lists. 5 rules tests + 2 service tests.

---

### Checkpoint L — Phase 11 complete

- [ ] All 10 Phase 11 tasks + 5 follow-ups landed as separate commits (Tasks 33–39 committed; 40 cancelled; 41/42/43/44/45/46/47 staged, pending commit authorization).
- [x] `pnpm test:coverage` exits 0 with 88.4% statements (585 tests passing).
- [x] `pnpm typecheck` and `pnpm build` green; `pnpm lint` clean.
- [x] `pnpm test:rules` green — 45 rules tests including `showFavorites`, `wallpaper`, account-cascade self-delete (6) and owner-transfer (5) branches.
- [ ] Manual smoke at 375 px: auto-reopen on add; grouped shelf with stable order; count title; show-favorites toggle (admin-only); wallpaper random + picker; priority cycle + sort; row settings shortcut; copy + move between lists; completion lottie; delete account flow (emulator); logo bounce + float; stats page (totals + bar + donut); list-name title-case — pending human verification.
- [ ] **Human Verification Recap emitted per protocol; human approval required before commits land on `main`.**

---

## Phase 12 — Production-readiness (legal, SEO, observability, infra)

Locked decisions (2026-05-19):
- **No analytics** at launch. Strictly necessary auth cookies only → no cookie banner.
- **Privacy + Terms** bilingual IT + EN, **hand-written** from Garante Privacy IT template. No paid generator.
- **Error monitoring** via Sentry (free tier 5k events/mo).
- **Public `/about` landing** with `FAQPage` JSON-LD for SEO/GEO.

Sequencing rationale: legal pages + meta tags before any public push; Sentry early so prod errors are captured from day 0; infra hardening (indices, backups, rules deploy) before the first real users.

---

### Task 48 — Public `/about` landing + SEO meta tags (M)

**Description:** New public route `/about` (auth-bypassed in the guard) plus `/privacy` and `/terms` (Task 49). Server-rendered-ish via Vite's `transformIndexHtml` is overkill — instead use `@unhead/vue` (or a hand-rolled `useHead` composable) to inject per-route `<title>`, `<meta name="description">`, OG/Twitter cards, `<link rel="canonical">`, `<html lang>`. Same composable handles `/login` (single-line CTA description) and `/about` (full marketing copy + FAQ JSON-LD).

`/about` content: hero with app name + tagline + screenshot grid (3 screenshots: ListsView, ListDetailView with shelf, StatsView), feature bullets in IT + EN (locale-driven), FAQ block (10 Q&A pairs IT + EN — "Cosa fa Buy The Way?", "Funziona offline?", "Posso condividere una lista?", "I miei dati sono al sicuro?", etc.), CTA button "Accedi" → `/login`. FAQ block emits `<script type="application/ld+json">` with `FAQPage` schema for AI engines + Google rich results.

**Auth guard update:** allow `to.name === 'about' | 'privacy' | 'terms' | 'login'` regardless of auth state. Stay-on-page if already authenticated (don't redirect to /lists) so logged-in users can still read legal pages.

**`robots.txt` + `sitemap.xml`** generated at build time (Vite plugin or static files in `public/`): `Allow: /`, `Allow: /about`, `Allow: /privacy`, `Allow: /terms`, `Allow: /login`. `Disallow:` everything else. Sitemap lists the 5 public URLs with `lastmod` from build date.

**Manifest enrichment:** add `description`, `categories: ["productivity","lifestyle","shopping"]`, `screenshots` array (Android + iOS form factors) for richer Install prompt and future store listings.

**Structured data on `/about`:** `WebApplication` JSON-LD (name, applicationCategory, operatingSystem, offers free, screenshots, author).

**Acceptance criteria:**
- [ ] `/about`, `/privacy`, `/terms` reachable without auth.
- [ ] Logged-in user opening `/about` does NOT get redirected to `/lists`.
- [ ] Each public route has unique `<title>` + `<meta name="description">` (IT + EN switchable via existing locale).
- [ ] `/about` renders `<script type="application/ld+json">` with valid `FAQPage` + `WebApplication` schemas (validated via Google Rich Results Test).
- [ ] `/robots.txt` + `/sitemap.xml` served from prod build.
- [ ] Manifest has `description`, `categories`, `screenshots`.

**Verification:**
- [ ] Unit test: auth guard allows public routes regardless of user state.
- [ ] Unit test: `useHead` (or equivalent) sets correct `<title>` per route + locale.
- [ ] Manual: Lighthouse SEO ≥ 95 on `/about` and `/login` (mobile, slow 4G); Google Rich Results Test passes.

**Files:** `src/views/AboutView.vue`, `src/views/PrivacyView.vue` (Task 49), `src/views/TermsView.vue` (Task 49), `src/composables/useHead.ts`, `src/router/index.ts`, `public/robots.txt`, `public/sitemap.xml` (or Vite plugin), `vite.config.ts` (PWA manifest update), `src/i18n/locales/{it,en}.json`.

**Estimated scope:** M

---

### Task 49 — Privacy Policy + Terms of Service pages (M)

**Description:** Two static views rendering bilingual content from i18n. No legal generator — content written by hand against the Garante Privacy IT template, reviewed against GDPR art. 13 disclosure requirements.

**Privacy Policy must cover:**
1. Data controller identity + contact email (`danielebelfiorepc@gmail.com`).
2. Data collected: Google account email + displayName (auth), list/item content created by the user, catalog usage counts, last-login timestamp, IP + user-agent (Firebase logs), device storage (IndexedDB cache).
3. Legal basis: contract performance (art. 6.1.b GDPR) for service operation; legitimate interest (art. 6.1.f) for security logs.
4. Data processors: Google Ireland (Firebase Auth + Firestore + Hosting). Note SCC for non-EU transfer. Sentry (Functional Software Inc., DPA + SCC in place once Task 50 lands).
5. Retention: indefinite while account is active; full hard-delete on user-initiated account deletion (Task 42); Firebase backup retention (30 days standard).
6. User rights: access, rectification, erasure (already self-service via delete-account), portability, object, restriction, complaint to Garante. How to exercise (email).
7. Children: service not directed to under-16; no age gate but auth via Google enforces account terms.
8. Changes notice: in-app banner on policy update + new `effective-from` date.
9. Date of last update.

**Terms of Service must cover:**
1. Service description + free-of-charge.
2. User responsibilities (no illegal content, no abuse of collaborator-add).
3. Termination: user may delete account anytime; operator may suspend for ToS violation with notice.
4. Liability limitation: provided "as is", no SLA at v1.
5. Governing law: Italy (or operator's country).
6. Dispute resolution: ordinary courts of operator's residence.

**Footer link in `LoginView` + `SettingsView`** linking to `/privacy` and `/terms`. Also linked from `/about`.

**Acceptance criteria:**
- [ ] `/privacy` + `/terms` render in IT and EN.
- [ ] Both pages have anchor links to each section (TOC).
- [ ] Last-update date is sourced from a single i18n constant.
- [ ] Footer link present on `LoginView`, `SettingsView`, `AboutView`.
- [ ] Privacy text explicitly enumerates Firebase + Sentry as data processors with their roles.
- [ ] Privacy text describes the self-service account-deletion flow (Task 42) under "user rights".

**Verification:**
- [ ] Manual review against Garante Privacy IT model document.
- [ ] Manual: full content readable on 375 px without horizontal scroll.

**Files:** `src/views/PrivacyView.vue`, `src/views/TermsView.vue`, `src/i18n/locales/{it,en}.json` (long blocks — likely split into `legal.json` partials), `src/components/ui/LegalFooter.vue`, `src/views/LoginView.vue`, `src/views/SettingsView.vue`.

**Estimated scope:** M — content-heavy but no logic.

---

### Task 50 — Sentry error monitoring (S)

**Description:** Add `@sentry/vue` to capture exceptions in prod only. DSN via `VITE_SENTRY_DSN` env var; init guarded by `import.meta.env.PROD && VITE_SENTRY_DSN` so dev/test never report. Tag releases with `import.meta.env.VITE_RELEASE` (CI sets this from git sha). Configure `tracesSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0` (only on error), `replaysSessionSampleRate: 0`. Mask all input/text in replays — never capture user list content or emails.

Wire to Vue error handler + unhandled promise rejection. Filter out: Firestore offline errors (`unavailable`), auth popup-closed-by-user, network errors when offline-banner is showing.

**Acceptance criteria:**
- [ ] Sentry init only in prod with DSN present.
- [ ] Dev + test never call `Sentry.init` (verified by mocking module + asserting no-op).
- [ ] Release tag set from CI env var.
- [ ] Session replays mask all text + inputs.
- [ ] Filtered errors (offline, popup-closed) do not reach Sentry.
- [ ] Privacy Policy updated (Task 49) to list Sentry as processor.

**Verification:**
- [ ] Unit test: `initSentry()` no-op in test env.
- [ ] Unit test: filter function drops the documented error codes.
- [ ] Manual: throw a synthetic error in prod build, confirm event in Sentry dashboard with masked replay.

**Files:** `src/services/sentry.ts`, `src/main.ts` (call init), `.env.example` (document `VITE_SENTRY_DSN`), CI config (`VITE_RELEASE` from `${{ github.sha }}`).

**Estimated scope:** S

---

### Task 51 — Firestore indices + rules deploy in CI (S)

**Description:** Create `firebase/firestore.indexes.json` describing the composite index needed by `subscribeUserLists`: collection `lists`, fields `collaboratorUids` (`ARRAY_CONTAINS`) + `updatedAt` (`DESCENDING`). Auto-deployed by `firebase deploy --only firestore:indexes,firestore:rules` step in CI.

**CI pipeline addition** (GitHub Actions):
- On main branch push, after tests pass, deploy rules + indices via service-account secret `FIREBASE_TOKEN`.
- Deploy Hosting → already handled by Netlify; this step is Firebase-side only.

**Acceptance criteria:**
- [ ] `firebase/firestore.indexes.json` present with the composite index.
- [ ] CI workflow has a `firebase-deploy` job that runs only on main push, only if test job succeeded.
- [ ] Service account / token stored as repo secret, never in repo.
- [ ] First prod query of `/lists` does not throw "missing index" error.

**Verification:**
- [ ] Manual: deploy to a staging Firebase project, hit `/lists` with ≥ 2 lists, confirm no console error.
- [ ] CI dry-run: `firebase deploy --only firestore:indexes,firestore:rules --dry-run --project=$STAGING`.

**Files:** `firebase/firestore.indexes.json`, `.github/workflows/deploy.yml`, `firebase.json` (verify `firestore.indexes` path).

**Estimated scope:** S

---

### Task 52 — Production environment hardening (S)

**Description:** Operational details for the live launch:

1. **Custom domain on Netlify** — point a DNS A/CNAME to Netlify, enable auto-TLS. Configure HTTPS redirect.
2. **Firebase env vars in Netlify dashboard** — `VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) + `VITE_SENTRY_DSN` + `VITE_RELEASE`. Mark as plain (Firebase web config is public by design; Auth domain restriction is what protects it).
3. **Firebase Auth authorized domains** — add the custom prod domain in Firebase Console → Authentication → Settings → Authorized domains. Without this, Google sign-in fails on prod with `auth/unauthorized-domain`.
4. **Google OAuth consent screen** — verify it's published (not test), branding has app logo + privacy URL + terms URL (Task 49). Required for unrestricted public sign-in.
5. **Firestore quota review** — confirm free Spark tier suffices for early traffic. If signups exceed ~1k MAU, plan upgrade to Blaze (with budget alert).
6. **Scheduled Firestore backups** — `gcloud firestore export gs://<bucket>/$(date +%Y-%m-%d)` via Cloud Scheduler weekly. Retention: 30 days.
7. **Maskable PWA icons** — generate `maskable_icon.png` (512×512 with 80% safe zone) for Android adaptive icons. Add `purpose: "maskable"` entry alongside existing `any` in manifest.
8. **Uptime ping** — UptimeRobot (free) on `/login` every 5 min, alert email on 2+ consecutive failures.

**Acceptance criteria:**
- [ ] Custom domain serves HTTPS, HTTP redirects to HTTPS.
- [ ] Sign-in works on prod domain (no `auth/unauthorized-domain`).
- [ ] OAuth consent screen shows app name + logo + Privacy/Terms URLs.
- [ ] At least one successful manual Firestore export landed in the backup bucket.
- [ ] Maskable icon validated via Maskable.app preview.
- [ ] UptimeRobot dashboard shows green on `/login`.

**Verification:**
- [ ] Manual smoke from a fresh browser profile: open prod URL → sign in → create a list → log out.
- [ ] Open Lighthouse against prod URL, confirm PWA ≥ 90.

**Files:** Netlify dashboard config (no repo files); `firebase.json` (export schedule via Cloud Scheduler config or doc only); `public/manifest.webmanifest` (Vite-generated — update `vite.config.ts` PWA plugin options); `public/maskable_icon.png`.

**Estimated scope:** S — mostly ops, no code beyond manifest icon entry.

---

### Task 53 — Public-route SEO meta + i18n head management (S)

**Description:** Sub-task of Task 48 lifted because it touches the router globally and benefits Task 49 too.

Install `@unhead/vue` (~5 KB gz, official Vue SSR-friendly head manager). Register plugin in `main.ts`. New `useDocumentHead({titleKey, descriptionKey})` composable that watches the i18n locale and rewrites `<title>`, `<meta description>`, `<html lang>`, and OG tags on every locale change.

Public-route metadata table (kept in `src/router/meta.ts`):

| Route | titleKey | descKey |
|---|---|---|
| `/` | `seo.home.title` | `seo.home.description` |
| `/login` | `seo.login.title` | `seo.login.description` |
| `/about` | `seo.about.title` | `seo.about.description` |
| `/privacy` | `seo.privacy.title` | `seo.privacy.description` |
| `/terms` | `seo.terms.title` | `seo.terms.description` |

Authenticated routes get a generic `Buy The Way — <Section>` title; no meta description (uncrawlable anyway).

**Acceptance criteria:**
- [ ] `<title>` reflects current route + locale.
- [ ] Switching locale on `/about` instantly updates `<title>` + `<meta description>` + `<html lang>`.
- [ ] OG image + title set on `/about` and `/login` (uses `public/branding/og-image.png` 1200×630).

**Verification:**
- [ ] Unit test: composable updates head on locale change.
- [ ] Manual: share `/about` URL on WhatsApp/Telegram, preview card renders with image + title.

**Files:** `src/composables/useDocumentHead.ts`, `src/router/meta.ts`, `src/main.ts`, `src/views/*` (call composable in setup), `public/branding/og-image.png`, `src/i18n/locales/{it,en}.json`.

**Estimated scope:** S

---

### Checkpoint M — Phase 12 complete (production-ready)

- [x] 5 / 6 Phase 12 tasks landed (Task 52 deferred — ops-only, no code).
- [x] `pnpm test:coverage` statements 88.21%, branches 80.07%, lines 89.98%, functions 83.94% — all thresholds green (641 tests / 56 files).
- [ ] `pnpm test:rules` still green — run separately against emulator; rules file unchanged this phase.
- [x] `/about`, `/privacy`, `/terms` reachable without auth; logged-in users not redirected away (unit-tested `guard.test.ts`).
- [ ] Google Rich Results Test passes on `/about` (FAQPage + WebApplication schemas) — manual after first deploy.
- [x] `robots.txt` + `sitemap.xml` ship in `public/`.
- [x] `firebase/firestore.indexes.json` declares composite index; `deploy.yml` `firebase-deploy` job wired (needs `FIREBASE_TOKEN` + `VITE_FIREBASE_PROJECT_ID` repo secrets).
- [ ] Sentry receives a synthetic error from prod with masked replay — pending DSN provisioning.
- [ ] Custom domain live with HTTPS; sign-in works; OAuth consent screen published — Task 52 ops.
- [ ] First Firestore backup exported to bucket — Task 52 ops.
- [ ] UptimeRobot green on `/login` — Task 52 ops.
- [ ] Lighthouse on prod URL — manual after first deploy.
- [ ] **Human Verification Recap emitted; human approval before announcing publicly.**

### Phase 12 — Post-feedback UX bundle (2026-05-19, follow-ups)

Eleven small fixes landed after Phase 12 acceptance, grouped here for traceability.

| Fix | Area | Change |
|---|---|---|
| A | `ItemEditSheet` | Label "Aggiungi un articolo" → "Nome" (new `item.name` i18n key). |
| B | `ItemEditSheet` | Removed priority chip row; priority still editable via row cycle. |
| C | `MostUsedShelf` | Whole header is a single button toggling collapse (parity with `CategoryHeader`). |
| D | `stores/catalog.ts` | `suggestionsFor` reads from raw user catalog so custom items survive empty-list. `FAVORITES_MIN_USES` kept at 2. |
| E | `ShelfTile` | Exclude icon `X` → red `Trash2` (consistent with row trash). |
| F | `CategoryHeader` + `MostUsedShelf` | Removed grey `hover:bg-black/5` background; cursor pointer kept. |
| G | `items.service` + `domain/text.ts` | `addItem` + `updateItem` capitalize first character via shared `capitalizeInitial`; `capitalizeListName` re-exported from it. |
| H | `styles/global.css` | Global `cursor: pointer` rule for `button:not(:disabled)`, `[role=button]:not([aria-disabled])`, `a[href]`, `label[for]`. `cursor: not-allowed` for disabled / aria-disabled. |
| I | `ListItemRow` + `domain/public-catalog.ts` | New `isCustomItemName` (locale-agnostic across IT + EN names). Custom items show `UserPlus` lucide badge next to the name. |
| J | `ItemEditSheet` + `ListDetailView` | Custom items show full-width "Rimuovi dai suggerimenti" button + hint; emits `exclude-from-suggestions` → `setCatalogExcluded` cascade. |
| K | `ListItemRow` | Final icon choice for custom badge: `UserPlus` (user + plus) after `Sparkles`/`Pencil` iterations. |

Test impact: 626 tests / 55 files (up from 585). Files added: `src/domain/text.ts`. Files touched: see [todo.md § Phase 12 — Post-feedback UX bundle](./todo.md#phase-12--post-feedback-ux-bundle-2026-05-19).

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Firestore rules misalign with client expectations | High | Write rules + rules-unit-tests in Task 27, before final E2E. Run on every CI build. |
| Realtime sync flakiness in E2E (two contexts) | Medium | Use long-poll fallback in test config; explicit `await expect.toHaveText` with 2 s timeout. |
| Catalog ranking surprises users (wrong "most used") | Medium | Domain ranking has 100% coverage; halfLife (14 d) tuneable; defer changes to v1.x. |
| Logo derivative quality (icons from PNG) | Low | Script regenerates from `logo-original.png` 2816×1536; manual review before Task 28 close. |
| Offline persistence not supported in some Safari versions | Medium | Try/catch around `enableIndexedDbPersistence`; degrade to in-memory cache; banner unchanged. |
| Add-collaborator abuse (mass lookup) | Low | Acknowledged out-of-scope for v1; rate limiting deferred to v1.x via Cloud Function. |
| Soft-delete + purge UX confusion | Low | Two-step confirmation on purge; recovery is single-tap. |
| Phase 11 — wallpaper image weight on cellular | Medium | 10 JPGs in `public/wallpapers/` total ~4 MB; lazy-load picker thumbnails; preload only the assigned wallpaper per card. Consider serving WebP variants in a follow-up. |
| Phase 11 — delete-account leaves orphan data on partial failure | Medium | Best-effort steps 2–5 log + continue; step 6 (auth user delete) is the hard requirement. Document the trade-off in the confirm modal copy. |
| Phase 11 — confetti perf on low-end Android | Low | Cap particles at 30; pure CSS; reduced-motion bypass. |
| Phase 11 — row icon-button density at 360 px | Medium | Audit `ListItemRow` width with priority + settings + trash + future copy/move buttons; collapse into a single overflow menu if hit-target shrinks below 44 px. |
| Phase 12 — privacy text incorrect or incomplete | High | Hand-written from Garante Privacy IT template; cross-check with a lawyer review before announcing. Until reviewed, restrict signups to a closed beta (Firebase Auth user whitelist via authorized domains). |
| Phase 12 — Sentry leaks PII via replay | High | Mask all input + text in replays; never capture network payloads; document filter list. Confirm with synthetic test event before public push. |
| Phase 12 — Google OAuth still in test mode at launch | Medium | Publishing requires app verification by Google (logo, domain, privacy URL, terms URL) which can take days. Submit verification request as soon as Task 49 ships. |
| Phase 12 — missing Firestore composite index | High | Task 51 deploys `firestore.indexes.json`; verify on a fresh staging project that `/lists` query returns without error before pointing prod traffic. |
| Phase 12 — single-region Firestore latency for non-EU users | Low | v1 targets IT users; multi-region Firestore is paid + tied to Blaze plan. Acceptable trade-off until traffic justifies. |

## Open Questions

Phase 11 decisions — all locked (resolved 2026-05-18):

- **Task 35** — `showFavorites` is **admin-only** per-list. Non-admins do not see the toggle.
- **Task 36** — Wallpaper rendered on **`ListsView` cards only**. `ListDetailView` is unchanged.
- **Task 36** — Wallpaper changes propagate to collaborators via Firestore subscription (no opt-in needed).
- **Task 37** — Priority is a **single-button cycle** (none → urgent → optional → none) on `ListItemRow`; the 3-chip selector remains available inside `ItemEditSheet` for direct jumps.
- **Task 39** — Sheet exposes **Copy or Move only** (no other actions). Trigger icon: `ArrowRightLeft` (lucide).
- **Task 40** — Cancelled post-implementation (2026-05-19): cart removed from header on user feedback. CompletionCelebration (Task 41) covers the remaining motion cue.
- **Task 42** — **Plain `ConfirmModal`** for delete-account (no typed-email gate). Destructive copy must spell out that data and account are permanently removed. Owner of a **shared** list transfers ownership to the first non-self collaborator; only **solo-owned** lists are hard-deleted.

## Parallelization Notes

After Phase 0, sequential foundations don't permit much parallelism. Possible parallel work once Phase 5 ships:
- Task 28 (PWA assets) || Task 31 (E2E suite) — independent.
- Within Phase 9: axe per-route checks can be authored in parallel by multiple agents.

## Summary

| Phase | Tasks | Total tasks |
|---|---|---|
| 0 Foundation | 1–6 | 6 |
| 1 Auth + Home | 7–11 | 5 |
| 2 Items CRUD | 12–16 | 5 |
| 3 Shelf | 17–18 | 2 |
| 4 Empty/Remove | 19–20 | 2 |
| 5 Collaborators | 21–25 | 5 |
| 6 Trash | 26 | 1 |
| 7 Settings + Rules | 27 | 1 |
| 7.5 UX / Polish | 27.A–27.J | 11 |
| 8 PWA + Offline | 28–30 | 3 |
| 9 Tests | 31 | 1 |
| 10 Ship | 32 | 1 |
| 11 UX additions | 33–47 | 10 + 5 follow-ups |
| 12 Production-ready | 48–53 | 6 |
| **Total** | | **64 tasks** (1 cancelled — Task 40) |
