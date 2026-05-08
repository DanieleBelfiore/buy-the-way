# Implementation Plan: Buy The Way

> Companion to [SPEC.md](../SPEC.md). Read SPEC first.
> Design source: Claude Design handoff bundle (Editorial Cream / Lovable tokens), single direction A.

## Overview

Mobile-first PWA for shopping lists with real-time sharing. Vue 3 + TS + Vite + Pinia + vue-i18n + Tailwind, Firebase (Auth + Firestore) backend, Netlify hosting. Bilingual it/en. Offline-first via Firestore SDK persistence + Workbox.

This plan slices vertically: each phase delivers a working, testable user-facing increment. Backend is deferred to Phase 4 — UI design system + all 7 views render against in-memory fixtures first, so we can validate visual + interaction design before paying integration cost.

## Architecture Decisions

1. **Vue 3 Composition API + `<script setup>` + TS strict.** No Options API.
2. **Service layer is the only Firebase boundary.** Components/stores never call Firestore SDK directly. Stores subscribe to services and expose typed reactive state.
3. **Domain layer is pure TS.** No I/O in `src/domain/*`. 100% test coverage required.
4. **Tokens-first styling.** `src/styles/tokens.css` owns the design system. Tailwind config extends from those CSS custom properties. No hardcoded hex in components.
5. **Editorial Cream palette wins over logo-derived navy/teal/orange.** SPEC.md branding section to be reconciled in Task 1. Logo stays the brand mark; UI chrome uses Lovable cream/charcoal system.
6. **Single visual direction A.** Versions B/C from design canvas dropped.
7. **No dark mode.** No theme picker in Settings. No dark-aware tokens.
8. **No Apple login.** Google-only sign-in.
9. **MostUsedShelf replaces "Più usati" chip strip.** Dense 2-col CSS grid (3-col on ≥420px), all entries always visible, no overflow scroll, no collapse. Inspired by `.shelf` rules in design output's `btw-tokens.css` (lines 233+). Recency-weighted ranking from `domain/ranking.ts`.
10. **ULID over UUID/auto-id.** All entity IDs lexicographically sortable, time-prefixed, generated client-side via `domain/id.ts`.
11. **Soft delete only.** `deletedAt: number | null`. Hard purge via Cloud Function in v1.x (out of scope v1).
12. **Last-write-wins per item** for offline conflict resolution. Every mutation updates `updatedAt`.
13. **Firebase Auth profile sync** on `onAuthStateChanged` upserts `users/{uid}` for email lookup. No outbound emails ever.
14. **PWA via vite-plugin-pwa + Workbox.** Network-first for Firestore (delegated to Firestore SDK), cache-first for static.
15. **Test pyramid:** Vitest unit (domain, composables, stores) + Vitest integration vs Firestore emulator (services + rules) + Playwright E2E (golden paths including 2-context realtime + offline).
16. **CI gate:** lint + typecheck + test:run + build, all green before merge.

## Dependency Graph

```
                                    SPEC.md (reconcile)
                                          │
                                          ▼
                                   Phase 1: Foundation
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
       Domain types/id              Tokens CSS                    i18n setup
       categories/ranking           Tailwind bridge                (it/en)
              │                           │                           │
              └───────────────┬───────────┴───────────┬───────────────┘
                              ▼                       ▼
                      Pinia stores skel        Router + auth guard
                              │                       │
                              └───────────┬───────────┘
                                          ▼
                                   Phase 2: UI atoms
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                  Brand atoms       Form atoms      List atoms
                  (Wordmark,        (Button,        (CategoryHeader,
                   Avatar,          Input, Chip,    ListItemRow,
                   AvatarStack,     FAB, Toast,     MostUsedShelf,
                   Phone)           Banner)         ItemAutocomplete)
                          │               │               │
                          └───────────────┼───────────────┘
                                          ▼
                                   Phase 3: Views (fixtures)
                                          │
              ┌───────────┬───────────┬───┴──────┬───────────┬───────────┐
              ▼           ▼           ▼          ▼           ▼           ▼
            Login       Lists     ListDetail  ListSettings AddCollab  Trash/Settings/States
                                          │
                                          ▼
                                   Phase 4: Firebase
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                   firebase init    auth.service     users.service
                                          │
                                          ▼
                          lists / items / catalog services
                                          │
                                          ▼
                                  Wire stores → services
                                          │
                                          ▼
                          Firestore rules + indexes
                                          │
                                          ▼
                                   Phase 5: PWA / offline
                                          │
                                          ▼
                                   Phase 6: Tests + CI + deploy
                                          │
                                          ▼
                                   Phase 7: Branding finalize
```

## Phases and Tasks

### Phase 0 — Spec reconciliation

#### Task 1: Reconcile SPEC.md with design output

**Description:** Update SPEC.md to reflect the design handoff: Editorial Cream palette becomes the canonical palette, MostUsedShelf component replaces "Più usati" chip strip references, dark mode and Apple login fully removed, branding tagline + accessibility notes adjusted.

**Acceptance criteria:**
- [ ] `## Branding` palette table replaced with Lovable Editorial Cream tokens (cream `#f7f4ed`, charcoal `#1c1c1c`, offwhite, cream-soft, muted-gray, ring-blue) plus category-icon-only hues from `btw-tokens.css`.
- [ ] Logo treatment note clarified: logo art preserved as brand mark only; UI chrome uses cream/charcoal.
- [ ] Project Structure adds `components/list/MostUsedShelf.vue`.
- [ ] User stories updated: "most used" wording reflects always-visible dense grid, not chip strip.
- [ ] No Apple references anywhere; no `dark`/`light`/`auto` theme references.
- [ ] Add `## Visual Direction` subsection summarizing single-direction commitment (Editorial Cream / Lovable system).

**Verification:**
- [ ] `grep -i "apple" SPEC.md` returns no matches outside category enum.
- [ ] `grep -i "dark mode\|tema\|theme" SPEC.md` returns no UI-feature matches.
- [ ] `grep "MostUsedShelf" SPEC.md` returns matches in Project Structure + user stories.
- [ ] Manual: human reads diff and approves.

