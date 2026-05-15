# Spec: Buy The Way

## Objective

Mobile-first PWA webapp for managing shopping lists with real-time sharing.

**Target users:** individuals who do grocery shopping (alone or with a partner/family) and want to sync their list across devices and with other people.

**Core user stories:**

- As a user, I sign in with Google when I open the app (login is mandatory).
- As a user, I create one or more shopping lists, each with a name.
- As the owner of a list, I add another already-registered user by looking them up by email; they are added immediately, with no outbound email. Only the owner can add/remove collaborators.
- If the email I search for does not match any registered user, the app shows an explicit error; no pending invite is created and no email is sent.
- As a collaborator, the new list automatically appears on my home the next time I open the app after being added; a badge highlights lists that are new since my last visit.
- As a collaborator, I can leave a shared list on my own (self-remove) without the owner having to do anything.
- As a user, I add items to a list using inline autocomplete that suggests products from my personal catalog and from my "most used" items.
- As a user, if a product is not in my catalog I create it as a custom item (private, visible only to me).
- As a user, I see "Lo Scaffale" (MostUsedShelf) — a dense, always-visible 2-column grid of my recurring items (recency-weighted frequency), with one tap to add to the current list. All entries stay visible at once (no carousel, no internal scroll); the shelf grows the page rather than scrolling internally. The top-2 items show an editorial accent bar + bolder name. Items already in the current list are dimmed with strikethrough + `✓` badge. The shelf header has a chevron toggle to collapse/expand the grid (state persisted in the session; default open).
- As a user, on the list detail screen I can clear the entire list in one action via a ghost-destructive pill ("Svuota lista" / "Empty list") under the categories, separated from them by a dashed hairline. The button is visible only when the list is not empty and not in autocomplete mode, and shows the total item count as a badge. Tapping it asks for confirmation before removing all items.
- As a user, while shopping I uncheck items as I buy them; the `checked` state persists.
- As a user, I can use the app offline and changes sync when connectivity is restored.
- As a user, I can switch the UI language between Italian and English.

**Success definition:**

- Google sign-in completes in < 2s on 4G.
- Edits to a list propagate to other collaborators in < 1s under normal conditions.
- App is fully usable offline (read + write); sync is automatic when back online.
- Lighthouse PWA score ≥ 90, mobile Performance ≥ 85.
- Zero data loss in the offline → online scenario (last-write-wins per item).

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Vue 3 (Composition API + `<script setup>`) | ^3.5 |
| Language | TypeScript (strict) | ^5.6 |
| Build tool | Vite | ^6 |
| State management | Pinia | ^2.2 |
| Routing | vue-router | ^4 |
| i18n | vue-i18n | ^10 (legacy: false, Composition API) |
| Styling | Tailwind CSS | ^3.4 |
| PWA | vite-plugin-pwa (Workbox) | ^0.20 |
| Backend (Auth + DB + Realtime) | Firebase: Auth + Firestore | SDK ^10 (modular) |
| ID generation | `ulid` (npm) | ^2 |
| Unit testing | Vitest + @vue/test-utils | ^2 / ^2 |
| E2E testing | Playwright | ^1.48 |
| Lint | ESLint + @typescript-eslint + eslint-plugin-vue | latest |
| Format | Prettier | ^3 |
| Hosting | Netlify | — |
| CI | GitHub Actions | — |

## Branding

**Master logo:** `public/branding/logo-original.png` — 2816×1536 RGBA, banner format, contains the icon (illustrated shopping cart with fruit + bread + milk + paper plane), the "BUY THE WAY" wordmark, and the tagline "YOUR SMART GROCERY LIST". The logo is preserved as a brand mark only (used on the App Store/Play Store listing, marketing, and the PWA icons). It does NOT drive the in-app palette.

## Visual Direction

The product UI follows a **single editorial direction**: Editorial Cream / Lovable design system. This is the canonical visual language for v1.

