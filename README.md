<p align="center">
  <img src="public/branding/logo-original.png" alt="Buy The Way" width="320" />
</p>

<p align="center">
  <em>Mobile-first PWA for real-time shared shopping lists. Built for couples and flatmates.</em>
</p>

<p align="center">
  <a href="https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci-cd.yml"><img src="https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci-cd.yml/badge.svg?branch=main" alt="CI/CD" /></a>
  <img src="https://img.shields.io/badge/tests-1009%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/coverage-80%25%20branches-brightgreen" alt="Coverage" />
  <img src="https://img.shields.io/badge/PWA-installable-blueviolet" alt="PWA" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
</p>

<p align="center">
  <a href="https://buy-the-way.danielebelfiore.dev" target="_blank">Live Web App</a>
</p>

---

## Why

Sharing a grocery list with someone usually means three things: a half-erased note on the fridge, a chat thread full of "did you buy milk?", or yet another generic todo app. Buy The Way is built around three calls only - **add an item**, **check it off**, **share the list** - and stays out of your way otherwise.

The whole UX is tuned for one-handed use at 375 px, in a supermarket, on cellular.

---

## Features

### Core
- **Real-time sync** via Firestore - edits propagate to collaborators in under one second.
- **Offline-first** - IndexedDB persistence keeps lists readable and editable without a connection; changes flush automatically when back online (last-write-wins).
- **Installable PWA** - add to home screen on iOS and Android; works fullscreen with a service worker, app icons, and offline shell.
- **Two sign-in methods** - Google one-tap **and** passwordless email magic link (Firebase Auth). No passwords, no Apple sign-in.
- **Two languages** - Italian and English, switchable at runtime; every UI string is localized.
- **Light + dark theme** - system-following by default, manual override persisted per user.

### Lists & items
- Create lists with auto-uppercased names; duplicate names blocked per user (case-insensitive).
- Item names get an auto-capitalized first character on add and edit (shared `capitalizeInitial` helper).
- Each list gets a **random wallpaper** picked from a curated set; admins can change it.
- Add items via inline autocomplete that merges your personal catalog with a built-in public catalog (~200 entries).
- Items grouped by category, sorted alphabetically (locale-aware), with collapsible sections and a per-category `bought/total` counter.
- **Custom category order per list** - drag-and-drop to reorder categories. Open to all collaborators (not admin-only); persisted in `lists/{listId}.categoryOrder`.
- **Priority cycle**: tap an item's priority chip to cycle `none -> urgent -> optional -> none`; urgent items float to the top, optional drift to the bottom.
- **Per-item photo** - take a picture or pick from library; client-side compressed to photo + thumb (800 px / 200 px JPEG), stored under `lists/{listId}/items/{itemId}/` in Cloud Storage with collaborator-gated rules.
- **Long-press or settings shortcut** opens the edit sheet (name, quantity, note, category, photo, pin to favorites).
- **Custom-item badge**: items not in the public catalog get a `UserPlus` icon and a one-tap "Remove from suggestions" action (sets `excluded` in personal catalog).
- **Copy or Move** an item to another list via a bottom-sheet picker.
- **Empty list** clears all items after confirmation; available when the list is non-empty.

### Bulk + power-user input
- **Bulk paste**: paste a free-form text block (one item per line); category is inferred from the public catalog. Sits inline with the autocomplete, no-background icon button.
- **Bulk select**: long-press to enter selection mode, tap to multi-select, then bulk check / uncheck / move / delete.
- **Voice input** (`useSpeechRecognition`): hold the mic, dictate a list of items, auto-parsed and inserted. Falls back gracefully where Web Speech API is unsupported.