**Dependencies:** None.

**Files touched:** `SPEC.md`.

**Estimated scope:** S.

---

### Phase 1 — Foundation

#### Task 2: Project scaffold (Vite + TS + Vue + tooling)

**Description:** Create `package.json`, Vite config, TS configs, ESLint flat config, Prettier, `.gitignore`, `.env.example`, `index.html`. Pin all versions to SPEC.md tech stack table.

**Acceptance criteria:**
- [ ] `pnpm install` succeeds, no peer dep warnings.
- [ ] `pnpm dev` starts Vite at `http://localhost:5173` and renders an empty white page.
- [ ] `pnpm build` produces `dist/` without errors.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes on empty src.
- [ ] `.env.example` documents all `VITE_FIREBASE_*` keys.
- [ ] `.gitignore` covers `node_modules`, `dist`, `.env*` (except `.env.example`), `coverage`, `playwright-report`, `.vite`.

**Verification:**
- [ ] `pnpm install && pnpm typecheck && pnpm lint && pnpm build` end-to-end succeeds.
- [ ] Manual: open `http://localhost:5173`, see empty `#app` mount.

**Dependencies:** Task 1 (palette decisions inform tailwind config).

**Files touched:** `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.env.example`, `index.html`, `src/main.ts`, `src/App.vue` (empty placeholder).

**Estimated scope:** M.

---

#### Task 3: Domain layer (id, types, categories, ranking) + 100% test

**Description:** Implement pure TS domain modules. Includes `newId()` (ULID wrapper), all interfaces from SPEC.md Code Style, `CATEGORIES` array, and `rankByRecency` function with deterministic recency-weighting formula (`score = usageCount * exp(-elapsedDays / halfLife)` with halfLife = 30d).

**Acceptance criteria:**
- [ ] `src/domain/id.ts` exports `newId()` and branded `ULID` type.
- [ ] `src/domain/types.ts` exports `List`, `Item`, `CatalogEntry`, `UserProfile`, `Category` matching SPEC.md.
- [ ] `src/domain/categories.ts` exports `CATEGORIES` (9 enum members) and `i18nKey(cat)` mapper.
- [ ] `src/domain/ranking.ts` exports `rankByRecency(entries, now)` with documented formula; pure function, deterministic.
- [ ] Unit tests cover every branch; 100% line + branch coverage on `domain/*`.

**Verification:**
- [ ] `pnpm test:run domain` passes.
- [ ] `pnpm test:coverage` shows 100% on `src/domain/*`.

**Dependencies:** Task 2.

**Files touched:** `src/domain/{id,types,categories,ranking}.ts`, `tests/unit/domain/{id,types,categories,ranking}.test.ts`.

**Estimated scope:** M.

---

#### Task 4: i18n setup with it/en locales

**Description:** Configure vue-i18n (Composition API mode, no legacy). Port all strings from design package's `i18n.js`, **excluding** `continueApple`, `theme`, `light`, `dark`, `auto`. Add `mostUsedHelp` key explaining always-visible Shelf semantics.

**Acceptance criteria:**
- [ ] `src/i18n/index.ts` exports configured `i18n` instance.
- [ ] `src/i18n/locales/{it,en}.json` parity check: same keys, no missing translations.
- [ ] No `continueApple`, `theme`, `light`, `dark`, `auto` keys.
- [ ] `categories.*` covers all 9 enum values.
- [ ] Functions for plurals (`updatedAgo`, `members`, `deletedAgo`) implemented as JSON template strings using vue-i18n's `@:` and `{count}` syntax (NOT JS callables).

**Verification:**
- [ ] `pnpm typecheck` passes (locale schema typed).
- [ ] Unit test: every key in `it.json` exists in `en.json` and vice-versa (parity test).
- [ ] Unit test: switching locale updates `t('home')` to expected value.

**Dependencies:** Task 2.

**Files touched:** `src/i18n/index.ts`, `src/i18n/locales/it.json`, `src/i18n/locales/en.json`, `src/main.ts` (install plugin), `tests/unit/i18n.test.ts`.

**Estimated scope:** S.

---

#### Task 5: Design tokens CSS + Tailwind bridge

**Description:** Port Lovable + BTW tokens into single `src/styles/tokens.css`. **Drop:** dark-mode token sets, version-B/C tokens. **Add:** `.shelf` block from design output (lines 233+ of `btw-tokens.css`). Configure `tailwind.config.ts` to extend palette/spacing/radius from CSS custom properties so utility classes consume the same tokens.

**Acceptance criteria:**
- [ ] `tokens.css` defines all `:root` custom properties needed by atoms + screens (palette, type scale, spacing 8-base, radii, shadows, category hues).
- [ ] `tokens.css` includes `.phone`, `.statusbar`, `.scroll`, `.home-ind`, `.btn` variants, `.input`, `.chip`, `.divider`, `.label`, `.sec-h`, `.row-card`, `.fab`, `.tabbar`, `.appbar`, `.iconbtn`, `.item`, `.wordmark`, `.banner-offline`, `.toast`, `.shelf` + `.shelf__cell`.
- [ ] No `data-dark` selectors, no version-B/C overrides.
- [ ] `global.css` imports tokens, applies reset, base typography (Hanken Grotesk via Google Fonts).
- [ ] `tailwind.config.ts` extends `theme.colors`, `theme.spacing`, `theme.borderRadius` from CSS custom property references using `withOpacityValue` helper.
- [ ] Design tokens visible: `<button class="btn btn--dark">` renders charcoal pill, `<div class="shelf"><div class="shelf__cell">…</div></div>` renders dense grid.

**Verification:**
- [ ] Manual: dev route `/dev/tokens` (added in Task 7) renders all atoms with correct visual.
- [ ] `pnpm build` produces CSS bundle ≤ 30 KB gzipped.

**Dependencies:** Task 1 (palette decision), Task 2.

