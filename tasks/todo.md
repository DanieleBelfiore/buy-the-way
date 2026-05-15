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
- [ ] **Task 6** [M] — Router + auth guard stub + 7 view shells

### Checkpoint A — Foundation
- [ ] lint + typecheck + test:run + build green
- [ ] Dev server boots; `/` redirects to `/login`
- [ ] Emulators boot
- [ ] Domain coverage = 100%
- [ ] **Human approval before Phase 1**

---

## Phase 1 — Sign in + Lists Home

- [ ] **Task 7** [M] — auth.service + users/{uid} upsert on login
- [ ] **Task 8** [S] — auth Pinia store + guard wiring
- [ ] **Task 9** [S] — LoginView (Google CTA only, no Apple)
- [ ] **Task 10** [M] — lists.service: createList + subscribeUserLists
- [ ] **Task 11** [M] — lists Pinia store + ListsView (cards + FAB + empty state)

### Checkpoint B — Auth + Home
- [ ] E2E login → create list → reload → still visible
- [ ] Coverage ≥ 80% on touched files
- [ ] **Human approval before Phase 2**

---

## Phase 2 — List Detail (items CRUD)

- [ ] **Task 12** [M] — items.service + catalog write-through
- [ ] **Task 13** [M] — items Pinia store + realtime subscription
- [ ] **Task 14** [M] — CategoryIcon / CategoryHeader / CategorySection / ListItemRow
- [ ] **Task 15** [L] — ItemAutocomplete (input + keyboard nav + ARIA combobox + custom-item path)
- [ ] **Task 16** [S] — ListDetailView assembly

### Checkpoint C — Items working end-to-end
- [ ] E2E: open list → add → check → reload preserved
- [ ] Two-context realtime < 1 s
- [ ] Coverage ≥ 80% project-wide
- [ ] **Human approval before Phase 3**

---

## Phase 3 — MostUsedShelf

- [ ] **Task 17** [M] — Catalog ranking subscription + top-2 flag
- [ ] **Task 18** [L] — MostUsedShelf component (dense 2-col grid, collapse, dim-in-list, one-tap add)

### Checkpoint D — Shelf shipped
- [ ] Shelf renders + one-tap add works
- [ ] **Human review at 375 px before Phase 4**

---

## Phase 4 — Empty List + Item Removal

- [ ] **Task 19** [M] — EmptyListButton + bulk delete (batched, with confirmation)
- [ ] **Task 20** [S] — Single-item removal (long-press / trash icon)

### Checkpoint E — Item ops complete
- [ ] Add / check / remove / empty all work
- [ ] **Human approval before Phase 5**

---

## Phase 5 — Collaborators + Sharing

- [ ] **Task 21** [S] — users.service.findUserByEmail (normalized)
- [ ] **Task 22** [M] — lists.service: addCollaborator / removeCollaborator / leaveList
- [ ] **Task 23** [M] — AddCollaboratorForm + CollaboratorList (idle/found/not-found, owner vs self)
- [ ] **Task 24** [M] — "New since last visit" badge on home
- [ ] **Task 25** [M] — ListSettingsView (rename + collaborators + soft-delete)

### Checkpoint F — Sharing complete
- [ ] Two-context E2E: share + leave + rename + badge passes
- [ ] **Human approval before Phase 6**

---

## Phase 6 — Trash

- [ ] **Task 26** [M] — TrashView + recover + purge (only hard-delete path)

### Checkpoint G — Trash done
- [ ] Full list lifecycle shipped
- [ ] **Human approval before Phase 7**

---

## Phase 7 — Settings + Firestore Rules

- [ ] **Task 27** [L] — SettingsView (lang/account/logout) + firestore.rules + rules unit tests

### Checkpoint H — Rules locked
- [ ] `pnpm test:rules` green; no unauthorized path
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
| 6 Trash | 1 | 1 |
| 7 Settings + Rules | 1 | 2 |
| 8 PWA + Offline | 3 | 3 |
| 9 Tests | 1 | 2 |
| 10 Ship | 1 | 1 |
| **Total** | **32** | **~31 sessions** |
