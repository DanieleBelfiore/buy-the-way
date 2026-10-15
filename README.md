<p align="center">
  <img src="public/branding/logo-original.png" alt="Buy The Way" width="320" />
</p>

<p align="center">
  <em>Mobile-first PWA for real-time shared shopping lists. Built for couples and flatmates.</em>
</p>

<p align="center">
  <a href="https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci-cd.yml"><img src="https://github.com/DanieleBelfiore/buy-the-way/actions/workflows/ci-cd.yml/badge.svg?branch=main" alt="CI/CD" /></a>
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/DanieleBelfiore/737a93d16a10bb3e1f7165ec817a87ab/raw/buy-the-way-coverage.json" alt="Coverage" />
  <img src="https://img.shields.io/badge/PWA-installable-blueviolet" alt="PWA" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT" />
</p>

<p align="center">
  <a href="https://buytheway.app" target="_blank">Live Web App</a>
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
- **Light + dark theme** - light by default, dark selectable in Settings; the choice is stored on the device.

### Lists & items
- Create lists with an auto-capitalized first letter; duplicate names blocked per user (case-insensitive).
- Item names get an auto-capitalized first character on add and edit (shared `capitalizeInitial` helper).
- Each list gets a **random wallpaper** picked from a curated set; admins can change it.
- Add items via inline autocomplete that merges your personal catalog with a built-in public catalog (~1,000 entries, Italian + English names).
- Items grouped by category, sorted alphabetically (locale-aware), with collapsible sections and a per-category `bought/total` counter.
- **Custom category order per list** - drag-and-drop to reorder categories. Open to all collaborators (not admin-only); persisted in `lists/{listId}.categoryOrder`.
- **Priority cycle**: tap an item's priority chip to cycle `none -> urgent -> optional -> none`; urgent items float to the top, optional drift to the bottom.
- **Per-item photo** - take a picture or pick from library; client-side compressed to photo + thumb (800 px / 200 px JPEG), stored under `lists/{listId}/items/{itemId}/` in Cloud Storage with collaborator-gated rules.
- **Long-press or settings shortcut** opens the edit sheet (name, quantity, note, category, photo, pin to favorites).
- **Custom-item badge**: items not in the public catalog get a `UserPlus` icon.
- **Copy or Move** an item to another list via a bottom-sheet picker.
- **Empty list** asks whether to clear every item or only the checked ones; a snapshot goes to the list history first.

### Bulk + power-user input
- **Bulk paste**: paste a free-form text block (one item per line); category is inferred from the public catalog. Sits inline with the autocomplete, no-background icon button.
- **Bulk select**: long-press to enter selection mode, tap to multi-select, then bulk move / copy / delete.
- **Voice input** (`useSpeechRecognition`): hold the mic, dictate a list of items, auto-parsed and inserted. Falls back gracefully where Web Speech API is unsupported.

### Undo + safety nets
- **Undo delete** for single and bulk item removal via a toast with countdown (`useUndoDelete`). Tasks chain: a new undo schedule waits for the in-flight commit to settle before starting.
- **Confirm modal** for destructive list-level actions (empty, leave, delete).
- **Account deletion cascade**: solo lists hard-deleted; shared lists transfer ownership to the next collaborator; guest memberships auto-left. Then catalog, profile, photos, notifications inbox, and Firebase Auth identity removed.

### Favorites & catalog
- **Favorites shelf** per list surfaces the items most used in that list (recency-weighted, 30-day half-life, at least 2 uses, up to 60 entries, `src/domain/ranking.ts`) for one-tap re-adding. State lives in `lists/{listId}/favoriteState/{slug}`, shared by the list's collaborators.
- Grouped by category, stable in-session order - tapping does NOT rerank under your finger.
- Each favorite has an exclude action that removes it from this list's suggestions (`excluded`); pin items explicitly from item edit.
- Autocomplete suggestions come from your personal catalog (`catalog/{uid}/entries`) plus the public catalog.