### Undo + safety nets
- **Undo delete** for single and bulk item removal via a toast with countdown (`useUndoDelete`). Tasks chain: a new undo schedule waits for the in-flight commit to settle before starting.
- **Confirm modal** for destructive list-level actions (empty, leave, delete).
- **Account deletion cascade**: solo lists hard-deleted; shared lists transfer ownership to the next collaborator; guest memberships auto-left. Then catalog, profile, photos, FCM tokens, and Firebase Auth identity removed.

### Favorites & catalog
- **Favorites shelf** at the top surfaces your most-used items (recency-weighted, 14-day half-life) for one-tap re-adding.
- Grouped by category, stable in-session order - tapping does NOT rerank under your finger.
- Admin-only per-list toggle to hide the shelf.
- Long-press a favorite to exclude it from suggestions; pin items explicitly from item edit.

### Collaboration
- Add collaborators by email (must be a registered user); they see the list immediately, with a "new" badge on home.
- Owners can rename, change wallpaper, toggle favorites, remove collaborators, and hard-delete the list (irreversible, items + Storage objects purged).
- Collaborators can leave a list themselves.
- **In-app notifications inbox**: server fan-out (`notify-list-event`) writes one doc per recipient into `users/{uid}/notifications/{id}`; clicking the bell in the lists header opens an anchored popover that renders the rows and batch-deletes them in the same tick. No browser notification permission, no service worker. Bodies templated server-side from Firestore so payloads are tamper-proof. Inbox is FIFO-capped at 50 docs per user.

### Settings + account
- `/settings`: locale, theme, email-link sign-in toggle, GDPR data export, account deletion.
- **GDPR data export**: one-tap JSON download of every doc the user owns or collaborates on (lists, items, catalog, profile). Generated client-side, no extra reads beyond what the user already has read-access to.
- **Onboarding tour** for first-time users (`OnboardingTour.vue`), dismissable, persisted in `users/{uid}/private/state.hasSeenOnboarding`.

### Stats
- `/stats` with **totals cards** (lists, unique collaborators, catalog entries, favorites, total purchases), **bar chart** of top 10 items, **donut chart** of category distribution. Client-side from the catalog - zero extra reads.

### Public pages & SEO
- Public routes - `/about`, `/privacy`, `/terms`, `/login` - reachable without auth and not blocked for signed-in users either. Auth-bypass list in `src/router/meta.ts`.
- `/about` renders hero + features + 10-entry FAQ with `WebApplication` and `FAQPage` JSON-LD.
- `/privacy` (9 sections) and `/terms` (6 sections), bilingual content in `src/i18n/locales/legal.{it,en}.json`.
- Per-route SEO via `@unhead/vue` + `useDocumentHead({titleKey, descriptionKey})` - `<title>`, `<meta description>`, `<html lang>`, OG + Twitter tags update reactively on locale change.
- `public/robots.txt` allows public routes only, exposes `Sitemap: /sitemap.xml`.

### Polish
- Hero-logo bounce-in on `LoginView` and `ListsView` via `@vueuse/motion` - respects `prefers-reduced-motion`.
- Lottie celebrations: `success.lottie` plays once when a list is fully bought; `empty.lottie` and `cart_empty.lottie` animate empty states.
- Haptic tick (10 ms vibrate) on add / check / remove on supported devices.
- Skeleton loaders, slide-out animation on remove, auto-collapse when all items in a category are checked.
- Update prompt when a new service worker is available.

