# Buy The Way — Task List

> Companion to [plan.md](./plan.md). See plan for acceptance criteria, verification, dependencies, files, scope.

Legend: **S** = 1–2 files, **M** = 3–5 files, **L** = 5–8 files.

---

## Phase 0 — Foundation

- [x] **Task 1** [M] — Project scaffold (Vite + Vue 3 + TS strict + Pinia + router + Tailwind + Vitest + Playwright + ESLint + Prettier)
- [x] **Task 2** [S] — Design tokens CSS + Tailwind bridge + Hanken Grotesk
- [x] **Task 3** [M] — Domain layer (id, types, categories, ranking) — 100% coverage
- [x] **Task 4** [S] — i18n setup (it/en, persisted)
- [x] **Task 5** [M] — Firebase init + emulator config + default-deny rules
- [x] **Task 6** [M] — Router + auth guard stub + 7 view shells

### Checkpoint A — Foundation
- [x] lint + typecheck + test:run + build green
- [x] Dev server boots; `/` redirects to `/login`
- [x] Emulators boot
- [x] Domain coverage = 100%
- [x] **Human approval before Phase 1**

---

## Phase 1 — Sign in + Lists Home

- [x] **Task 7** [M] — auth.service + users/{uid} upsert on login
- [x] **Task 8** [S] — auth Pinia store + guard wiring
- [x] **Task 9** [S] — LoginView (Google CTA only, no Apple)
- [x] **Task 10** [M] — lists.service: createList + subscribeUserLists
- [x] **Task 11** [M] — lists Pinia store + ListsView (cards + FAB + empty state)

### Checkpoint B — Auth + Home
- [x] E2E login → create list → reload → still visible
- [x] Coverage ≥ 80% on touched files
- [x] **Human approval before Phase 2**

---

## Phase 2 — List Detail (items CRUD)

- [x] **Task 12** [M] — items.service + catalog write-through
- [x] **Task 13** [M] — items Pinia store + realtime subscription
- [x] **Task 14** [M] — CategoryIcon / CategoryHeader / CategorySection / ListItemRow
- [x] **Task 15** [L] — ItemAutocomplete (input + keyboard nav + ARIA combobox + custom-item path)
- [x] **Task 16** [S] — ListDetailView assembly

### Checkpoint C — Items working end-to-end
- [x] E2E: open list → add → check → reload preserved
- [x] Two-context realtime < 1 s
- [x] `pnpm test:coverage` exits 0; 99.1% statements; 0 stderr warnings (180 tests)
- [x] **Human approval before Phase 3**

---

## Phase 3 — MostUsedShelf

- [x] **Task 17** [M] — Catalog ranking subscription + top-2 flag
- [x] **Task 18** [L] — MostUsedShelf component (dense 2-col grid, collapse, dim-in-list, one-tap add)

### Checkpoint D — Shelf shipped
- [x] Shelf renders + one-tap add works (unit-tested; wired in ListDetailView)
- [x] `pnpm test:coverage` exits 0; 99.21% statements; ranking domain still 100%; MostUsedShelf+ShelfTile 100%
- [x] **Human review at 375 px before Phase 4**

---

## Phase 4 — Empty List + Item Removal

- [x] **Task 19** [M] — EmptyListButton + bulk delete (batched, with confirmation)
- [x] **Task 20** [S] — Single-item removal (long-press / trash icon)

### Checkpoint E — Item ops complete
- [x] Add / check / remove / empty all work (unit-tested; E2E pending human verification)
- [x] **Human approval before Phase 5**

---

## Phase 5 — Collaborators + Sharing

- [x] **Task 21** [S] — users.service.findUserByEmail (normalized)
- [x] **Task 22** [M] — lists.service: addCollaborator / removeCollaborator / leaveList
- [x] **Task 23** [M] — AddCollaboratorForm + CollaboratorList (idle/found/not-found, owner vs self)
- [x] **Task 24** [M] — "New since last visit" badge on home
- [x] **Task 25** [M] — ListSettingsView (rename + collaborators + soft-delete)

### Checkpoint F — Sharing complete
- [x] All 5 tasks unit-tested; coverage 98.77% statements (315 tests); build green
- [x] Two-context E2E: share + leave + rename + badge (pending human verification)
- [x] **Human approval before Phase 6**

---

## Phase 6 — Trash — **CANCELLED**

