# Buy The Way — Task List

> Companion to [plan.md](./plan.md). See plan for acceptance criteria, verification steps, dependencies, and file lists.

Legend: **S** = small (1–2 files), **M** = medium (3–5 files), **L** = large (5–8 files).

---

## Phase 0 — Spec reconciliation

- [x] **Task 1** [S] — Reconcile SPEC.md with design output (Editorial Cream, MostUsedShelf, no dark, no Apple) ✓

---

## Phase 1 — Foundation

- [ ] **Task 2** [M] — Project scaffold (Vite + TS + Vue + tooling)
- [ ] **Task 3** [M] — Domain layer (id, types, categories, ranking) + 100% test coverage
- [ ] **Task 4** [S] — i18n setup (it/en, no Apple/dark/light/auto)
- [ ] **Task 5** [M] — Design tokens CSS + Tailwind bridge (single direction A)
- [ ] **Task 6** [S] — Router + auth guard (mock until Phase 4)
- [ ] **Task 7** [M] — Pinia stores skeleton with fixtures

### Checkpoint A — Foundation
- [ ] Lint + typecheck + test:run + build all green
- [ ] Dev server boots, root redirects to /login
- [ ] Domain coverage = 100%
- [ ] Human approval before Phase 2

---

## Phase 2 — UI atoms

- [ ] **Task 8** [S] — Brand atoms (Wordmark, BTWMark, Avatar, AvatarStack, Phone)
- [ ] **Task 9** [M] — Icon set (line icons + GoogleG, no Apple-company icon)
- [ ] **Task 10** [M] — Form atoms (Button, Input, Chip, FAB, OfflineBanner, Toast)
- [ ] **Task 11** [S] — List atoms (CategoryIcon, CategoryHeader, ListItemRow)
- [ ] **Task 12** [M] — MostUsedShelf component (the new "Lo Scaffale")
- [ ] **Task 13** [M] — ItemAutocomplete component

### Checkpoint B — Atoms ready
- [ ] /dev/atoms/* render every variant at 375 px and 1024 px
- [ ] Atom unit tests pass
- [ ] Coverage ≥ 80% on atoms
- [ ] Human visual review before Phase 3

---

## Phase 3 — Views (fixtures-driven)

- [ ] **Task 14** [S] — LoginView (Google CTA only)
- [ ] **Task 15** [M] — ListsView (home + cards + FAB + badge)
- [ ] **Task 16** [M] — ListDetailView (Shelf + autocomplete + sections + toast)
- [ ] **Task 17** [M] — ListSettingsView (rename + collaborators + archive)
- [ ] **Task 18** [M] — AddCollaboratorView (idle / found / not-found)
- [ ] **Task 19** [S] — TrashView
- [ ] **Task 20** [S] — SettingsView (no theme section)
- [ ] **Task 21** [S] — Global states (offline banner, toast, empty)

### Checkpoint C — UI complete
- [ ] All 7 views navigable
- [ ] All 4 user mods visibly applied
  - [ ] Single direction A only
  - [ ] No dark mode anywhere
  - [ ] No Apple sign-in button
  - [ ] MostUsedShelf renders dense always-visible grid
- [ ] Coverage ≥ 80% project-wide
- [ ] Human review of every screen at 375 px

---

## Phase 4 — Firebase backend

- [ ] **Task 22** [S] — Firebase init + emulator config
- [ ] **Task 23** [M] — auth.service + users sync on login
- [ ] **Task 24** [S] — users.service (findUserByEmail)
- [ ] **Task 25** [M] — lists.service (CRUD + share + soft-delete)
- [ ] **Task 26** [M] — items.service (CRUD + realtime + catalog hook)
- [ ] **Task 27** [M] — catalog.service (per-user, recency-weighted)
- [ ] **Task 28** [M] — Wire stores to services (replace fixtures)
- [ ] **Task 29** [M] — Firestore security rules + indexes + emulator tests

### Checkpoint D — Backend wired
- [ ] Sign-in works end-to-end against emulator
- [ ] Two browser contexts converge in <1s on list edits
- [ ] Rules deny all unauthorized access (test suite green)
- [ ] Human review before Phase 5

---

## Phase 5 — PWA + offline

- [ ] **Task 30** [S] — vite-plugin-pwa + manifest + icons (generated from logo)
- [ ] **Task 31** [S] — SW registration + update prompt
- [ ] **Task 32** [M] — Offline persistence + last-write-wins verification

### Checkpoint E — PWA shipped
- [ ] Installable on iOS and Android
- [ ] Lighthouse PWA ≥ 90, Performance mobile ≥ 85, Accessibility ≥ 95
- [ ] Offline E2E green
- [ ] Human install + use offline before Phase 6

---

## Phase 6 — Tests + CI + deploy

- [ ] **Task 33** [L] — E2E suite (auth, list-crud, collaborators, share-realtime, offline-sync) + axe checks
- [ ] **Task 34** [M] — GitHub Actions CI + Netlify deploy

### Checkpoint F — Ship-ready
- [ ] CI green on main
- [ ] First Netlify deploy live
- [ ] All Success Criteria from SPEC.md checked
- [ ] Human acceptance test on production preview

---

## Phase 7 — Branding finalize (parallel-safe with Phase 6)

- [ ] **Task 35** [S] — Wordmark SVG asset
- [ ] **Task 36** [S] — README + CONTRIBUTING

---

## Open Questions — RESOLVED

- [x] **Q1** — Emulator seed script: **YES.** Implement in Task 22.
- [x] **Q2** — Netlify domain: **default `*.netlify.app`.**
- [x] **Q3** — Error tracking: **deferred to v1.x** (not in v1).
- [x] **Q4** — Analytics: **never on v1.**
- [x] **Q5** — Trash auto-purge: **NO** (not v1, not v1.x). Soft-deleted lists persist indefinitely.

---

## Summary

| Phase | Tasks | Sessions est. |
|---|---|---|
| 0 | 1 | 1 |
| 1 | 6 | 6 |
| 2 | 6 | 6 |
| 3 | 8 | 8 |
| 4 | 8 | 8 |
| 5 | 3 | 3 |
| 6 | 2 | 3 |
| 7 | 2 | 2 |
| **Total** | **36** | **~37 sessions** |