### Privacy & data
- Only data collected: account email + displayName + last login, list/item content, catalog usage counts. **No analytics, no third-party error monitoring** (Sentry was removed - see `CONTRIBUTING.md`).
- **Self-service account deletion** with full cascade including the notifications inbox, Storage photos, and Auth identity.
- **Private user state** lives in `users/{uid}/private/state` (onboarding flag, defaults) and is readable/writable only by the owner; the public `users/{uid}` doc keeps only the minimum needed for the email-lookup flow.

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Vue 3 + Composition API | Small bundle, ergonomic, strong TS support |
| Language | TypeScript (`strict`) | Compile-time errors |
| State | Pinia | Vue-native, no boilerplate |
| Build | Vite | Fast HMR, ESM-first |
| Routing | Vue Router 4 | Auth guard on every route |
| Styling | Tailwind CSS + CSS variables | Design tokens in `src/styles/tokens.css` |
| Icons | `@lucide/vue` | Consistent stroke icons |
| Animation | `@vueuse/motion`, `@lottiefiles/dotlottie-vue` | Hero motion + decorative lotties |
| Drag-and-drop | `vue-draggable-plus` | Category reorder |
| Charts | `chart.js` + `vue-chartjs` | Lazy-loaded only on `/stats` |
| i18n | `vue-i18n` | Locale persisted to localStorage |
| Head / SEO | `@unhead/vue` | Reactive `<title>`/`<meta>`/`<html lang>` per route + locale |
| Backend | Firebase Auth + Firestore + Storage | Realtime + offline + rules |
| Serverless | Netlify Functions + `firebase-admin` | Send-invite, find-user, notify-list-event |
| Email | Resend | Transactional invites |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, offline shell |
| Tests | Vitest + Vue Test Utils + Playwright | Unit + component + E2E + Firestore rules |

---

## Getting started

### Prerequisites
- Node 20+ (Node 22 / 24 / 26 also work; the localStorage polyfill in `tests/setup.ts` handles the Node 22+ quirk).
- `pnpm`: `npm i -g pnpm`.
- Firebase CLI for emulators and deploy: `npm i -g firebase-tools`.

### First-time setup

```bash
git clone https://github.com/DanieleBelfiore/buy-the-way.git
cd buy-the-way
pnpm install
cp .env.example .env.local        # fill in your Firebase web config
pnpm dev                          # starts Vite on http://localhost:5173
```

For local Firebase emulators (recommended for development):

```bash
pnpm firebase:emulators           # Auth + Firestore on default ports
pnpm dev                          # in a second terminal
```

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Type-check, build, generate PWA service worker |
| `pnpm build:analyze` | Build with `rollup-plugin-visualizer` output |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `vue-tsc --noEmit` |
| `pnpm test` | Vitest watch mode |
| `pnpm test:run` | Single-shot unit + component tests |
| `pnpm test:coverage` | Coverage report (V8) - branches gate ≥ 80% |
| `pnpm test:e2e` | Playwright against Firebase emulators |
| `pnpm test:e2e:ui` | Playwright with the GUI runner |
| `pnpm test:rules` | Firestore rules tests against the emulator |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm firebase:emulators` | Start Auth + Firestore emulators |
| `pnpm firebase:deploy:rules` | Deploy `firestore.rules` + `firestore.indexes.json` |

---

## Project structure

```
src/
  components/         # Reusable Vue components, grouped by domain
    collaborators/    # AddCollaboratorForm, CollaboratorList
    list/             # ListCard, CategorySection, ListItemRow, ItemEditSheet,
                      # BulkPasteSheet, VoiceAddSheet, PriorityPickerSheet,
                      # ListPickerSheet, WallpaperPicker, MostUsedShelf, ...
    onboarding/       # OnboardingTour
    stats/            # TopItemsChart, CategoryDonut
    ui/               # ConfirmModal, Toast, OfflineBanner, FAB,
                      # UpdatePrompt, InstallPrompt, FeedbackModal, ...
  composables/        # useAuth, useHaptic, useReducedMotion, useDocumentHead,
                      # useBulkSelection, useUndoDelete, useSpeechRecognition,
                      # useImageCompress, useShareApp, useSafeBack, ...
  domain/             # Pure functions + types (no Vue, no Firebase)
    categories.ts     # Category enum, icons, color tokens, migration
    public-catalog.ts # ~200 seeded items (it + en) + isCustomItemName, iconForName
    ranking.ts        # Catalog recency-weighted ranking
    sort.ts           # Locale-aware category + item sorting
    stats.ts          # Top items, category breakdown, totals
    text.ts           # capitalizeInitial helper
    types.ts          # List, Item, CatalogEntry, UserProfile, Locale
    wallpapers.ts     # Wallpaper allow-list + random picker
  i18n/               # vue-i18n + locales/{it,en}.json + locales/legal.{it,en}.json
  router/             # Routes + auth guard + meta.ts (per-route SEO metadata)
  services/           # Firebase wrappers:
                      #   auth, lists, items, catalog, users,
                      #   itemPhotos, notify, notifications, invites,
                      #   listFavorites, export, firebase
  stores/             # Pinia stores (auth, lists, items, catalog,
                      #               listFavorites, theme)
  styles/             # tokens.css + global.css
  views/              # LoginView, ListsView, ListDetailView, ListSettingsView,
                      # SettingsView, StatsView, AboutView, PrivacyView,
                      # TermsView, EmailLinkCallbackView