### Collaboration
- Add collaborators by email: registered users see the list immediately, with a "new" badge on home; other addresses get a branded invite email (`send-invite`) and join on their first sign-in (`pendingInviteEmails`).
- **Admins** (`lists/{listId}.admins`) can rename, change wallpaper, remove collaborators, promote / demote admins, transfer ownership and hard-delete the list (irreversible, items + Storage objects purged). A list always keeps at least one admin.
- Collaborators can leave a list themselves.
- **In-app notifications inbox**: server fan-out (`notify-list-event`) writes one doc per recipient into `users/{uid}/notifications/{id}`; clicking the bell in the lists header opens an anchored popover that renders the rows and batch-deletes them in the same tick. No browser notification permission, no service worker. Bodies templated server-side from Firestore so payloads are tamper-proof. Inbox is FIFO-capped at 50 docs per user. **Currently switched off** (`FEATURES.notifications = false` in `src/domain/features.ts`) and slated for removal, see `tasks/todo.md`.

### Settings + account
- `/settings`: theme, language, share the app, feedback, GDPR data export, sign out, account deletion.
- **GDPR data export**: one-tap JSON download of the user's data: profile + private state, every list they own or collaborate on with its items, favorites state and history, and the personal catalog. Generated client-side, no reads beyond what the user already has read-access to.
- **Onboarding tour** for first-time users (`OnboardingTour.vue`), dismissable, persisted in `users/{uid}/private/state.onboardingSeen`.

### Stats
- `/stats` with **totals cards** (lists, unique collaborators, catalog entries, favorites, total purchases), **bar chart** of top 10 items, **donut chart** of category distribution. Client-side from the catalog - zero extra reads.

### Public pages & SEO
- Public routes - `/about`, `/privacy`, `/terms`, `/login` - reachable without auth and not blocked for signed-in users either. Auth-bypass list in `src/router/meta.ts`.
- `/about` renders hero + features + 10-entry FAQ with `WebApplication` and `FAQPage` JSON-LD.
- `/privacy` (9 sections) and `/terms` (7 sections), bilingual content in `src/i18n/locales/legal.{it,en}.json`.
- Per-route SEO via `@unhead/vue` + `useDocumentHead({titleKey, descriptionKey})` - `<title>`, `<meta description>`, `<html lang>`, OG + Twitter tags update reactively on locale change.
- `public/robots.txt` allows public routes only (app routes and `/oauth/` disallowed) and points to `https://buytheway.app/sitemap.xml`.

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

## MCP server (AI assistants)