- **Style:** editorial, minimal, magazine-like. High typographic hierarchy, no decoration.
- **Mood:** quiet, focused, confident. Not playful, not luxury, not brutalist.
- **Tone:** warm-neutral (cream, not white) with charcoal ink. Color used semantically for category icons only — never for surfaces, buttons, or chrome.
- **Single direction commitment:** versions B (cream + citrus) and C (notebook) explored during design were rejected. Version A is the canonical look. No theme switcher.
- **No dark mode.** Out of scope for v1 and v1.x.
- **Typography:** Hanken Grotesk (Google Fonts) as the production substitute for Lovable's Camera Plain Variable. Weights 400/500/600 only.

**Canonical palette — Editorial Cream (Lovable tokens):**

| Role | Token | Hex | Usage |
|---|---|---|---|
| Page bg / surfaces | `--cream` | `#f7f4ed` | App background, card surfaces |
| Subtle dividers / borders | `--cream-soft` | `#eceae4` | Dividers, image borders, image plates |
| Text on dark surfaces | `--offwhite` | `#fcfbf8` | Inverted text on charcoal CTA |
| Primary ink / dark surfaces | `--charcoal` | `#1c1c1c` | Body text, primary CTA fill, FAB, dark chips, offline banner, toast |
| Captions / muted | `--muted-gray` | `#5f5f5d` | Labels, captions, secondary text |
| Focus ring | `--ring-blue` | `rgba(59,130,246,0.5)` | Focus visible state |

Opacity-derived neutrals (all from `--charcoal`) are used for hover tints and depth: `--ink-04`, `--ink-03`, `--ink-40`, `--ink-82`, `--ink-83`, `--ink-100`. No new hex codes outside this set.

**Category icon hues (icon-only, never used as fill):**

| Category | Token | Hex |
|---|---|---|
| Fruit & vegetables | `--cat-fruit` | `#4a7048` |
| Dairy | `--cat-dairy` | `#3e5b7a` |
| Meat & fish | `--cat-meat` | `#8a3d3d` |
| Bakery | `--cat-bakery` | `#8a6a2c` |
| Beverages | `--cat-bev` | `#2c6c8a` |
| Frozen | `--cat-frozen` | `#3a6a8a` |
| Cleaning | `--cat-clean` | `#5a4a8a` |
| Hygiene | `--cat-hyg` | `#8a5a7a` |
| Other | `--cat-other` | `#5f5f5d` |

These hues color category icons only. They are never used to tint surfaces, buttons, or text body.

**Required derived assets (generated from `logo-original.png` in Task 30):**

- Square 1024×1024 icon (cart only, no wordmark) → source for PWA icons
- PWA icons: `icons/icon-192.png`, `icons/icon-512.png`
- Favicon `icons/favicon.ico` (16/32/48 multi-size)
- Apple touch icon `icons/apple-touch-icon.png` (180×180)
- Wordmark-only SVG `branding/wordmark.svg` (for the in-app header, no tagline, uses `currentColor`, supports i18n)

**Tagline:** the tagline "YOUR SMART GROCERY LIST" baked into the logo is in English. Inside the app, the tagline is a separate i18n string (`i18n/locales/it.json` + `en.json`), NOT part of the rendered logo. The app header uses only the wordmark.

**Accessibility constraints:**

- Charcoal `#1c1c1c` on cream `#f7f4ed`: ratio ~16:1 (AAA pass for normal and large text).
- Offwhite `#fcfbf8` on charcoal `#1c1c1c`: ratio ~16:1 (AAA pass).
- Muted-gray `#5f5f5d` on cream: ratio ~5.4:1 (AA pass). Use for body-size captions only; do not use for sub-12 px text.
- Category-icon hues are used for ≥ 14 px stroked icons, never for text. They are not validated for text contrast.
- Focus visible: 4 px `--ring-blue` outline + offset on every interactive element. Never rely on color alone for state.

## Commands