netlify/
  functions/          # send-invite, find-user, notify-list-event
  functions/_lib/     # Shared rate-limit + firestore-admin helpers
tests/
  rules/              # Firestore security-rule tests (~75 against emulator)
  unit/               # Vitest unit + component tests (~1009)
  e2e/                # Playwright specs
firebase/
  firestore.rules     # Server-side authorization rules
  storage.rules       # Storage rules for per-item photos
  firestore.indexes.json # Composite index: lists.collaboratorUids + updatedAt desc
public/
  branding/           # Logos, wordmark, Google G mark
  animations/         # success.lottie, empty.lottie, cart_empty.lottie
  wallpapers/         # 10 list-card backgrounds
  robots.txt          # Allow public routes + Sitemap pointer
  sitemap.xml         # Public URLs
SPEC.md               # Product spec, scope decisions, success criteria
TODO.md               # Sprint roadmap + delivery checklist
CONTRIBUTING.md       # House rules + invariants
```

---

## Firebase

Auth (Google + email magic link), Firestore, and Storage.

### Required environment variables (build-time, shipped to client)

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Optional:

```bash
VITE_USE_EMULATOR=false           # point the SDK at local emulators
VITE_USE_FIXTURES=0               # in-memory fixtures instead of Firestore
```

### Runtime env vars (Netlify-only, used by serverless functions)

```bash
FIREBASE_SERVICE_ACCOUNT          # JSON service account for firebase-admin
RESEND_API_KEY                    # Transactional email for send-invite
INVITE_FROM_ADDRESS               # e.g. "Buy The Way <noreply@example.com>"
APP_URL                           # e.g. "https://buy-the-way.danielebelfiore.dev"
```

See [.env.example](./.env.example) for the client-side template.

### Firestore data model

| Path | Document |
|---|---|
| `users/{uid}` | `{ uid, email, displayName, lastLoginAt, lastSeenLists? }` (public read for email-lookup, owner-only write) |
| `users/{uid}/private/state` | `{ onboardingSeen?, defaultListId?, lastSeenLists?, lastSeenListMap?, ... }` (owner-only) |
| `users/{uid}/notifications/{id}` | `{ kind, listId, listName, body, senderUid, senderName, itemId?, itemName?, createdAt }` (owner read+delete; server-only write) |
| `lists/{listId}` | `{ id, name, ownerUid, collaboratorUids[], itemCount?, showFavorites?, wallpaper?, categoryOrder?, createdAt, updatedAt }` |
| `lists/{listId}/items/{itemId}` | `{ id, listId, name, quantity, category, note, checked, priority?, photoURL?, thumbURL?, createdByUid, createdAt, updatedAt }` |
| `catalog/{uid}/entries/{entryId}` | `{ id, ownerUid, name, category, usageCount, lastUsedAt, pinned?, excluded? }` |
| `rateLimits/{uid}_{funcName}` | `{ tokens, lastRefillMs }` (server-managed token bucket) |

### Storage layout

```
lists/{listId}/items/{itemId}/photo.jpg   # 800 px JPEG
lists/{listId}/items/{itemId}/thumb.jpg   # 200 px JPEG
```

Rules in `firebase/storage.rules` restrict read/write/delete to list collaborators, cap upload size at 5 MiB, and allow only `image/jpeg | image/png | image/webp` (no SVG - blocks the one-tap XSS vector on a leaked download URL).

### Storage CORS (one-time per bucket)

Browser uploads use `XMLHttpRequest` against the GCS bucket behind Firebase Storage. Without bucket CORS, uploads fail in the console with a preflight error and item photos never persist.

`firebase deploy` ships **rules** only; CORS is configured separately:

```bash
# Authenticate: gcloud auth login  (or use a service account with Storage Admin)
pnpm storage:cors
# or explicitly:
./scripts/apply-storage-cors.sh gs://buy-the-way-2ac6e.firebasestorage.app
```

Origins live in `firebase/storage.cors.json` (production + local Vite). Add a new deploy URL there, re-run the command above, then redeploy Netlify if CSP `img-src` also needs the host.

### Rules summary

- `users/{uid}` public read for email-lookup; private state under `users/{uid}/private/state` owner-only.
- `lists/{listId}` read/write gated on collaborator membership; only owner mutates non-collaborator fields; owner can transfer ownership to an existing collaborator.
- `lists/{listId}/items/{itemId}` inherits collaborator gate via parent `get()`.
- `catalog/{uid}/entries/*` strictly per-user.
- `rateLimits/*` deny all client access; only the serverless functions touch this via the admin SDK.

---

## Deployment

CI/CD is one GitHub Actions workflow - `.github/workflows/ci-cd.yml` - that gates production on every check.

### Pipeline shape

```
                  ┌──────────────┐
                  │  quality     │  (lint • typecheck • unit • build → dist/)
                  ├──────────────┤
push / PR ───────▶│  rules       │  (firestore rules vs. emulator)
                  ├──────────────┤
                  │  e2e         │  (playwright + axe; optional gate)
                  └─────┬────────┘
                        │ all green AND push to main
                        ▼
            ┌──────────────────────────┐
            │  deploy-firebase         │  (firestore rules + storage rules + indices)
            ├──────────────────────────┤
            │  deploy-netlify          │  (uploads dist/ + functions)
            └──────────────────────────┘
```

- Pull-request runs: only `quality`, `rules`, `e2e`. Deploy jobs are gated by `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
- Push-to-main runs: every gate, then both deploys in parallel.
- Deploy jobs include `!cancelled()` in their `if:` so an optionally-skipped `e2e` (gated by `vars.E2E_ENABLED`) does not silently block production. See `.claude/docs/workflow.md` for the rationale.
- The Netlify deploy downloads the `dist/` artefact uploaded by `quality`, so the bytes that pass CI are exactly the bytes that ship.

### GitHub secrets

Repo → Settings → Secrets and variables → Actions.

| Name | Purpose |
|---|---|
| `FIREBASE_TOKEN` | `firebase deploy` token for rules + indices + storage rules |
| `NETLIFY_AUTH_TOKEN` | Netlify Personal Access Token, used by `netlify deploy` |
| `NETLIFY_SITE_ID` | Netlify site API ID (Site settings → General → Site information) |
| `VITE_FIREBASE_API_KEY` | Firebase web SDK config - baked into the build |
| `VITE_FIREBASE_AUTH_DOMAIN` | ditto |
| `VITE_FIREBASE_PROJECT_ID` | ditto |
| `VITE_FIREBASE_STORAGE_BUCKET` | ditto |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ditto |
| `VITE_FIREBASE_APP_ID` | ditto |

`RESEND_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `INVITE_FROM_ADDRESS`, `APP_URL` stay on **Netlify** as runtime env vars for the serverless functions.

### Netlify configuration (one-off)

Since GitHub Actions is the single source of deploys, Netlify must not auto-publish on every git push.

1. Netlify dashboard → Site → **Site settings** → **Build & deploy** → **Continuous deployment**.
2. **Build settings** → **Edit settings** → **Stop builds** (or set Build command to `# no-op` and Publish directory to `dist`).
3. Optional: **Deploy contexts** → **Deploy Previews** → off.
4. Keep the Netlify env vars intact for the serverless functions.
5. Generate a Netlify PAT, store as `NETLIFY_AUTH_TOKEN`.
6. Copy the Site ID, store as `NETLIFY_SITE_ID`.

---

## Release process

End-to-end checklist for shipping a new version to production.

### 1. Pre-release gates (run locally on `main`, working tree clean)

```bash
pnpm install
pnpm run typecheck && pnpm run lint && pnpm test:run && pnpm test:coverage && pnpm test:rules && pnpm test:e2e
```

### 2. Bump the version

```bash
pnpm release:patch                  # bug fixes
pnpm release:minor                  # new features, backwards-compatible
pnpm release:major                  # breaking changes
```

Each `release:*` script bumps `package.json`, creates a `🦄 RELEASE: vX.Y.Z` commit, and adds an annotated tag.

### 3. Push commit + tag

```bash
git push --follow-tags
```

### 4. CI/CD takes over

The `ci-cd.yml` workflow runs every gate then both deploy jobs. Watch at <https://github.com/DanieleBelfiore/buy-the-way/actions>. Typical end-to-end time: 4-6 minutes.

### 5. Verify in production

- Open <https://buy-the-way.danielebelfiore.dev> in a private window.
- DevTools → Application → check the **Service Worker** updated (URL hash changes per build).
- Confirm the floating "new version available" prompt fires for already-installed clients within ~30 s.
- Smoke-test in-app notifications (add an item from a second account, confirm the bell badge on the lists view increments and the popover renders the row).

### 6. Rollback

> Prefer **rolling forward** with a hotfix. Rollback is destructive; only use it within the first few minutes of a bad release.

```bash
# Option A - Netlify "Publish previous deploy" button (UI, instant, recommended)
#   Site → Deploys → click the last green deploy → "Publish deploy"

# Option B - Revert the release commit and ship a follow-up
git revert <hash-of-RELEASE-commit>
pnpm release:patch
git push --follow-tags
```

If rules changed and need rolling back:

```bash
git checkout v<previous-tag> -- firebase/firestore.rules firebase/storage.rules firebase/firestore.indexes.json
pnpm run firebase:deploy:rules
git checkout main -- firebase/firestore.rules firebase/storage.rules firebase/firestore.indexes.json
```

### 7. Hotfix workflow

```bash
git checkout -b hotfix/<short-name> main
# fix, commit
pnpm test:run && pnpm run typecheck && pnpm run lint
git push -u origin hotfix/<short-name>
# PR to main; once merged:
git checkout main && git pull
pnpm release:patch
git push --follow-tags
```

---

## Contributing

This is a personal project shipped as a portfolio piece. Issues and pull requests welcome - open one before starting large changes.

House rules (see `CONTRIBUTING.md` for the full list):

1. Run `pnpm test:run` before pushing; `pnpm test:coverage` before declaring a phase done (branches gate ≥ 80%).
2. New features need at least unit tests covering the happy path.
3. Domain logic stays pure (no Firebase, no Vue) - see `src/domain/*`.
4. UI changes need a manual 375 px smoke note in the PR description.
5. Never commit secrets, service accounts, or `.env.local`.
6. **Never use the em-dash character `—` (U+2014)** anywhere in the repo. Plain ASCII hyphen `-`, colon `:`, or split the sentence.
7. New Firestore collections / Storage paths ship with their rules in the same task (see `.claude/docs/firebase.md`).

---

## License

[MIT](LICENSE).