Scope removed: list deletion is now an immediate hard-delete from List settings (purges items + list doc). No soft-delete, no trash, no recovery. Decision: trash is not a useful feature for the product's scale; the irreversible-confirm modal is sufficient safety.

- ~~Task 26 — TrashView + recover + purge~~ (removed)

---

## Phase 7 — Settings + Firestore Rules

- [x] **Task 27** [L] — SettingsView (lang/account/logout) + firestore.rules + rules unit tests

### Checkpoint H — Rules locked
- [x] `pnpm test:rules` green (30 rules tests pass against emulator); no unauthorized path
- [x] **Human approval before Phase 7.5**

---

## Phase 7.5 — UX / Polish (pre-PWA)

- [ ] **Task 27.A** [S] — i18n rename (Owner→Admin, Rename→Name, Most Used→Favorites)
- [ ] **Task 27.B** [S] — Quick UX fixes (red delete button, shelf-title click toggles collapse)
- [ ] **Task 27.H** [S] — Alphabetical sort (categories + items, locale-aware)
- [ ] **Task 27.I** [M] — Category collapse + bought/total counter (persisted per-list)
- [ ] **Task 27.C** [L] — Icon system (lucide-vue-next) + leading icons on every button + star on "Favorites" + CategoryIcon replaces color dot
- [ ] **Task 27.G** [M] — Item edit via long-press (500ms) → bottom-sheet edit + `updateItem` service
- [ ] **Task 27.D** [M] — Visual polish: logo on Login (animated) + small logo on Lists header + empty-state illustrations
- [ ] **Task 27.E** [M] — Public catalog seed (~200 items, it+en) + ItemAutocomplete merge with user catalog
- [ ] **Task 27.F1** [S] — Prevent duplicate list names per user (case-insensitive)
- [ ] **Task 27.F2** [S] — Per-item icon for non-custom items (from public catalog)
- [ ] **Task 27.J** [M] — Polish bundle: haptic (vibrate 10ms), confetti on all-done, skeleton loaders, slide-out animation on remove

### Checkpoint H.5 — UX/Polish complete
- [ ] All 11 tasks shipped as separate commits
- [ ] `pnpm test:coverage` ≥ 80%; `pnpm build` green; `pnpm lint` clean
- [ ] Manual 375 px smoke: icons everywhere, sort + collapse + counter, long-press edit, duplicate-name guard, haptic + confetti + skeleton + slide-out
- [ ] **Human approval before Phase 8**

---

## Phase 8 — PWA + Offline

- [ ] **Task 28** [S] — vite-plugin-pwa + manifest + generated icons
- [ ] **Task 29** [M] — SW registration + update prompt + OfflineBanner
- [ ] **Task 30** [M] — Firestore IndexedDB persistence + last-write-wins verification

### Checkpoint I — PWA ready
- [ ] Lighthouse PWA ≥ 90, Perf ≥ 85, A11y ≥ 95
- [ ] Offline E2E green
- [ ] **Human install + offline test before Phase 9**

---

## Phase 9 — E2E + a11y

- [ ] **Task 31** [L] — E2E suite (auth, list-crud, collaborators, share-realtime, offline-sync) + axe on 6 routes

### Checkpoint J — Tests complete
- [ ] Coverage ≥ 80%
- [ ] axe: 0 serious/critical
- [ ] **Human approval before Phase 10**

---

## Phase 10 — Ship

- [ ] **Task 32** [M] — GitHub Actions CI + Netlify deploy + netlify.toml

### Checkpoint K — Shipped
- [ ] CI green on main
- [ ] Production URL live; smoke test passes
- [ ] SPEC.md Success Criteria fully checked

---

## Summary

| Phase | Tasks | Sessions est. |
|---|---|---|
| 0 Foundation | 6 | 5 |
| 1 Auth + Home | 5 | 4 |
| 2 Items CRUD | 5 | 5 |
| 3 Shelf | 2 | 2 |
| 4 Empty/Remove | 2 | 1 |
| 5 Collaborators | 5 | 5 |
| ~~6 Trash~~ | ~~1~~ | — cancelled |
| 7 Settings + Rules | 1 | 2 |
| 7.5 UX / Polish | 11 | ~6 |
| 8 PWA + Offline | 3 | 3 |
| 9 Tests | 1 | 2 |
| 10 Ship | 1 | 1 |
| **Total** | **42** | **~36 sessions** |