```bash
# Dev
pnpm dev                          # Vite dev server (port 5173)
pnpm preview                      # Preview production build locally

# Build
pnpm build                        # Production build into dist/
pnpm build:analyze                # Build with bundle analyzer

# Test
pnpm test                         # Vitest unit (watch mode)
pnpm test:run                     # Vitest unit single run
pnpm test:coverage                # Vitest with coverage (target 80%)
pnpm test:e2e                     # Playwright E2E
pnpm test:e2e:ui                  # Playwright UI mode

# Quality
pnpm lint                         # ESLint check
pnpm lint:fix                     # ESLint with autofix
pnpm format                       # Prettier write
pnpm typecheck                    # vue-tsc --noEmit

# Firebase
pnpm firebase:emulators           # Start Auth + Firestore emulator
pnpm firebase:deploy:rules        # Deploy Firestore security rules + indexes
```

## Project Structure

```text
buy-the-way/
├── src/
│   ├── main.ts                       # Entry point + plugin install
│   ├── App.vue                       # Root component (router-view, layout)
│   ├── router/
│   │   └── index.ts                  # Route definitions + auth guards
│   ├── stores/                       # Pinia stores
│   │   ├── auth.ts                   # User state, login/logout
│   │   ├── lists.ts                  # User's lists + current list + new-lists badge
│   │   ├── items.ts                  # Items of current list (realtime subscription)
│   │   └── catalog.ts                # Personal catalog + most-used suggestions
│   ├── views/                        # Pages (route targets)
│   │   ├── LoginView.vue
│   │   ├── ListsView.vue             # Home: all user lists + new-lists badge
│   │   ├── ListDetailView.vue        # Single list detail
│   │   ├── ListSettingsView.vue      # Owner: rename, manage collaborators, soft-delete. Collaborator: leave
│   │   ├── TrashView.vue             # Deleted lists (recover/purge) - owner only
│   │   └── SettingsView.vue          # Language, account, logout
│   ├── components/
│   │   ├── list/
│   │   │   ├── ListCard.vue
│   │   │   ├── ListItemRow.vue
│   │   │   ├── ItemAutocomplete.vue  # Input + inline suggestions
│   │   │   ├── CategoryHeader.vue
│   │   │   ├── CategorySection.vue
│   │   │   ├── MostUsedShelf.vue     # Dense always-visible grid with collapse toggle ("Lo Scaffale")
│   │   │   └── EmptyListButton.vue   # Ghost-destructive pill to clear list with count badge
│   │   ├── collaborators/
│   │   │   ├── AddCollaboratorForm.vue   # Lookup by email + add
│   │   │   └── CollaboratorList.vue      # Member list + remove (owner) / leave (self)
│   │   └── ui/                       # Buttons, inputs, modals, toasts
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useFirestoreCollection.ts # Realtime onSnapshot wrapper
│   │   ├── useOfflineQueue.ts        # Online/offline state
│   │   └── useDebouncedRef.ts
│   ├── services/                     # Firebase access layer
│   │   ├── firebase.ts               # Init app + getAuth + getFirestore
│   │   ├── auth.service.ts           # signInWithGoogle, signOut, onAuthState, upsert users/{uid}
│   │   ├── users.service.ts          # findUserByEmail (query users collection)
│   │   ├── lists.service.ts          # CRUD lists + addCollaborator/removeCollaborator/leave + soft-delete
│   │   ├── items.service.ts          # CRUD items + toggle checked
│   │   └── catalog.service.ts        # Personal catalog + ranking
│   ├── domain/                       # Pure types and logic, no I/O
│   │   ├── types.ts                  # List, Item, User, CatalogEntry, Category
│   │   ├── categories.ts             # Predefined category seed enum
│   │   ├── ranking.ts                # Recency-weighted ranking algorithm
│   │   └── id.ts                     # ulid() wrapper
│   ├── i18n/
│   │   ├── index.ts                  # vue-i18n setup
│   │   └── locales/
│   │       ├── it.json
│   │       └── en.json
│   ├── styles/
│   │   ├── tokens.css                # CSS custom properties
│   │   └── global.css                # Reset, base
│   └── pwa/
│       └── registerSW.ts             # Service worker registration + update prompt
├── tests/
│   ├── unit/                         # Vitest: domain, composables, stores, services (mocked)
│   └── fixtures/
├── e2e/
│   ├── auth.spec.ts
│   ├── list-crud.spec.ts
│   ├── collaborators.spec.ts          # Add/remove/leave + negative email lookup
│   ├── share-realtime.spec.ts
│   └── offline-sync.spec.ts
├── public/
│   ├── branding/
│   │   └── logo-original.png         # Master logo 2816x1536 RGBA, source for derivatives
│   ├── icons/                        # PWA icons 192/512/maskable, favicon, apple-touch (generated from the logo)
│   └── manifest.webmanifest          # (generated by plugin)
├── firebase/
│   ├── firestore.rules               # Security rules
│   └── firestore.indexes.json        # Composite indexes
├── .github/workflows/
│   ├── ci.yml                        # Lint + typecheck + test + build
│   └── deploy.yml                    # Deploy to Netlify on main
├── netlify.toml                      # SPA fallback + headers
├── SPEC.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── playwright.config.ts
└── vitest.config.ts
```

