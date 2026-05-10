# Buy The Way

Mobile-first PWA for real-time shared shopping lists. Built for couples and flatmates.

---

## Overview

Buy The Way lets you create and share grocery lists that update live across devices. Key traits:

- **Real-time sync** via Firestore — edits appear in under one second across collaborators
- **Offline-first** — IndexedDB persistence keeps lists readable and editable without a connection
- **Installable PWA** — add to home screen on iOS and Android; Lighthouse PWA score ≥ 90
- **MostUsedShelf** — surfaces your most-used items (recency-weighted) for one-tap re-adding
- **Google sign-in only** — no email/password, no Apple sign-in

Tech stack: Vue 3 + TypeScript + Pinia + Firebase (Auth + Firestore) + Vite + vite-plugin-pwa.

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/<org>/buy-the-way.git
cd buy-the-way

# 2. Install (requires pnpm ≥ 9, Node ≥ 22)
pnpm install

# 3. Copy environment template and fill in Firebase values
cp .env.example .env.local

# 4. Start Firebase emulators (Auth + Firestore)
pnpm firebase:emulators

# 5. In a second terminal, start the dev server
pnpm dev
```

Open `http://localhost:5173`. Sign in via the emulator-backed Google stub.

---

## Environment

Copy `.env.example` to `.env.local` and supply your Firebase project values:

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase console → Project settings → General |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same page |
| `VITE_FIREBASE_PROJECT_ID` | Same page |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same page |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same page |
| `VITE_FIREBASE_APP_ID` | Same page |

For local development the emulator overrides these values automatically when `VITE_USE_EMULATOR=true` is set in `.env.local`.

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Vite dev server on `:5173` |
| `pnpm build` | Type-check + production build → `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test:run` | Run all unit tests (Vitest) |
| `pnpm test:coverage` | Unit tests + Istanbul coverage report |
| `pnpm test:rules` | Firestore security-rules tests against emulator |
| `pnpm test:e2e` | Playwright E2E suite (requires running emulators) |
| `pnpm test:e2e:ui` | Playwright interactive UI |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm typecheck` | `vue-tsc --noEmit` |
| `pnpm firebase:emulators` | Start Auth + Firestore emulators |
| `pnpm firebase:deploy:rules` | Deploy Firestore rules + indexes to prod |
| `pnpm icons:generate` | Re-generate PWA icon set from `public/branding/logo-original.png` |

---

## Architecture

```
src/
├── assets/          Static assets
├── components/
│   ├── ui/          Atoms: Button, Input, Chip, FAB, Toast, Wordmark, ...
│   └── shared/      MostUsedShelf, ItemAutocomplete, OfflineBanner
├── composables/     useToasts, useOffline
├── domain/          Pure TS: types, categories, ranking (zero deps)
├── i18n/            it / en message files
├── pwa/             Service-worker registration + update prompt
├── router/          Vue Router + auth guard
├── services/        auth, users, lists, items, catalog (Firebase wrappers)
├── stores/          Pinia: auth, lists, items, catalog, ui
└── views/           Login, Lists, ListDetail, ListSettings,
                     AddCollaborator, Trash, Settings
```

Data flow: `views → stores → services → Firebase`. Domain types are shared across all layers. Fixtures live in `tests/fixtures/` for unit-test isolation.

---

## Testing

```bash
# Unit (Vitest + @vue/test-utils + happy-dom)
pnpm test:run

# Firestore rules (requires emulators running)
pnpm firebase:emulators &
pnpm test:rules

# E2E (Playwright + Chromium, requires emulators + built app)
pnpm build
pnpm test:e2e
```

Coverage target: ≥ 80% project-wide. CI enforces lint + typecheck + unit + rules + E2E on every push.

---

## Deployment

Hosted on Netlify. GitHub Actions builds and deploys on every push to `main`.

Required GitHub secrets:

```
VITE_FIREBASE_API_KEY        VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID     VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID  VITE_FIREBASE_APP_ID
NETLIFY_AUTH_TOKEN           NETLIFY_SITE_ID
```

Manual deploy:

```bash
pnpm build
pnpm exec netlify deploy --prod --dir=dist
```

---

## License

MIT. See [LICENSE](LICENSE).