Buy The Way exposes a remote [Model Context Protocol](https://modelcontextprotocol.io) server at `https://buytheway.app/mcp`, so an AI assistant can read and edit your lists for you: "what is missing in Spesa?", "add what I need for a carbonara for 6", "move milk and bread to Weekend".

> **Private beta.** Only accounts listed in the Firestore doc `config/mcp` (`allowedUids`) can connect; everyone else sees "not available yet" on the consent screen. Setting `open: true` there opens it to all users, no deploy needed.

### Connect

**claude.ai (recommended)**: one connector covers claude.ai, the Claude desktop and mobile apps, and Claude Code signed in with the same account.

1. On [claude.ai](https://claude.ai), open Settings -> Connectors -> **Add custom connector**.
2. Name it `Buy The Way` and set the URL to `https://buytheway.app/mcp`. Keep the detected defaults: Authentication **Sign in now**, OAuth client **Register automatically** (the server supports dynamic client registration, not Claude's published identity), no request headers.
3. Click **Connect**: the Buy The Way sign-in and consent screen opens. Sign in, choose **Allow**, and you are back in Claude.
4. In a chat, turn the connector on from the tools menu (the `+` button under the message box).

**Claude Code only** (for example when Claude Code runs with an API key instead of a claude.ai account):

```bash
claude mcp add --scope user --transport http buy-the-way https://buytheway.app/mcp
```

Then run `/mcp` inside Claude Code, pick `buy-the-way` and choose **Authenticate**. Do not add both: with the claude.ai connector active, Claude Code would list the tools twice.

Any other client that supports remote MCP over Streamable HTTP with OAuth works the same way.

**Disconnect** an assistant from the app: Settings -> Connected apps -> Disconnect. Deleting the account disconnects every assistant. What an assistant can access is described in the privacy policy (`/privacy`, section "AI assistants").

### What the assistant can do

| Tool | What it does |
|---|---|
| `list_lists` | Your lists and shared lists, with item counts |
| `get_list` | One list with all its items |
| `create_list` / `rename_list` | Create a list; rename it (list admins only) |
| `add_items` | Add up to 50 items in one call (tagged `addedVia: 'assistant'`) |
| `set_item_checked` | Check off items or put them back |
| `update_item` | Change name, quantity, note, category or priority |
| `remove_item` | Remove one item (asks for confirmation) |
| `move_items` / `copy_items` | Move or copy items to another list |
| `empty_list` | Remove all items or only the checked ones; always asks which |

Not available by design: deleting lists, managing collaborators, photos.

### How it works

- **OAuth 2.1** authorization server in Netlify Functions (`netlify/functions/oauth-*`): discovery documents under `/.well-known/`, dynamic client registration, PKCE S256, rotating refresh tokens, revocation. The consent screen is the SPA route `/oauth/authorize`.
- **`/mcp`** (`netlify/mcp/`, bundled by `pnpm build:mcp`) resolves the bearer token to a user, then signs the Firebase **client** SDK in as that user with a custom token and runs the same `src/services/*` as the app. Firestore and Storage rules stay the only access check: the assistant can never see more than the user does in the app.
- Rate limited per user (`RATE_LIMITS.mcp`, `RATE_LIMITS.mcpDaily`).
- Design notes and decisions: [`tasks/mcp-plan.md`](./tasks/mcp-plan.md).

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Vue 3 + Composition API | Small bundle, ergonomic, strong TS support |
| Language | TypeScript (`strict`) | Compile-time errors |
| State | Pinia | Vue-native, no boilerplate |
| Build | Vite | Fast HMR, ESM-first |
| Routing | Vue Router 5 | Auth guard on every route |
| Styling | Tailwind CSS + CSS variables | Design tokens in `src/styles/tokens.css` |
| Icons | `@lucide/vue` | Consistent stroke icons |
| Animation | `@vueuse/motion`, `@lottiefiles/dotlottie-vue` | Hero motion + decorative lotties |
| Drag-and-drop | `vue-draggable-plus` | Category reorder |
| Charts | `chart.js` + `vue-chartjs` | Lazy-loaded only on `/stats` |
| i18n | `vue-i18n` | Locale persisted to localStorage |
| Head / SEO | `@unhead/vue` | Reactive `<title>`/`<meta>`/`<html lang>` per route + locale |
| Backend | Firebase Auth + Firestore + Storage | Realtime + offline + rules |
| Serverless | Netlify Functions + `firebase-admin` | Invites, magic links, email lookup, notifications, MCP OAuth server |
| Email | Resend | Invites and magic-link emails from `noreply@buytheway.app` |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, service worker, offline shell |
| AI assistants | `@modelcontextprotocol/sdk` + `zod` | Remote MCP server at `/mcp` |
| Tests | Vitest + Vue Test Utils + Playwright | Unit + component + E2E + Firestore / Storage rules + MCP integration |

---

## Project wiki

LLM-maintained markdown knowledge base under [`wiki/`](wiki/) (pattern: ingest sources from `raw/` and repo docs, query via `wiki/index.md`). Maintainer rules: [`wiki/SCHEMA.md`](wiki/SCHEMA.md). Open the repo in Obsidian for graph view and browsing.

---

## Getting started

### Prerequisites
- Node 20.19+ or 22.12+ (Vite 8 requirement). CI runs on Node 24, the Netlify functions on Node 22. On Node 25+ the localStorage polyfill in `tests/setup.ts` keeps the tests working.
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
pnpm dev                          # in a second terminal, with VITE_USE_EMULATOR=true in .env.local
```

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Type-check, build, generate PWA service worker |
| `pnpm build:analyze` | Production build in `analyze` mode (no visualizer plugin is configured at the moment) |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `vue-tsc` on `tsconfig.tests.json` (src, tests, e2e, `netlify/mcp`) + `tsc` on `tsconfig.node.json` (configs, scripts, Netlify functions) |
| `pnpm test` | Vitest watch mode |
| `pnpm test:run` | Single-shot unit + component tests |
| `pnpm test:coverage` | Unit tests with a V8 coverage report (no threshold) |
| `pnpm test:e2e` | Playwright against Firebase emulators |
| `pnpm test:e2e:ui` | Playwright with the GUI runner |
| `pnpm test:rules` | Firestore + Storage rules tests against the emulators |
| `pnpm test:mcp` | MCP server integration tests (services in Node, OAuth store, tools, `/mcp`) against the Auth + Firestore + Storage emulators |
| `pnpm build:mcp` | Bundle the `/mcp` Netlify Function into `netlify/functions/mcp/` (CI runs it before deploy) |
| `pnpm smoke:mcp` | Import the built `/mcp` bundle in plain Node and check it answers (CI runs it on the Lambda Node version) |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` | Prettier write |
| `pnpm firebase:emulators` | Start Auth + Firestore emulators |
| `pnpm firebase:deploy:rules` | Deploy Firestore rules + indexes + Storage rules |
| `pnpm storage:cors` | Apply `firebase/storage.cors.json` to the Storage bucket |
| `pnpm csp:hash` | Check that inline-script hashes in `index.html` match the CSP in `netlify.toml` |
| `pnpm report:users` / `pnpm report:custom-products` | Read-only admin HTML reports from production (PII, written to `scripts/out/`, gitignored) |
| `pnpm firebase:drop-list-counters` | Removes the legacy `itemCount` / `urgentCount` fields from production list docs (dry run by default, `--apply` to write) |
| `pnpm firebase:wipe:prod` | **Destructive**: deletes every production Firestore doc and Storage object |
| `pnpm release:patch` / `:minor` / `:major` | Bump version, commit and tag (see Release process) |

---

## Project structure

```
src/
  components/         # Reusable Vue components, grouped by domain
    collaborators/    # AddCollaboratorForm, CollaboratorList
    list/             # ListCard, CategorySection, ListItemRow, ItemEditSheet,
                      # BulkPasteSheet, VoiceAddSheet, SuggestSheet, PriorityPickerSheet,
                      # ListPickerSheet, WallpaperPicker, FavoritesPanel, ShelfTile, ...
    notifications/    # NotificationsPopover (feature currently switched off)
    onboarding/       # OnboardingTour
    stats/            # TopItemsChart, CategoryDonut
    ui/               # ConfirmModal, Toast, OfflineBanner, FAB,
                      # UpdatePrompt, InstallPrompt, FeedbackModal, ...
  composables/        # useAuth, useListDetailActions, useHaptic, useReducedMotion,
                      # useDocumentHead, useBulkSelection, useUndoDelete,
                      # useSpeechRecognition, useImageCompress, useShareApp, ...
  domain/             # Pure functions + types (no Vue, no Firebase)
    categories.ts     # Category enum, icons, color tokens, migration
    features.ts       # Feature kill switches
    history.ts        # History cap; listHistoryCycle.ts guards one snapshot per run
    itemProvenance.ts # addedVia values (autocomplete, voice, assistant, ...)
    public-catalog.ts # ~1,000 seeded items (it + en) + isCustomItemName, iconForName
    ranking.ts        # Per-list favorites ranking
    returnTo.ts       # Post-login return path (MCP consent screen)
    suggest.ts        # History-based shopping suggestions (wand)
    sort.ts           # Locale-aware category + item sorting
    stats.ts          # Top items, category breakdown, totals
    text.ts           # capitalizeInitial helper
    types.ts          # List, Item, CatalogEntry, ListFavoriteState, UserProfile, ...
    wallpapers.ts     # Wallpaper allow-list + random picker
  i18n/               # vue-i18n + locales/{it,en}.json + locales/legal.{it,en}.json
  router/             # Routes + auth guard + meta.ts (per-route SEO metadata)
  services/           # Firebase wrappers:
                      #   auth, lists, items, history, catalog, listFavorites,
                      #   users, itemPhotos, invites, notify, notifications,
                      #   export, oauth (consent screen), firebase
  stores/             # Pinia stores (auth, lists, items, catalog,
                      #               listFavorites, listItemCounts, theme)
  styles/             # tokens.css + global.css
  views/              # LandingView, LoginView, EmailLinkCallbackView, ListsView,
                      # ListDetailView, ListSettingsView, SettingsView, StatsView,
                      # AboutView, PrivacyView, TermsView, OAuthAuthorizeView
netlify/
  functions/          # send-invite, send-magic-link, find-user, notify-list-event,
                      # oauth-* (MCP OAuth 2.1 server)
  functions/_lib/     # firebase-admin init, rate limits, OAuth logic + store,
                      # MCP beta gate, branded email, sanitizers
  mcp/                # /mcp server: handler, tools, session, Node Firebase module
                      # (bundled by `pnpm build:mcp` into functions/mcp/, gitignored)
tests/
  rules/              # Firestore + Storage security-rule tests (emulator)
  mcp-integration/    # MCP server against the emulators (pnpm test:mcp)
  unit/               # Vitest unit + component tests
e2e/                  # Playwright specs
firebase/
  firestore.rules     # Server-side authorization rules
  storage.rules       # Storage rules for per-item photos
  storage.cors.json   # Bucket CORS origins (pnpm storage:cors)
  firestore.indexes.json # Composite index: lists.collaboratorUids + updatedAt desc
public/
  branding/           # Logos, wordmark, Google G mark
  animations/         # success.lottie, empty.lottie, cart_empty.lottie
  wallpapers/         # List-card backgrounds
  robots.txt          # Allow public routes + Sitemap pointer
  sitemap.xml         # Public URLs
  sw-retire.js        # Served as /sw.js on the retired domain only (netlify.toml)
scripts/              # CSP hash check, Storage CORS, admin reports, MCP bundle smoke test
tasks/                # plan.md, todo.md, mcp-plan.md, domain-migration.md
wiki/, raw/           # LLM-maintained project wiki and its sources
SPEC.md               # Product spec, scope decisions, success criteria
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
```

### Runtime env vars (Netlify-only, used by serverless functions)

```bash
FIREBASE_SERVICE_ACCOUNT          # JSON service account for firebase-admin
RESEND_API_KEY                    # Transactional email for send-invite
INVITE_FROM_ADDRESS               # e.g. "Buy The Way <noreply@example.com>"
APP_URL                           # e.g. "https://buytheway.app"
```

See [.env.example](./.env.example) for the client-side template.

### Firestore data model

| Path | Document |
|---|---|
| `users/{uid}` | `{ uid, email, displayName, photoURL? }` (any signed-in user can read, for the email lookup; owner-only write) |
| `users/{uid}/private/state` | `{ lastLoginAt, onboardingSeen?, defaultListId?, lastSeenLists?, lastSeenListMap?, completedShopCount?, lastCompletedShopAt? }` (owner-only) |
| `users/{uid}/notifications/{id}` | `{ kind, listId, listName, body, senderUid, senderName, itemId?, itemName?, createdAt }` (owner read+delete; server-only write) |
| `lists/{listId}` | `{ id, name, ownerUid, collaboratorUids[], admins[]?, pendingInviteEmails[]?, wallpaper?, sortIndex?, categoryOrder?, createdAt, updatedAt }` |
| `lists/{listId}/items/{itemId}` | `{ id, listId, name, quantity, category, note, checked, priority?, photoURL?, thumbURL?, createdByUid, addedVia, createdAt, updatedAt }` |
| `lists/{listId}/favoriteState/{slug}` | `{ slug, name, category, usageCount, lastUsedAt, pinned?, excluded?, dismissedFavorite? }` (per-list favorites, collaborators) |
| `lists/{listId}/history/{historyId}` | `{ id, listId, completedAt, itemCount, recordedByUid, trigger, items[] }` (shopping-run snapshots, newest 50 kept) |
| `catalog/{uid}/entries/{entryId}` | `{ id, ownerUid, name, category, usageCount, lastUsedAt }` (owner-only) |
| `rateLimits/{key}_{funcName}` | `{ windowStart, count }` (fixed-window limiter keyed by uid, IP or client id; server-only) |
| `oauthClients/{clientId}` | `{ clientId, redirectUris[], clientName, createdAt }` (MCP OAuth clients, server-only) |
| `oauthCodes/{sha256}`, `oauthTokens/{sha256}` | authorization codes and access / refresh tokens, stored as hashes (server-only) |
| `oauthGrants/{grantId}` | `{ uid, clientId, clientName, createdAt, lastUsedAt }` (owner read, server-only write) |
| `config/mcp` | `{ open, allowedUids[] }` MCP private-beta switch (server-only, edited in the console) |

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

Origins live in `firebase/storage.cors.json` (production, the retired domain during its redirect period, local Vite). Add a new deploy URL there, re-run the command above, then redeploy Netlify if CSP `img-src` also needs the host.

### Storage rules + Firestore cross-service link

Photo uploads are gated on list membership via `firestore.get()` inside `firebase/storage.rules`. The first time those rules are published, Firebase must link Storage to Firestore:

```bash
firebase deploy --only storage --project buy-the-way-2ac6e
```

Accept any prompt about granting Storage access to Firestore data. In the Console (Build → Storage → Rules), a banner may appear until you confirm.

If uploads fail with `storage/unauthorized` while Firestore reads/writes for the same list work, this link is the usual cause - not the client code.

### Rules summary

- `users/{uid}` readable by signed-in users for the email lookup; private state under `users/{uid}/private/state` owner-only; the notifications inbox is owner read + delete, server-only write.
- `lists/{listId}` read gated on collaborator membership (plus verified-email pending invitees); privileged fields (name, wallpaper, collaborators, admins, ownership) only by admins; any collaborator may bump counters, reorder categories or leave.
- `lists/{listId}/items`, `favoriteState`, `history` inherit the collaborator gate via a parent `get()`; item writes are type- and size-checked, `addedVia` is immutable.
- `catalog/{uid}/entries/*` strictly per-user.
- `rateLimits/*`, `oauthClients/*`, `oauthCodes/*`, `oauthTokens/*`, `config/*` deny all client access; only the serverless functions touch them via the admin SDK. `oauthGrants/*` is readable by its owner only.

---

## Deployment

CI/CD is one GitHub Actions workflow - `.github/workflows/ci-cd.yml` - that gates production on every check.

### Pipeline shape

```
                  ┌──────────────┐
                  │  quality     │  (lint • typecheck • unit • build → dist/)
                  ├──────────────┤
push / PR ───────▶│  rules       │  (rules + MCP integration vs. emulators)
                  ├──────────────┤
                  │  e2e         │  (playwright + axe; optional gate)
                  └─────┬────────┘
                        │ all green AND push to main
                        ▼
            ┌──────────────────────────┐
            │  deploy-firebase         │  (firestore rules + storage rules + indices)
            ├──────────────────────────┤
            │  deploy-netlify          │  (builds /mcp, uploads dist/ + functions)
            └──────────────────────────┘
```

- Pull-request runs: only `quality`, `rules`, `e2e`. Deploy jobs are gated by `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
- Push-to-main runs: every gate, then both deploys in parallel.
- Deploy jobs include `!cancelled()` in their `if:` so an optionally-skipped `e2e` (gated by `vars.E2E_ENABLED`) does not silently block production. See `.claude/docs/workflow.md` for the rationale.
- The Netlify deploy downloads the `dist/` artefact uploaded by `quality`, so the bytes that pass CI are exactly the bytes that ship.
- The `/mcp` function is bundled in the deploy job (`pnpm build:mcp`, Firebase web config inlined from the `VITE_FIREBASE_*` secrets) and imported once on Node 22, the Lambda runtime (`pnpm smoke:mcp`), before `netlify deploy`.

### GitHub secrets

Repo → Settings → Secrets and variables → Actions.

| Name | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | service-account JSON key; written to a temp file and exported as `GOOGLE_APPLICATION_CREDENTIALS` so `firebase deploy` can ship rules + indices + storage rules non-interactively |
| `NETLIFY_AUTH_TOKEN` | Netlify Personal Access Token, used by `netlify deploy` |
| `NETLIFY_SITE_ID` | Netlify site API ID (Site settings → General → Site information) |
| `VITE_FIREBASE_API_KEY` | Firebase web SDK config - baked into the SPA build and the `/mcp` function |
| `VITE_FIREBASE_AUTH_DOMAIN` | ditto |
| `VITE_FIREBASE_PROJECT_ID` | ditto |
| `VITE_FIREBASE_STORAGE_BUCKET` | ditto |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ditto |
| `VITE_FIREBASE_APP_ID` | ditto |
| `GIST_TOKEN` | GitHub PAT, **`gist` scope only**, used to republish the coverage badge |

`RESEND_API_KEY`, `INVITE_FROM_ADDRESS`, `APP_URL` stay on **Netlify** as runtime env vars for the serverless functions.

`FIREBASE_SERVICE_ACCOUNT` is the one credential that must exist in **both** places, with the same value: GitHub Actions uses it to deploy rules, and the Netlify functions read it at runtime through `netlify/functions/_lib/firebase-admin.ts`. Rotating the key means updating both, or one of the two halves breaks.

Repo variables (same page, **Variables** tab):

| Name | Purpose |
|---|---|
| `COVERAGE_GIST_ID` | id of the public gist holding `buy-the-way-coverage.json` |
| `E2E_ENABLED` | `'true'` enables the Playwright gate |

### Coverage badge

The README coverage badge is not hardcoded: on every push to `main` the `quality`
job runs `pnpm test:coverage` and writes the real `total.branches.pct` from
`coverage/coverage-summary.json` into a public gist, which shields.io renders
through its `endpoint` API.

One-off setup:

1. Create a **public** gist with a single file named `buy-the-way-coverage.json`
   (any placeholder content, the workflow overwrites it).
2. Copy the gist id from its URL into the `COVERAGE_GIST_ID` repo variable.
3. Create a PAT with the `gist` scope only and store it as the `GIST_TOKEN` secret.
4. Replace `COVERAGE_GIST_ID` in the badge URL at the top of this file with the
   real id.

PR runs skip the publish step: forks have no access to `GIST_TOKEN`, and a PR
must not overwrite the badge for `main`.

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
pnpm run typecheck && pnpm run lint && pnpm test:run && pnpm test:coverage && pnpm test:rules && pnpm test:mcp && pnpm test:e2e
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

- Open <https://buytheway.app> in a private window.
- DevTools → Application → check the **Service Worker** updated (URL hash changes per build).
- Confirm the floating "new version available" prompt fires for already-installed clients within ~30 s.
- Sign in, open a list, add and check off an item; with the MCP beta open to you, ask Claude "what lists do I have on Buy The Way?".

### 6. Rollback

> Prefer **rolling forward** with a hotfix. Rollback is destructive; only use it within the first few minutes of a bad release.

```bash
# Option A - GitHub Actions -> "Rollback production deploy" workflow
#   (.github/workflows/rollback-deploy.yml: restores the Netlify deploy and the
#   Firebase rules of a given version)
# Option B - Netlify "Publish previous deploy" button (UI, instant)
#   Site → Deploys → click the last green deploy → "Publish deploy"

# Option C - Revert the release commit and ship a follow-up
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

1. Run `pnpm test:run` before pushing; `pnpm test:coverage` before declaring a phase done (coverage is a report, no threshold).
2. Tests cover the critical paths only (rules, data integrity, account deletion, OAuth / MCP security, domain edge cases, real regressions), not markup or styling.
3. Domain logic stays pure (no Firebase, no Vue) - see `src/domain/*`.
4. UI changes need a manual 375 px smoke note in the PR description.
5. Never commit secrets, service accounts, or `.env.local`.
6. **Never use the em-dash character (U+2014)** anywhere in the repo. Plain ASCII hyphen `-`, colon `:`, or split the sentence.
7. New Firestore collections / Storage paths ship with their rules in the same task (see `.claude/docs/firebase.md`).

---

## License

[MIT](LICENSE).
