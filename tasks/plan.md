# Implementation Plan: Buy The Way

## Overview

Mobile-first PWA for real-time shared shopping lists. Stack: Vue 3 + TS + Pinia + Firebase (Auth + Firestore) + Vite + vite-plugin-pwa. UI direction: Editorial Cream (single canonical look, no dark mode, no Apple sign-in).

Plan is **vertically sliced**: each phase after Phase 0 ships one complete user-visible capability (auth → list home → list detail → shelf → collaborators → settings → PWA → ship). Foundation (Phase 0) is bottom-up because nothing else can stand without it.

## Architecture Decisions

- **Firestore data model**: `lists/{listId}` with `ownerUid: string` and `collaboratorUids: string[]`; items as subcollection `lists/{listId}/items/{itemId}`; per-user `catalog/{ownerUid}/entries/{entryId}`; global `users/{uid}` (uid, email lowercased, displayName, lastLoginAt) populated on auth.
- **IDs**: ULID via `newId()`; never raw timestamps or non-ordered random.
- **Last-write-wins**: every mutation updates `updatedAt`; conflict resolution is the latest `updatedAt` per item. No CRDT.
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

## Open Questions

None blocking. All v1 decisions locked per SPEC.md "Open Questions".

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
| 8 PWA + Offline | 28–30 | 3 |
| 9 Tests | 31 | 1 |
| 10 Ship | 32 | 1 |
| **Total** | | **32 tasks** |