## Code Style

**Representative example (types + id + service + component):**

```ts
// src/domain/id.ts
import { ulid } from 'ulid';

export type ULID = string & { readonly __brand: 'ULID' };

export const newId = (): ULID => ulid() as ULID;
```

```ts
// src/domain/types.ts
import type { ULID } from './id';

export type Locale = 'it' | 'en';

export type Category =
  | 'fruit_vegetables'
  | 'dairy'
  | 'meat_fish'
  | 'bakery'
  | 'beverages'
  | 'frozen'
  | 'cleaning'
  | 'hygiene'
  | 'other';

export interface List {
  id: ULID;
  name: string;
  ownerUid: string;
  collaboratorUids: readonly string[];   // uids resolved via users/{uid} lookup, never emails
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id: ULID;
  listId: ULID;
  name: string;
  quantity: string;        // free text: "2", "500g", "1.5l"
  category: Category;
  note: string;
  checked: boolean;
  createdByUid: string;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogEntry {
  id: ULID;
  ownerUid: string;        // private per-user
  name: string;
  category: Category;
  usageCount: number;
  lastUsedAt: number;
}

// Firestore document users/{uid}, populated by auth.service on login.
// Required for email → uid lookup in addCollaborator. No PII beyond what Google provides.
export interface UserProfile {
  uid: string;
  email: string;           // lowercase, normalized, indexed
  displayName: string;
  lastLoginAt: number;
}
```

```ts
// src/services/items.service.ts
import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { newId } from '@/domain/id';
import type { Item, ULID } from '@/domain/types';

export const subscribeItems = (
  listId: ULID,
  onChange: (items: readonly Item[]) => void,
  onError: (err: Error) => void
): (() => void) => {
  const ref = collection(db, 'lists', listId, 'items');
  return onSnapshot(
    ref,
    (snap) => onChange(snap.docs.map((d) => d.data() as Item)),
    onError
  );
};

export const addItem = async (
  listId: ULID,
  draft: Omit<Item, 'id' | 'listId' | 'createdAt' | 'updatedAt'>
): Promise<ULID> => {
  const id = newId();
  const now = Date.now();
  const item: Item = { ...draft, id, listId, createdAt: now, updatedAt: now };
  await setDoc(doc(db, 'lists', listId, 'items', id), item);
  return id;
};

export const toggleChecked = async (
  listId: ULID,
  itemId: ULID,
  checked: boolean
): Promise<void> => {
  await updateDoc(doc(db, 'lists', listId, 'items', itemId), {
    checked,
    updatedAt: Date.now(),
  });
};
```