**Files touched:** `src/styles/tokens.css`, `src/styles/global.css`, `tailwind.config.ts`, `postcss.config.js`, `src/main.ts` (import styles).

**Estimated scope:** M.

---

#### Task 6: Router + auth guard (mock)

**Description:** vue-router setup with all 7 routes from SPEC. Auth guard uses a temporary mock auth state (boolean ref) until Phase 4 wires Firebase. `/login` is the only public route; everything else redirects to `/login` if `isAuthenticated.value === false`.

**Acceptance criteria:**
- [ ] Routes: `/login`, `/`, `/lists/:id`, `/lists/:id/settings`, `/lists/:id/collaborators/add`, `/trash`, `/settings`.
- [ ] Auth guard redirects unauthenticated traffic to `/login`.
- [ ] `<router-link>` from Lists → ListDetail navigates without full reload.
- [ ] Mock `useAuth` composable exposes `isAuthenticated`, `signIn()`, `signOut()` for use until Phase 4.

**Verification:**
- [ ] Manual: `/` redirects to `/login`. After `signIn()`, `/` renders.
- [ ] Unit test: guard logic given fake routes and auth states.

**Dependencies:** Task 2.

**Files touched:** `src/router/index.ts`, `src/composables/useAuth.ts` (mock impl), `tests/unit/router.test.ts`.

**Estimated scope:** S.

---

#### Task 7: Pinia stores skeleton with fixtures

**Description:** Define `auth`, `lists`, `items`, `catalog` stores with reactive state and CRUD actions backed by in-memory fixtures (loaded from `src/dev/fixtures.ts`). Replace fixtures with services in Phase 4.

**Acceptance criteria:**
- [ ] Each store exports state via `defineStore`, with typed `state`, `getters`, `actions`.
- [ ] `lists.actions.create`, `rename`, `softDelete`, `restore`, `addCollaborator`, `removeCollaborator`, `leave` all mutate in-memory state correctly.
- [ ] `items.actions.add`, `toggleChecked`, `update`, `remove` work.
- [ ] `catalog.actions.recordUse(name, cat)` increments `usageCount` and updates `lastUsedAt`.
- [ ] `auth.actions.signIn/signOut` toggle mock state.
- [ ] Fixtures match design package's sample data (ListsView lists, ListDetail sections, members).

**Verification:**
- [ ] Unit tests: each action's effect on state.

**Dependencies:** Task 3.

**Files touched:** `src/stores/{auth,lists,items,catalog}.ts`, `src/dev/fixtures.ts`, `tests/unit/stores/*.test.ts`.

**Estimated scope:** M.

---

### Checkpoint A — Foundation

- [ ] `pnpm install && pnpm typecheck && pnpm lint && pnpm test:run && pnpm build` all green.
- [ ] Dev server boots, root route redirects to `/login`, `/login` renders bare.
- [ ] Domain coverage = 100%.
- [ ] **Human review and approve before Phase 2.**

---

### Phase 2 — UI atoms (design system)

#### Task 8: Brand atoms

**Description:** Port `Wordmark`, `BTWMark`, `Avatar`, `AvatarStack`, `Phone` (status bar + home indicator frame) from design output. The `Phone` component is used only on a dev route to preview screens at 375×750; production views render full viewport.

**Acceptance criteria:**
- [ ] All five components exist as Vue SFCs with typed props.
- [ ] `Wordmark` accepts `size` prop, renders `BTWMark` + "Buy The Way".
- [ ] `Avatar` supports `tone: 'cream' | 'dark'`, computes initial from `name`.
- [ ] `AvatarStack` renders up to 3 + overflow `+N` chip.

**Verification:**
- [ ] Dev route `/dev/atoms/brand` renders all variants.
- [ ] Vitest snapshot of each component.

**Dependencies:** Task 5.

**Files touched:** `src/components/ui/{Wordmark,BTWMark,Avatar,AvatarStack,Phone}.vue`, `tests/unit/components/ui/*.test.ts`.

**Estimated scope:** S.

---

#### Task 9: Icon set

**Description:** Port the line-icon set from design's `icons.jsx` to a single Vue module exposing each as a tree-shakable named export. Replicate `BTWMark` and `GoogleG` with same paths. **Skip Apple-company icon.**

**Acceptance criteria:**
- [ ] `src/components/ui/icons/index.ts` re-exports each icon as a Vue component.
- [ ] Icons: Plus, Check, X, ArrowL, ArrowR, Search, Settings, Trash, Users, User, Globe, Star, Pencil, More, Wifi, WifiOff, ChevR, ChevD, Box, Restore, Logout, Bell, Cart, Apple (food, not company), Milk, Bread, Bottle, Snow, Spray, Drop, Tag, Heart, Eye.
- [ ] Each icon accepts `size` prop (defaults to 20).
- [ ] No Apple-company icon.

**Verification:**
- [ ] Dev route `/dev/atoms/icons` renders the full grid.
- [ ] Unit test: icons have correct viewBox and stroke attrs.

**Dependencies:** Task 5.

**Files touched:** `src/components/ui/icons/*.vue`, `src/components/ui/icons/index.ts`, `tests/unit/components/icons.test.ts`.

**Estimated scope:** M.

---

#### Task 10: Form atoms

**Description:** Port `.btn`, `.input`, `.chip`, `.fab`, `.banner-offline`, `.toast` as Vue SFCs with typed variants. CSS classes already defined in tokens; SFCs add behavior + props.

**Acceptance criteria:**
- [ ] `Button.vue` props: `variant: 'dark' | 'accent' | 'ghost' | 'cream'`, `full?: boolean`, `disabled?`, default slot, `iconLeft?` slot.
- [ ] `Input.vue` v-model + `iconLeft?` slot + focus-within shadow-focus state.
- [ ] `Chip.vue` variants `'default' | 'cream' | 'dark'`, slot.
- [ ] `FAB.vue` floating action button, slot for icon, `aria-label` required prop.
- [ ] `OfflineBanner.vue` shows when `useOnline()` is false.
- [ ] `Toast.vue` controllable via `useToasts()` composable, auto-dismiss after 4s.

