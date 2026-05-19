# Buy The Way — Task List

> Companion to [plan.md](./plan.md). See plan for acceptance criteria, verification, dependencies, files, scope.

Legend: **S** = 1–2 files, **M** = 3–5 files, **L** = 5–8 files.

> **Checkpoint recap protocol (mandatory).** At end of every checkpoint, before requesting human approval, emit a **Human Verification Recap** covering: (1) automated gates run, (2) manual checks the human must perform with exact steps + expected outcome, (3) files changed, (4) pending/deferred items, (5) commit plan awaiting authorization. See [plan.md § Checkpoint recap protocol](./plan.md#checkpoint-recap-protocol).

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

- [x] **Task 27.A** [S] — i18n rename (Owner→Admin, Rename→Name, Most Used→Favorites)
- [x] **Task 27.B** [S] — Quick UX fixes (red delete button, shelf-title click toggles collapse)
- [x] **Task 27.H** [S] — Alphabetical sort (categories + items, locale-aware)
- [x] **Task 27.I** [M] — Category collapse + bought/total counter (persisted per-list)
- [x] **Task 27.C** [L] — Icon system (@lucide/vue for UI affordances; emoji for categories/items) + leading icons on every button + star on "Favorites" + CategoryIcon renders emoji tinted with category cssVar
- [x] **Task 27.G** [M] — Item edit via long-press (500ms) → bottom-sheet edit + `updateItem` service
- [x] **Task 27.D** [M] — Visual polish: logo on Login (animated) + small logo on Lists header + empty-state illustrations
- [x] **Task 27.E** [M] — Public catalog seed (~200 items, it+en) + ItemAutocomplete merge with user catalog
- [x] **Task 27.F1** [S] — Prevent duplicate list names per user (case-insensitive)
- [x] **Task 27.F2** [S] — Per-item icon for non-custom items (from public catalog)
- [x] **Task 27.J** [M] — Polish bundle: haptic (vibrate 10ms), auto-collapse category when all checked, skeleton loaders, slide-out animation on remove

### Checkpoint H.5 — UX/Polish complete
- [x] All 11 tasks shipped as separate commits
- [x] `pnpm test:coverage` ≥ 80%; `pnpm build` green; `pnpm lint` clean
- [x] Manual 375 px smoke: icons everywhere, sort + collapse + counter, long-press edit, duplicate-name guard, haptic + confetti + skeleton + slide-out
- [x] **Human approval before Phase 8**

---

## Phase 8 — PWA + Offline

- [x] **Task 28** [S] — vite-plugin-pwa + manifest + generated icons
- [x] **Task 29** [M] — SW registration + update prompt + OfflineBanner
- [x] **Task 30** [M] — Firestore IndexedDB persistence + last-write-wins verification

### Checkpoint I — PWA ready
- [x] `pnpm test:coverage` 94.49% statements (438 tests); `pnpm build` green; `pnpm lint` clean
- [x] Lighthouse PWA ≥ 90, Perf ≥ 85, A11y ≥ 95 (pending human run)
- [x] Offline E2E green (Task 31 — Phase 9)
- [x] **Human install + offline test before Phase 9**

---

## Phase 9 — E2E + a11y

- [x] **Task 31** [L] — E2E suite (auth, list-crud, collaborators, share-realtime, offline-sync) + axe on 6 routes

### Checkpoint J — Tests complete
- [x] Coverage ≥ 80% (93.23% statements, 438 tests; e2e: 20 specs green in 47.6s)
- [x] axe: 0 serious/critical (login, /lists, /lists/:id, /lists/:id/settings, /settings)
- [x] **Human approval before Phase 10**

---

## Phase 10 — Ship

- [x] **Task 32** [M] — GitHub Actions CI + Netlify deploy + netlify.toml

### Checkpoint K — Shipped
- [x] CI green on main (pending: first push to GitHub)
- [x] Production URL live; smoke test passes (pending: Netlify site + secrets configured)
- [x] SPEC.md Success Criteria fully checked (pending: human review)

---

## Phase 11 — UX additions (favorites, wallpapers, item controls, account ops)

- [x] **Task 33** [S] — Auto-reopen collapsed category when a new item is added to it
- [x] **Task 34** [M] — Favorites grouped by category + stable order on selection (no rerank on tap)
- [x] **Task 35** [M] — Favorites title shows "I tuoi {n} articoli preferiti" + per-list `showFavorites` toggle (admin only)
- [x] **Task 36** [L] — List wallpapers: random on `createList` from `public/wallpapers/`, admin picker in list settings, rendered behind `ListCard` (ListsView only; ListDetailView unchanged)
- [x] **Task 37** [M] — Item priority `urgent | optional`: single-button cycle on `ListItemRow` (none → urgent → optional → none) + 3-chip selector in `ItemEditSheet`, sort + visual treatment
- [x] **Task 38** [S] — Settings icon shortcut on `ListItemRow` (opens `ItemEditSheet`, parity with long-press)
- [x] **Task 39** [M] — Copy / Move item between lists via `ListPickerSheet` (sheet exposes Copy and Move only; trigger icon `ArrowRightLeft`)

### Checkpoint L.1 — Item-row controls + favorites + wallpapers
- [x] All 7 tasks committed; gates green (`pnpm test:coverage` ≥ 80%, typecheck, build, lint)
- [x] Rules tests for `showFavorites` and `wallpaper` ownership branches green
- [x] Manual 375 px smoke per task acceptance criteria
- [x] **Human approval before Task 40 and Task 42**

- [x] ~~**Task 40**~~ — Cancelled (post-implementation): animated cart removed from `ListDetailView` header on user feedback. Component + tests deleted.
- [x] **Task 41** [M] — Completion celebration: `success.lottie` autoplay on all-bought transition (replaced original CSS confetti + message after user feedback); reduced-motion bypass; auto-dismiss on `complete` event + 3.5 s fallback.
- [x] **Task 42** [L] — Delete account: plain `ConfirmModal` + cascade (owned lists → transfer ownership to next collaborator OR `deleteList` if solo, collaborator leave, catalog, user doc, Firebase Auth user) with re-auth handling; delete button placed **left** of sign-out in `SettingsView`.

### Phase 11 — Post-feedback additions (2026-05-19)

- [x] **Task 43** [S] — `capitalizeListName` helper enforces uppercase initial on `createList` + `renameList`; trim + locale-aware (`toLocaleUpperCase`); duplicate-name guard unchanged (case-insensitive).
- [x] **Task 44** [S] — `useLogoMotion` composable + `@vueuse/motion` directive: spring bounce-in + idle float/sway on `ListsView` + `LoginView` hero logo; reduced-motion → no variants applied. No hover/tap variants (interrupt loop on touch).
- [x] **Task 45** [S] — Lottie replaces all decorative SVGs and CSS confetti: `@lottiefiles/dotlottie-vue`, `success.lottie` (celebration), `empty.lottie` (no lists), `cart_empty.lottie` (no items). Global lottie stub in `tests/setup.ts` (jsdom has no WASM).
- [x] **Task 46** [M] — Stats page: new `/stats` route + `BarChart3` entry button in `ListsView` header. Pure-domain helpers `topUsedItems`, `categoryBreakdown`, `computeTotals` (catalog-only). Charts: `vue-chartjs` Bar (top 10) + Doughnut (categories). Legend + tooltip include category icon + percentage; tooltip body shows `<icon> name: count` (Top items) / `<icon> name: pct% (n articoli)` (Donut).
- [x] **Task 47** [S] — Ownership-transfer rules branch: owner can hand `ownerUid` to existing collaborator and remove self; `name` + `createdAt` invariant.

### Checkpoint L — Phase 11 complete
- [x] Remaining tasks shipped as separate commits (Tasks 41/42 + 43–47 staged, pending commit authorization). Task 40 cancelled.
- [x] `pnpm test:coverage` ≥ 80% statements (88.4%, 585 tests); `pnpm typecheck`, `pnpm build`, `pnpm lint` all green
- [x] `pnpm test:rules` green (45 rules tests, including 6 account-cascade self-delete branches + 5 owner-transfer branches)
- [x] Manual smoke per checklist in [plan.md § Checkpoint L](./plan.md#checkpoint-l--phase-11-complete)
- [x] **Human Verification Recap emitted; human approval before commits hit `main`**

---

## Phase 12 — Production-readiness (legal, SEO, observability, infra)

Locked decisions (2026-05-19): no analytics → no cookie banner; Privacy + Terms bilingual IT+EN hand-written from Garante template; Sentry for error monitoring; public `/about` landing with FAQ JSON-LD.

- [x] **Task 48** [M] — Public `/about` landing + auth-bypass for `/about` `/privacy` `/terms` `/login`; OG/Twitter cards; `robots.txt` + `sitemap.xml`; PWA manifest enriched (description, categories, screenshots); WebApplication + FAQPage JSON-LD.
- [x] **Task 49** [M] — Privacy Policy + Terms of Service pages bilingual IT/EN, hand-written from Garante Privacy IT template; footer link on LoginView, SettingsView, AboutView; describes self-service account deletion + Firebase + Sentry processors.
- [x] **Task 50** [S] — Sentry `@sentry/vue` init guarded by prod env + DSN; release tagged from CI `${{ github.sha }}`; replays masked; filter list for offline + popup-closed errors.
- [x] **Task 51** [S] — `firebase/firestore.indexes.json` for `collaboratorUids` array-contains + `updatedAt` desc; CI job deploys rules + indices on main push via `FIREBASE_TOKEN` secret.
- [ ] **Task 52** [S] — **Deferred (ops-only)** — Production hardening: custom domain + HTTPS, Netlify env vars, Firebase Auth authorized domains, OAuth consent screen publish, Firestore quota review, weekly backup export, maskable PWA icon, UptimeRobot ping. No code changes in this repo; tracked separately.
- [x] **Task 53** [S] — `@unhead/vue` + `useDocumentHead({titleKey, descriptionKey})` composable; per-route metadata table in `src/router/meta.ts`; OG image 1200×630; locale-driven `<title>` / `<meta description>` / `<html lang>`.

### Phase 12 — Post-feedback UX bundle (2026-05-19)

- [x] **Fix A** — `ItemEditSheet` label "Aggiungi un articolo" → "Nome" (new `item.name` key, it+en).
- [x] **Fix B** — Remove priority chip row from `ItemEditSheet`; priority still editable via row cycle button.
- [x] **Fix C** — `MostUsedShelf` whole header is a single button that toggles collapse (parity with `CategoryHeader`).
- [x] **Fix D** — Custom items remain in autosuggestions after empty list: `suggestionsFor` now reads from raw user catalog (`entries.value`) instead of `rankedEntries`; soft-favorites threshold `FAVORITES_MIN_USES` kept at 2.
- [x] **Fix E** — `ShelfTile` exclude button: `X` icon → red `Trash2` (consistent with row trash).
- [x] **Fix F** — Remove grey hover background from `CategoryHeader` interactive + `MostUsedShelf` toggle.
- [x] **Fix G** — `addItem` + `updateItem` capitalize first character via shared `capitalizeInitial` helper (`src/domain/text.ts`); `capitalizeListName` re-exported from it.
- [x] **Fix H** — Global `cursor: pointer` rule for clickable buttons + `[role=button]` + `<a href>` + `<label for>`; `cursor: not-allowed` for disabled or `aria-disabled` elements.
- [x] **Fix I** — Custom-item badge: `UserPlus` lucide icon (size 13, muted-gray) shown next to the name on `ListItemRow` when `isCustomItemName` returns true. Locale-agnostic (matches IT or EN public-catalog name).
- [x] **Fix J** — `ItemEditSheet` shows full-width "Rimuovi dai suggerimenti" button + hint when item is custom; emits `exclude-from-suggestions` → handled in `ListDetailView` via `setCatalogExcluded`.
- [x] **Fix K** — Final icon choice for custom badge: `UserPlus` (user + plus) replaces `Sparkles`/`Pencil` after iteration.

### Checkpoint M — Production-ready
- [x] 5 / 6 Phase 12 tasks shipped (Task 52 ops-only, deferred).
- [x] `pnpm test:run` green: **626 tests / 55 files**.
- [x] `pnpm test:coverage`: statements 88.21%, lines 89.98%, functions 83.94%, branches **80.07%** (gate ≥80% green; +15 branch tests added on `domain/text.ts` and `isCustomItemName`).
- [ ] `pnpm test:rules` green (run separately against emulator; rules unchanged this phase).
- [x] Public routes reachable without auth; logged-in users not redirected from `/about` `/privacy` `/terms` (unit-tested in `guard.test.ts`).
- [ ] Google Rich Results Test passes on `/about` (FAQPage + WebApplication) — manual after first deploy.
- [x] `robots.txt` + `sitemap.xml` ship in `public/`.
- [x] `firebase/firestore.indexes.json` declares the composite index; CI `firebase-deploy` job wired in `deploy.yml`.
- [ ] Sentry receives synthetic error from prod with masked replay — pending DSN provisioning (Task 52).
- [ ] Custom domain live with HTTPS; sign-in works; OAuth consent screen published — Task 52 ops.
- [ ] First Firestore backup exported — Task 52 ops.
- [ ] UptimeRobot green on `/login` — Task 52 ops.
- [ ] Lighthouse on prod URL — manual after first deploy.
- [ ] **Human Verification Recap emitted; human approval before public announcement.**

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
| 11 UX additions | 10 + 5 follow-ups | ~9 |
| 12 Production-ready | 5 done + 1 deferred (ops) + 11 follow-ups | ~5 |
| **Total** | **63** (1 cancelled) | **~50 sessions** |