```vue
<!-- src/components/list/ListItemRow.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Item } from '@/domain/types';
import { toggleChecked } from '@/services/items.service';

const props = defineProps<{ item: Item }>();
const { t } = useI18n();

const ariaLabel = computed(() =>
  props.item.checked ? t('item.markAsToBuy') : t('item.markAsBought')
);

const onToggle = () => {
  void toggleChecked(props.item.listId, props.item.id, !props.item.checked);
};
</script>

<template>
  <li class="list-item-row" :data-checked="item.checked">
    <button type="button" :aria-label="ariaLabel" @click="onToggle">
      <span class="list-item-row__name">{{ item.name }}</span>
      <span v-if="item.quantity" class="list-item-row__qty">{{ item.quantity }}</span>
    </button>
  </li>
</template>
```

**Conventions:**

- Component files: `PascalCase.vue`. Composables: `useXxx.ts`. Services: `xxx.service.ts`. Stores: `xxx.ts` (Pinia).
- Functions and variables: `camelCase`. Boolean prefixes: `is/has/should/can`.
- Types and interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`.
- CSS files: `kebab-case`. BEM-like classes (`list-item-row__name`).
- Import alias: `@/` → `src/`.
- Immutability: no in-place mutation of domain arrays/objects. Use spread + `readonly`.
- Errors: never swallow. All services propagate; consumers log + show a user-friendly toast.
- No `any`. No non-null assertion (`!`) unless explicitly justified.
- No `console.log` in production (eslint rule).
- No magic numbers. Extract them into named constants.
- Functions < 50 lines. Files < 800 lines.
- Components: single-responsibility, props typed via `defineProps<...>()`.

## Testing Strategy

**Minimum coverage: 80%** (statements, branches, functions, lines), as required by the global rules.

**Levels:**

| Level | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `tests/unit/**` | Pure functions in `domain/` (ranking, id, categories), isolated composables with mocks, Pinia stores, services with Firestore mocked |
| Integration | Vitest + Firebase Emulator | `tests/unit/**.int.test.ts` | Services against the Firestore emulator: rules, queries, realtime listeners |
| E2E | Playwright | `e2e/**` | Golden-path flows: Google login (mocked), list creation, autocomplete, real-time sharing across two contexts, offline edit + sync |

**Mandatory TDD workflow (global rule):**

1. RED — write a failing test.
2. GREEN — implement the minimum to make it pass.
3. REFACTOR.

**Specific requirements:**

- Domain logic (`ranking.ts`, `categories.ts`) → 100% coverage.
- Service layer tested against the Firestore emulator, not only with mocks.
- Real-time sharing tested E2E with two simultaneous Playwright browser contexts.
- Offline scenario tested with `page.context().setOffline(true)`.
- i18n tests: no user-facing hardcoded string outside `i18n/locales/*.json`.
- Playwright accessibility tests (axe) on the main flows.

## Boundaries

**Always do:**

- Mandatory Google login before any application route (route guard).
- Generate IDs with `newId()` (ULID), never with a raw timestamp or non-ordered random.
- All Firestore writes go through `services/*.service.ts`. Never call the Firestore SDK directly from a component or store.
- Validate input on the client (name length, email format) before calling a service.
- Validate input on the server with Firestore security rules (do not trust the client).
- Normalize emails (lowercase + trim) before any collaborator lookup.
- On `onAuthStateChanged` (login) upsert `users/{uid}` with `{ email, displayName, lastLoginAt }`. No email lookup can work without this step.
- `addCollaborator` follows the flow: lookup `users` by email → if not found → explicit error to client; if found → `arrayUnion(uid)` on `lists/{id}.collaboratorUids`. Never create invite documents or send emails.
- `removeCollaborator` (owner) and `leaveList` (self) both use `arrayRemove(uid)`; `ownerUid` can never be removed.
- All UI strings go through `vue-i18n` (`t()`). Both it and en covered.
- Update `updatedAt` on every mutation to support last-write-wins.
- Run `lint`, `typecheck`, `test:run` before every commit (CI gate).
- Keep `firestore.rules` aligned with the data model: `lists/{id}` is readable by `ownerUid` or any uid in `collaboratorUids`.
- Rules on `users/{uid}`: any authenticated user can read (for email lookup) but can write only their own document. Read query limited to fields `uid`, `email`, `displayName` (do not expose `lastLoginAt` if avoidable).
- `collaboratorUids` is mutable only by `ownerUid` for adding/removing others; a collaborator can only remove their own uid (leave). It is never possible to remove `ownerUid` from `collaboratorUids` (owner is tracked in a separate field).
- PWA service worker uses network-first for Firestore data (delegated to the SDK's offline support) and cache-first for static assets.

**Ask first:**

- Adding new npm dependencies (especially heavy ones: animation libs, date libs > 30 KB).
- Changing the Firestore data schema (adding/renaming fields on existing collections).
- Modifying `firestore.rules`.
- Adding new categories to the `Category` enum.
- Changing the conflict-resolution strategy (beyond last-write-wins).
- Introducing Cloud Functions or Firebase services beyond Auth + Firestore.
- Changing the "most used" ranking algorithm.
- Changing `vite.config.ts`, `tsconfig.json`, `eslint.config`, `tailwind.config`.

**Never do:**

- Commit production Firebase keys, service accounts, or any secret to the repo. Web Firebase config goes into env vars (`VITE_FIREBASE_*`).
- Disable Firestore security rules (`allow read, write: if true`), even temporarily.
- Persist PII beyond Google's `email` and `displayName`.
- Allow a non-owner to invite/remove collaborators.
- Allow an unauthenticated user to access any application route.
- Run a mutation that does not update `updatedAt`.
- Hard-delete lists or items: always soft-delete (`deletedAt`).
- Mutate domain objects in place.
- Skip `--no-verify` on git, skip hooks, skip CI.
- Use `v-html` with non-sanitized user-generated content.

## Success Criteria

- [ ] Google login working end-to-end (emulator + production).
- [ ] On login, the `users/{uid}` profile is created/updated (lowercase email, displayName, lastLoginAt).
- [ ] Owner-side list CRUD with soft delete + restore from Trash.
- [ ] Collaborator addition via email lookup: existing user → added immediately; unregistered user → visible error, no outbound email, no pending invite.
- [ ] Collaborator sees the new list on first open after being added; "new" badge on the home.
- [ ] Collaborator can leave a list on their own (self-remove).
- [ ] Only the owner can add/remove collaborators and rename/delete the list. `ownerUid` is non-removable.
- [ ] Realtime sync: an edit by one collaborator is visible to the others in < 1s.
- [ ] Inline autocomplete: suggests from the personal catalog + top "most used" (recency-weighted).
- [ ] Custom items: creatable inline, persisted into the personal catalog, never visible to others.
- [ ] `checked` toggle persists; no automatic reset.
- [ ] MostUsedShelf collapse toggle works (default open, persists across re-renders within a session).
- [ ] "Empty list" button clears all items after explicit confirmation; visible only with items present and not in autocomplete mode.
- [ ] Offline: edits work without connectivity; sync is automatic when back online; per-item conflict is last-write-wins.
- [ ] Language switchable between it/en at runtime; no hardcoded UI string.
- [ ] PWA installable (valid manifest, active SW, offline shell).
- [ ] Lighthouse: PWA ≥ 90, mobile Performance ≥ 85, Accessibility ≥ 95.
- [ ] Test coverage ≥ 80%; CI green.
- [ ] Firestore rules tested with the emulator: no bypass possible for non-owner / non-collaborator.

## Open Questions

None blocking. All v1 decisions locked. Out-of-scope items below are deferred or rejected:

- Rate limiting on collaborator additions (to prevent abuse) — likely via a Cloud Function in v1.x.
- Push notifications: out of scope for v1, to be evaluated in v1.x.
- Ownership transfer: out of scope for v1 (owner is fixed).
- User-defined custom categories: out of scope for v1.
- Dark theme: **rejected.** Single direction (Editorial Cream) only, v1 and v1.x.
- Trash auto-purge after 30 days (Cloud Function): **rejected.** Soft-deleted lists persist indefinitely.
- Error tracking (Sentry/Highlight): deferred to v1.x.
- Analytics: never on v1; reconsider v1.x only if usage data is genuinely needed.