**Verification:**
- [ ] Dev route `/dev/atoms/forms` renders each variant.
- [ ] Unit tests for each component.

**Dependencies:** Task 5, Task 9.

**Files touched:** `src/components/ui/{Button,Input,Chip,FAB,OfflineBanner,Toast}.vue`, `src/composables/{useOnline,useToasts}.ts`.

**Estimated scope:** M.

---

#### Task 11: List atoms (CategoryHeader, ListItemRow, CategoryIcon)

**Description:** Port `.sec-h` based category header, `.item` row with checkbox, and category-icon mapping (icon + hue per Category enum). Item rows must visually demote checked items (opacity 0.5, line-through, sort to bottom of section).

**Acceptance criteria:**
- [ ] `CategoryIcon.vue` renders icon + uses `--cat-{key}` hue.
- [ ] `CategoryHeader.vue` renders icon + i18n label + count `{checked}/{total}`.
- [ ] `ListItemRow.vue` renders checkbox + name + qty; `data-checked` attribute drives strike-through; emits `toggle` event.

**Verification:**
- [ ] Dev route `/dev/atoms/list` renders one category section with mixed checked/unchecked items.
- [ ] Unit tests cover toggle event + visual checked state.

**Dependencies:** Task 5, Task 9.

**Files touched:** `src/components/ui/CategoryIcon.vue`, `src/components/list/{CategoryHeader,ListItemRow}.vue`.

**Estimated scope:** S.

---

#### Task 12: MostUsedShelf component (the new "Lo Scaffale")

**Description:** Replace the design's chip-strip "Più usati" with a dense grid of always-visible cells. Each cell = category icon + product name + usage count. Top entries (top 20% by ranking score) show a small left bar (`data-rank="top"`). Tapping a cell adds the item to the list and switches that cell to "added" state (line-through + check). Mobile layout: 2 columns; ≥420px viewport: 3 columns; ≥640px: 4 columns. **No vertical overflow inside the shelf** — it grows the page; user scrolls page-level.

**Acceptance criteria:**
- [ ] Props: `entries: readonly CatalogEntry[]`, `addedNames?: readonly string[]`, emits `add(entry)`.
- [ ] Renders `entries.length` cells in CSS grid; columns responsive via media queries.
- [ ] Cells sorted by `rankByRecency` score descending.
- [ ] Top 20% (rounded up) get `data-rank="top"` attribute.
- [ ] Cells in `addedNames` get `data-added` and become non-interactive.
- [ ] All cells have `min-height: 44px` (touch-target).
- [ ] Empty state: when `entries.length === 0`, render localized "no most-used yet" copy.
- [ ] No internal scroll; no `overflow: auto`; no collapse/show-more.

**Verification:**
- [ ] Dev route `/dev/atoms/shelf` renders 30 fixture entries; resizing viewport shifts column count.
- [ ] Unit tests: ranking sort, top-20% marker, add event emission, addedNames diff.
- [ ] Visual snapshot at 320, 375, 420, 640px.

**Dependencies:** Task 3 (ranking), Task 5 (.shelf tokens), Task 11 (CategoryIcon).

**Files touched:** `src/components/list/MostUsedShelf.vue`, `src/styles/tokens.css` (responsive cols extension), `tests/unit/components/MostUsedShelf.test.ts`.

**Estimated scope:** M.

---

#### Task 13: ItemAutocomplete component

**Description:** Inline autocomplete input. Below-input dropdown shows up to 6 suggestions: catalog matches + ★ "most used" + + "create custom". Tapping a suggestion adds the item; tapping "create" opens a category picker mini-sheet.

**Acceptance criteria:**
- [ ] Debounced input (200 ms).
- [ ] Suggestions sorted: starUsed > inCatalog > newItem.
- [ ] Keyboard nav: ArrowUp/Down to highlight, Enter to select, Esc to close.
- [ ] aria-listbox + aria-activedescendant per WAI-ARIA combobox pattern.
- [ ] Empty query renders zero suggestions (don't show whole catalog).
- [ ] On select: emits `select(payload)`; payload = `{ kind: 'existing' | 'new', name, category }`.
- [ ] "Create custom" path requires user to pick category before emitting.

**Verification:**
- [ ] Dev route `/dev/atoms/autocomplete` interactive demo.
- [ ] Unit tests: keyboard nav, debounce, accessibility attributes.

**Dependencies:** Task 10 (Input), Task 11 (CategoryIcon).

**Files touched:** `src/components/list/ItemAutocomplete.vue`, `src/composables/useDebouncedRef.ts`, `tests/unit/components/ItemAutocomplete.test.ts`.

**Estimated scope:** M.

---

### Checkpoint B — Atoms ready

- [ ] `/dev/atoms/*` routes render every atom variant correctly at 375 px and 1024 px.
- [ ] All atom unit tests pass.
- [ ] Coverage ≥ 80% on atoms.
- [ ] **Human visual review of `/dev/atoms/*` before Phase 3.**

---

### Phase 3 — Views (fixtures-driven)

#### Task 14: LoginView

**Description:** Editorial hero + Google CTA. **No Apple button.** Top-right language toggle (it ⇄ en).

**Acceptance criteria:**
- [ ] Renders Wordmark, hero headline (i18n), Google CTA button.
- [ ] No Apple button anywhere in the file.
- [ ] Language toggle calls `i18n.global.locale.value = 'en' | 'it'` and re-renders.
- [ ] Tapping Google CTA calls `auth.signIn()` (mock for now).
- [ ] After mock sign-in, route navigates to `/`.

**Verification:**
- [ ] `grep -i "apple" src/views/LoginView.vue` returns nothing.
- [ ] E2E placeholder: `auth.spec.ts` step 1 passes.

**Dependencies:** Tasks 6, 8, 9, 10.

**Files touched:** `src/views/LoginView.vue`.

**Estimated scope:** S.

---

#### Task 15: ListsView (home)

**Description:** Card grid of active lists. Each card: name, member avatar stack, item count, "updated N ago", first 3 preview items, progress bar, optional "nuova" badge. Header has bell + settings icon. Footer chip linking to Trash. FAB → new-list creation modal.

**Acceptance criteria:**
- [ ] All visual fidelity from design `screens-1.jsx > ListsView` (single direction A).
- [ ] Lists ranked by `updatedAt` desc.
- [ ] `isNew` badge shows when list was added since user's last visit (timestamp persisted in localStorage).
- [ ] FAB opens `<NewListSheet>` (bottom sheet); on submit, creates list via store and navigates to detail.
- [ ] Empty state when `lists.length === 0`: shows BTWMark + CTA.
- [ ] Trash chip shows count of soft-deleted lists.

**Verification:**
- [ ] Manual: with 4 fixtures, all render; tap on card navigates to `/lists/:id`.
- [ ] Unit test: badge logic given various timestamp + lastVisit combos.

**Dependencies:** Tasks 7, 8, 9, 10.

**Files touched:** `src/views/ListsView.vue`, `src/components/list/ListCard.vue`, `src/components/list/NewListSheet.vue`, `src/composables/useLastVisit.ts`.

**Estimated scope:** M.

---

#### Task 16: ListDetailView (with MostUsedShelf + Autocomplete)

**Description:** Top app bar (back + title + member stack + count + more menu). Sticky autocomplete input. **MostUsedShelf** as first scrollable section. Then category sections; checked items dim and sort to bottom of their section. Toast surfaces on add/undo.

**Acceptance criteria:**
- [ ] Sticky autocomplete works as user scrolls.
- [ ] MostUsedShelf renders all current user's `CatalogEntry`s, ranked.
- [ ] Tapping a shelf cell calls `items.add(...)`, switches cell to `data-added`, fires "Added to list" toast with Undo.
- [ ] Category sections render in fixed enum order; empty categories hidden.
- [ ] Checked items move to bottom of their section, dimmed, line-through.
- [ ] OfflineBanner appears if `useOnline()` is false.

**Verification:**
- [ ] Manual: full flow with fixtures.
- [ ] Unit test: section sorting + checked item demotion.

**Dependencies:** Tasks 7, 11, 12, 13.

**Files touched:** `src/views/ListDetailView.vue`.

**Estimated scope:** M.

---

#### Task 17: ListSettingsView

**Description:** Rename input (owner only), Stats row, Collaborator list, Add-collaborator entry chip, Leave/Archive buttons.

**Acceptance criteria:**
- [ ] Owner sees: rename + add collab + remove-each-collab + archive button.
- [ ] Collaborator sees: read-only name + read-only collab list + Leave button.
- [ ] Archive triggers `lists.softDelete(id)` + navigates back to home.
- [ ] No theme section anywhere on this view.

**Verification:**
- [ ] Manual with mock owner vs collaborator state.
- [ ] Unit test: visibility of action buttons by role.

**Dependencies:** Tasks 7, 8, 9, 10.

**Files touched:** `src/views/ListSettingsView.vue`, `src/components/collaborators/CollaboratorList.vue`.

**Estimated scope:** M.

---

#### Task 18: AddCollaboratorView (idle / found / not-found)

**Description:** Email input → fake lookup → render correct state UI. No outbound email shown in copy (lookupHint string from i18n).

**Acceptance criteria:**
- [ ] Three visible states reachable: idle, found, not-found.
- [ ] Idle state copy explicitly states "no email is sent" (i18n key `lookupHint` + reinforcing helper card).
- [ ] Found state shows user card + Add button → calls `lists.addCollaborator(uid)` and navigates back.
- [ ] Not-found state shows charcoal error card + disabled Add button.
- [ ] Loading state (between submit and result) shows spinner in Add button.

**Verification:**
- [ ] Manual: simulate with fixture user table.
- [ ] Unit test: state transitions.

**Dependencies:** Tasks 7, 8, 10.

**Files touched:** `src/views/AddCollaboratorView.vue`, `src/components/collaborators/AddCollaboratorForm.vue`.

**Estimated scope:** M.

---

#### Task 19: TrashView

**Description:** List of soft-deleted lists with restore button. Header copy "30-day retention".

**Acceptance criteria:**
- [ ] Renders only lists with `deletedAt !== null`.
- [ ] Restore button calls `lists.restore(id)`; list disappears from view, reappears in home.
- [ ] If empty, render "Trash empty" message.
- [ ] No "delete forever" button in v1 (out of scope).

**Verification:**
- [ ] Manual.
- [ ] Unit test: filter logic.

**Dependencies:** Tasks 7, 8, 9.

**Files touched:** `src/views/TrashView.vue`.

**Estimated scope:** S.

---

#### Task 20: SettingsView (no theme)

**Description:** Account header (avatar + name + email), Language toggle (it/en), Account links (Profile, Notifications, Export, Trash), Logout, Version footer. **No theme section. No light/dark/auto buttons.**

**Acceptance criteria:**
- [ ] Three sections only: Account, Language, Account links.
- [ ] Language buttons reflect active locale; tapping switches.
- [ ] No `theme`/`light`/`dark`/`auto` strings used.
- [ ] Logout calls `auth.signOut()` and navigates to `/login`.

**Verification:**
- [ ] `grep -i "theme\|dark\|light\|auto" src/views/SettingsView.vue` returns no UI matches.
- [ ] Manual.

**Dependencies:** Tasks 7, 8, 10.

**Files touched:** `src/views/SettingsView.vue`.

**Estimated scope:** S.

---

#### Task 21: Global states (offline banner, toast, empty)

**Description:** Wire `OfflineBanner` to all authenticated views. Wire `Toast` host into `App.vue`. Add reusable `<EmptyState>` slot used by Lists, Trash, ListDetail.

**Acceptance criteria:**
- [ ] OfflineBanner appears at top of every protected route when offline; disappears on reconnect with "back online" toast.
- [ ] Toast host renders queued toasts in `App.vue`, max 1 at a time, auto-dismiss 4s.
- [ ] EmptyState component takes `icon`, `title`, `body`, `cta` slots.

**Verification:**
- [ ] Manual: throttle network in DevTools to test offline banner.
- [ ] Unit test: banner visibility logic.

**Dependencies:** Task 10.

**Files touched:** `src/App.vue`, `src/components/ui/EmptyState.vue`.

**Estimated scope:** S.

---

### Checkpoint C — UI complete (fixtures-driven)

- [ ] All 7 views navigable via router.
- [ ] All 4 user mods visibly applied:
  - Single direction (no version B/C styling).
  - No dark mode anywhere.
  - No Apple sign-in button.
  - MostUsedShelf renders dense grid (verified at 320/375/420/640 px).
- [ ] Coverage ≥ 80% project-wide.
- [ ] **Human review of every screen at 375 px before Phase 4.**

---

### Phase 4 — Firebase backend

#### Task 22: Firebase init + emulator config

**Description:** `services/firebase.ts` initializes app, getAuth, getFirestore using `VITE_FIREBASE_*` env. `firebase.json` declares Auth + Firestore emulators on standard ports. `pnpm firebase:emulators` script + setup docs.

**Acceptance criteria:**
- [ ] `pnpm firebase:emulators` boots Auth (9099) + Firestore (8080) + UI (4000).
- [ ] App detects `import.meta.env.DEV` and connects to emulators automatically.
- [ ] Production build connects to real config.

**Verification:**
- [ ] Manual: emulator UI shows running.
- [ ] Smoke test: app starts in dev with emulators, shows network calls to localhost.

**Dependencies:** Task 2.

**Files touched:** `src/services/firebase.ts`, `firebase.json`, `firebase/firestore.rules` (placeholder), `firebase/firestore.indexes.json` (empty), `package.json` (scripts).

**Estimated scope:** S.

---

#### Task 23: auth.service + users sync

**Description:** Implement `signInWithGoogle`, `signOut`, `onAuthStateChanged` listener. On first sign-in, upsert `users/{uid}` document `{ email: lower, displayName, lastLoginAt }`.

**Acceptance criteria:**
- [ ] `signInWithGoogle` returns `Promise<UserProfile>`.
- [ ] `users/{uid}` doc exists after first sign-in; `email` field is lowercased and trimmed.
- [ ] `lastLoginAt` updates on every sign-in.

**Verification:**
- [ ] Integration test against emulator: sign-in creates correct doc.
- [ ] Auth store wires to this service (replaces mock from Task 6).

**Dependencies:** Task 22.

**Files touched:** `src/services/auth.service.ts`, `src/stores/auth.ts`, `tests/unit/services/auth.service.int.test.ts`.

**Estimated scope:** M.

---

#### Task 24: users.service (lookup by email)

**Description:** Single function `findUserByEmail(email)`: queries `users` where `email == lowercased input`, returns `UserProfile | null`.

**Acceptance criteria:**
- [ ] Returns `null` for missing match.
- [ ] Returns `UserProfile` for hit.
- [ ] Throws on Firebase errors (no swallow).

**Verification:**
- [ ] Integration test against emulator with 3 fixture users.

**Dependencies:** Task 23.

**Files touched:** `src/services/users.service.ts`, `tests/unit/services/users.service.int.test.ts`.

**Estimated scope:** S.

---

#### Task 25: lists.service (CRUD + share + soft-delete)

**Description:** All list operations from SPEC: `create`, `rename`, `softDelete`, `restore`, `addCollaborator`, `removeCollaborator`, `leaveList`, `subscribeUserLists`. Each mutation updates `updatedAt`. Adds use `arrayUnion(uid)`, removes use `arrayRemove(uid)`. Owner-only ops checked at service level (defense-in-depth alongside Firestore rules).

**Acceptance criteria:**
- [ ] All 8 functions implemented.
- [ ] `addCollaborator` first calls `users.findUserByEmail`; if null, throws typed error `UserNotRegisteredError`; if found, arrayUnion uid.
- [ ] No outbound email logic anywhere.
- [ ] `subscribeUserLists` returns unsubscribe function.

**Verification:**
- [ ] Integration tests (one per function) against emulator.

**Dependencies:** Task 24.

**Files touched:** `src/services/lists.service.ts`, `tests/unit/services/lists.service.int.test.ts`.

**Estimated scope:** M.

---

#### Task 26: items.service (CRUD + realtime)

**Description:** `subscribeItems`, `addItem`, `toggleChecked`, `updateItem`, `removeItem`. Items live under `lists/{id}/items`. Every write updates `updatedAt`.

**Acceptance criteria:**
- [ ] Subscribe returns unsubscribe; emits ordered list.
- [ ] Toggle update is atomic.
- [ ] Item creation triggers `catalog.recordUse(name, cat)` (fire-and-forget, error logged but not rethrown).

**Verification:**
- [ ] Integration tests against emulator including 2-context realtime convergence.

**Dependencies:** Task 25.

**Files touched:** `src/services/items.service.ts`, `tests/unit/services/items.service.int.test.ts`.

**Estimated scope:** M.

---

#### Task 27: catalog.service (per-user)

**Description:** `recordUse(name, cat)` upserts `catalog/{ownerUid}_{slug}` (private per user). `subscribeCatalog(uid)` for MostUsedShelf data.

**Acceptance criteria:**
- [ ] First record creates doc with `usageCount: 1`, `lastUsedAt: now`.
- [ ] Subsequent records increment `usageCount` and update `lastUsedAt`.
- [ ] Subscribe stream returns ranked entries ready for `MostUsedShelf`.

**Verification:**
- [ ] Integration tests against emulator.

**Dependencies:** Task 25.

**Files touched:** `src/services/catalog.service.ts`, `tests/unit/services/catalog.service.int.test.ts`.

**Estimated scope:** M.

---

#### Task 28: Wire stores to services (replace fixtures)

**Description:** Replace fixture-backed actions in `lists`, `items`, `catalog` stores with real subscriptions to services. Keep fixtures only behind a `import.meta.env.VITE_USE_FIXTURES === '1'` flag for design previews.

**Acceptance criteria:**
- [ ] All 7 views work against emulator with real data.
- [ ] `VITE_USE_FIXTURES=1` still routes to in-memory.
- [ ] Stores expose `loading` and `error` state for UI to consume.

**Verification:**
- [ ] Manual end-to-end against emulator: sign-in → create list → add item → second context sees update.

**Dependencies:** Tasks 23–27.

**Files touched:** `src/stores/{lists,items,catalog,auth}.ts`, `src/dev/fixtures.ts` (kept as fallback).

**Estimated scope:** M.

---

#### Task 29: Firestore security rules + indexes + tests

**Description:** Author `firestore.rules` matching SPEC's data model. Add composite indexes for `users` email lookup and `lists` collaborator queries. Test rules with `@firebase/rules-unit-testing` against emulator.

**Acceptance criteria:**
- [ ] `users/{uid}` read by any authenticated, write only by self.
- [ ] `lists/{id}` read by `ownerUid` or member of `collaboratorUids`.
- [ ] `lists/{id}` write: name/collaboratorUids only by owner; deletion is owner-only soft-delete (`deletedAt` set).
- [ ] Collaborator can self-leave via `arrayRemove(self)` only.
- [ ] `lists/{id}/items/{itemId}` read/write requires being a member (owner or collaborator) of parent list.
- [ ] `catalog/{key}` read/write only by `ownerUid == request.auth.uid`.
- [ ] Composite index: `users` on `email`. `lists` on `ownerUid + updatedAt` and `collaboratorUids array-contains + updatedAt`.
- [ ] Rules tests cover positive + negative cases for every collection.

**Verification:**
- [ ] `pnpm firebase:rules:test` (Firestore rules-unit-testing) passes.
- [ ] Manual: try direct emulator write as wrong user → denied.

**Dependencies:** Tasks 23–27.

**Files touched:** `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `tests/unit/services/firestore.rules.test.ts`.

**Estimated scope:** M.

---

### Checkpoint D — Backend wired

- [ ] Sign-in works end-to-end against emulator.
- [ ] Two browser contexts converge in <1s on list edits.
- [ ] Rules deny all unauthorized access (test suite green).
- [ ] **Human review before Phase 5.**

---

### Phase 5 — PWA + offline

#### Task 30: vite-plugin-pwa + manifest + icons

**Description:** Configure plugin (already in scaffold from Task 2), generate icon set from `public/branding/logo-original.png` (cart-only crop scaled to 192/512/maskable/apple-touch/favicon).

**Acceptance criteria:**
- [ ] `manifest.webmanifest` valid (Lighthouse PWA audit passes).
- [ ] Icons present in `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.ico`.
- [ ] Icon generation scriptable via `pnpm icons:generate` using `sharp` or `pwa-asset-generator`.
- [ ] Theme color `#1c1c1c`, background `#f7f4ed`.

**Verification:**
- [ ] Lighthouse PWA score ≥ 90 on built preview.
- [ ] Install prompt appears on Chrome desktop.

**Dependencies:** Task 2.

**Files touched:** `public/icons/*`, `vite.config.ts` (manifest), `scripts/generate-icons.mjs`, `package.json` (script).

**Estimated scope:** S.

---

#### Task 31: SW registration + update prompt

**Description:** `registerSW.ts` with `onNeedRefresh` and `onOfflineReady` callbacks → toast prompts.

**Acceptance criteria:**
- [ ] First install: "ready to work offline" toast.
- [ ] New SW available: "update available — refresh" toast with action.
- [ ] No silent updates without user consent.

**Verification:**
- [ ] Manual: bump version, build, see update prompt.

**Dependencies:** Tasks 21, 30.

**Files touched:** `src/pwa/registerSW.ts`, `src/main.ts`.

**Estimated scope:** S.

---

#### Task 32: Offline persistence + last-write-wins verification

**Description:** Enable Firestore offline persistence (`enableIndexedDbPersistence`). Test offline edit → reconnect → sync; same-item conflict → newest `updatedAt` wins.

**Acceptance criteria:**
- [ ] Persistence enabled on app boot, errors logged but not blocking.
- [ ] Manual offline edit reflects in UI immediately.
- [ ] Reconnect syncs without duplicates or data loss.
- [ ] Conflict on same item: newer `updatedAt` wins (verified via clock manipulation in test).

**Verification:**
- [ ] Playwright test `offline-sync.spec.ts` passes (set context offline, edit, reconnect, assert sync).
- [ ] Manual conflict test with 2 devices.

**Dependencies:** Task 28.

**Files touched:** `src/services/firebase.ts`, `e2e/offline-sync.spec.ts`.

**Estimated scope:** M.

---

### Checkpoint E — PWA shipped

- [ ] Installable on iOS (Add to Home Screen) and Android.
- [ ] Lighthouse PWA ≥ 90, Performance mobile ≥ 85, Accessibility ≥ 95.
- [ ] Offline E2E green.
- [ ] **Human install + use offline before Phase 6.**

---

### Phase 6 — Tests + CI + deploy

#### Task 33: E2E suite (Playwright)

**Description:** Five spec files: auth, list-crud, collaborators (incl. lookup negative case), share-realtime (2 browser contexts), offline-sync.

**Acceptance criteria:**
- [ ] All five specs pass against emulator.
- [ ] `share-realtime.spec.ts` uses two `browserContext` instances simultaneously.
- [ ] `offline-sync.spec.ts` toggles `context.setOffline(true/false)`.
- [ ] axe accessibility check on every spec.

**Verification:**
- [ ] `pnpm test:e2e` green.

**Dependencies:** Tasks 28, 32.

**Files touched:** `e2e/{auth,list-crud,collaborators,share-realtime,offline-sync}.spec.ts`, `playwright.config.ts`.

**Estimated scope:** L.

---

#### Task 34: GitHub Actions CI

**Description:** `.github/workflows/ci.yml` runs lint + typecheck + test:run + Firebase rules test + build on every PR. `deploy.yml` deploys to Netlify on merge to `main`.

**Acceptance criteria:**
- [ ] CI green on PR.
- [ ] Cache for pnpm + Playwright browsers.
- [ ] Firebase emulator suite spun up in CI for integration tests.
- [ ] Deploy workflow uses `NETLIFY_AUTH_TOKEN` secret.

**Verification:**
- [ ] First green PR.
- [ ] First successful deploy on merge.

**Dependencies:** Tasks 33.

**Files touched:** `.github/workflows/{ci,deploy}.yml`, `netlify.toml`.

**Estimated scope:** M.

---

### Checkpoint F — Ship-ready

- [ ] CI green on `main`.
- [ ] First Netlify deploy live.
- [ ] All Success Criteria from SPEC.md checked.
- [ ] **Human acceptance test on production preview.**

---

### Phase 7 — Branding finalize (parallel-safe with Phase 6)

#### Task 35: Wordmark SVG asset

**Description:** Extract or recreate "BUY THE WAY" wordmark as SVG (no tagline) for in-app header. Used by `Wordmark.vue`.

**Acceptance criteria:**
- [ ] `public/branding/wordmark.svg` ≤ 4 KB.
- [ ] Renders correctly at 14, 18, 32, 64 px.
- [ ] No baked-in fill (uses `currentColor`).

**Verification:**
- [ ] Manual visual at multiple sizes in `/dev/atoms/brand`.

**Dependencies:** Task 8.

**Files touched:** `public/branding/wordmark.svg`, `src/components/ui/Wordmark.vue`.

**Estimated scope:** S.

---

#### Task 36: README + CONTRIBUTING

**Description:** Replace 2-line README with proper project README (quickstart, env setup, scripts, architecture summary, link to SPEC + plan). Add CONTRIBUTING with PR conventions.

**Acceptance criteria:**
- [ ] README sections: Overview, Quickstart, Environment, Scripts, Architecture, Testing, Deployment, License.
- [ ] CONTRIBUTING covers commit message format (conventional), branch naming, PR template link, code review expectations.

**Verification:**
- [ ] New collaborator can clone repo and run `pnpm dev` following README only.

**Dependencies:** Task 2.

**Files touched:** `README.md`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`.

**Estimated scope:** S.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase SDK gzipped size > 200 KB hurts mobile LCP | High | Use modular SDK (`firebase/auth`, `firebase/firestore`); lazy-load Firestore via dynamic import on first authenticated route. |
| `where('email','==')` lookup hits collection scan | Medium | Composite index declared in Task 29; field always lowercased before query. |
| 2-context realtime test flakes in CI | Medium | Use deterministic emulator clock; assert via `waitFor` not fixed timeouts. |
| Offline conflict resolution edge cases (deleting + editing same item) | Medium | Last-write-wins covers most; document remaining edge cases as v1.x backlog; add specific test for delete-vs-edit. |
| Lighthouse perf regression from Hanken Grotesk webfont | Low | Preload one weight only; `font-display: swap`. |
| Apple icon ambiguity (food vs company) | Low | `Apple` icon in icon set is the food icon, used for `fruit_vegetables` category; explicitly named in Task 9; no Apple-company icon ever added. |
| User-defined custom categories pressure to add v1 | Low | Out of scope per SPEC; deflect with backlog ticket. |
| PWA icon generation pipeline drift | Low | Script committed (Task 30) + checksum step in CI (Task 34) so regenerated icons match committed assets. |
| Fact-forcing gate slows multi-file scaffolding sessions | Operational | Acknowledge per-file gate cost when planning sessions; bundle related work into single tasks where possible. |

## Open Questions — RESOLVED

- **Q1.** Should `pnpm firebase:emulators` autoload sample data on boot? — **YES.** Task 22 defines seed script (`firebase/seed.ts` invoked on emulator startup, populates 2 test users + 4 sample lists + items + catalog).
- **Q2.** Custom Netlify domain or default? — **Default `*.netlify.app`.** No custom DNS purchase for v1.
- **Q3.** Error tracking (Sentry/Highlight)? — **Deferred to v1.x.** Not in v1 scope.
- **Q4.** Analytics? — **Never on v1.** May reconsider v1.x.
- **Q5.** Trash auto-purge after 30 days? — **NO.** Not v1, not v1.x. Soft-deleted lists persist indefinitely; manual purge only (future "Delete forever" UX, out of scope here). Implication: Trash can grow unbounded → out of scope tradeoff accepted.

## Parallelization Notes

- Phase 1 tasks 3, 4, 5 are independent of each other (after Task 2). Two agents can fan out.
- Phase 2 atom tasks (8–13) are mostly independent; 12 depends on 11 (CategoryIcon). Parallel-safe in pairs.
- Phase 3 view tasks (14–21) all depend on Phase 2 but are independent of each other → max parallelism.
- Phase 4 tasks 24–27 share `firebase.ts` init; do 22 first, then fan out.
- Phase 7 (Task 35, 36) is independent of Phase 6 entirely — can run in parallel.

## Estimated Calendar

Assuming one focused agent session per S/M task and two for L:

| Phase | S | M | L | Sessions |
|---|---|---|---|---|
| 0 | 1 | 0 | 0 | 1 |
| 1 | 3 | 3 | 0 | 6 |
| 2 | 2 | 4 | 0 | 6 |
| 3 | 4 | 4 | 0 | 8 |
| 4 | 2 | 6 | 0 | 8 |
| 5 | 2 | 1 | 0 | 3 |
| 6 | 0 | 1 | 1 | 3 |
| 7 | 2 | 0 | 0 | 2 |
| **Total** | **16** | **19** | **1** | **~37 sessions** |

## Verification Before Phase 1 Begins

- [ ] Spec (`SPEC.md`) reviewed and approved.
- [ ] This plan reviewed by human.
- [ ] Open questions Q1–Q5 answered (or deferred explicitly).
- [ ] Task 1 (spec reconciliation) approved as the entry point.
