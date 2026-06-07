# Spec: Buy The Way

## Objective

Mobile-first PWA webapp for managing shopping lists with real-time sharing.

**Target users:** individuals who do grocery shopping (alone or with a partner/family) and want to sync their list across devices and with other people.

**Core user stories:**

- As a user, I sign in with Google one-tap **or** a passwordless email magic link (login is mandatory).
- As a user, I create one or more shopping lists, each with a name.
- As the owner of a list, I add another already-registered user by looking them up by email; they are added immediately, with no outbound email. Only the owner can add/remove collaborators.
- If the email I search for does not match any registered user, the app shows an explicit error; no pending invite is created and no email is sent.
- As a collaborator, the new list automatically appears on my home the next time I open the app after being added; a badge highlights lists that are new since my last visit.
- As a collaborator, I can leave a shared list on my own (self-remove) without the owner having to do anything.
- As a user, I add items to a list using inline autocomplete that suggests products from my personal catalog **and** from a built-in public catalog of common grocery items (it/en), with my catalog overriding on conflicts.
- As a user, if a product matches nothing in either catalog I create it as a custom item (private, visible only to me).
- As a user, I see "I preferiti" - a dense 2-column grid of my recurring items, recency-weighted (`usageCount * exp(-Δt·ln2 / 30d)`, min 2 uses, cap 30). The grid is only rendered when at least one entry qualifies. The header has a filled star icon and a chevron; clicking either the title or the chevron collapses/expands the grid. Items already in the current list render with strikethrough + dimmed opacity. Each tile has a small × button (and a 500 ms long-press alternative) that excludes the entry from favorites permanently - you can re-enable it later from the item edit sheet via the "I preferiti" checkbox.
- As a user, on the list detail screen I can clear the entire list in one action via a full-width red button ("Svuota lista" / "Empty list") pinned to the bottom of the screen. The button is visible only when the list is not empty and not in autocomplete mode. Tapping it opens a confirmation modal.
- As a user, on the list detail screen, categories and items inside each category are sorted alphabetically (locale-aware). I can collapse any category section by clicking its header; the header shows a `bought/total` counter beside the name. Collapse state is persisted per-list in `localStorage`. When all items in a category are checked, the section auto-collapses.
- As a user, long-pressing (≥ 500 ms) on an item opens an edit sheet where I can change its name, quantity, note, category, and toggle the "I preferiti" flag (forces the entry into favorites or excludes it from the algorithm). A short tap still toggles `checked`. Deleting a single item (red trash icon) prompts a confirmation modal.
- As a user, the list detail header shows a stats strip below the title: `Articoli: {n} · Comprati: {b}/{t} · Utenti: {u}`.
- As a user, every primary action button shows a leading icon (`@lucide/vue`) for at-a-glance recognition. The Google sign-in button uses the official Google G mark per Google brand guidelines. Category and per-item icons use Unicode emoji tinted with the category cssVar.
- As a user, on first-load and empty states I see friendly illustrations (e.g. a cactus) above the empty-state text on `ListsView` and `ListDetailView`. Errors render as a rounded `AlertMessage` chip with an icon.
- As a user, I cannot create two lists with the same name (case-insensitive, trimmed) within my own scope.
- As a user, when I check the last unchecked item in a category, the category auto-collapses. All add/check/remove gestures emit a short haptic tick (`navigator.vibrate(10)`) on supported devices. Reduced-motion users see no animation; haptic can be turned off via `localStorage` key `buy-the-way:haptic`.
- As a user, on the lists home each list card shows a coloured-circle avatar cluster of its collaborators (up to 3 visible, +N overflow), the item count, and the last-modified date with time (locale-aware). The home page itself shows the brand logo (`logo-original.png`) as a hero block; the settings button sits in the top-right corner labelled "Impostazioni"; the list detail page exposes a separate "Impostazioni lista" button.
- As a user, while shopping I uncheck items as I buy them; the `checked` state persists.
- As a user, I can use the app offline and changes sync when connectivity is restored.
- As a user, I can switch the UI language between Italian and English.
- As a user, I can switch between light and dark themes (system-following by default, manual override persisted).
- As a user, I can drag-and-drop categories inside a list to set my preferred order; the order is shared with collaborators (`lists/{listId}.categoryOrder`).
- As a user, I can attach a photo to any item; the client compresses it to an 800 px photo + 200 px thumbnail and stores both under `lists/{listId}/items/{itemId}/` in Cloud Storage.
- As a user, I can dictate items by voice (Web Speech API where supported) and paste a free-form text block to bulk-add items.
- As a user, after deleting one or more items I see an Undo toast with countdown; tapping it restores the items before the commit fires.
- As a user, I receive an in-app notification (no FCM, no browser permission) when a collaborator adds an item, checks one off, empties the list, or removes me from it; notifications land in an inbox popover anchored to the lists view.
- As a user, I can export all my data (lists, items, catalog, profile) as a JSON file from the Settings view (GDPR right-to-portability).
- As a first-time user, I see an in-app onboarding tour that I can dismiss; the dismissal is persisted in `users/{uid}/private/state.hasSeenOnboarding`.
- As a user, my private state (onboarding flag, per-user defaults) lives in the owner-only subcollection `users/{uid}/private/state`; the public `users/{uid}` doc keeps only the minimum needed for the email-lookup flow.

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
| Head / SEO | @unhead/vue | ^3 (composable + plugin) |
| Backend (Auth + DB + Realtime + Storage) | Firebase: Auth + Firestore + Storage | SDK ^12 (modular) |
| Drag-and-drop | vue-draggable-plus | ^0.6 |
| Charts | chart.js + vue-chartjs | ^4 / ^5 (lazy-loaded on /stats) |
| Serverless | Netlify Functions + firebase-admin | latest |
| Email (invites) | Resend | ^6 |
| ID generation | `ulid` (npm) | ^2 |
| Unit testing | Vitest + @vue/test-utils | ^2 / ^2 |
| E2E testing | Playwright | ^1.48 |
| Lint | ESLint + @typescript-eslint + eslint-plugin-vue | latest |
| Format | Prettier | ^3 |
| Hosting | Netlify | - |
| CI | GitHub Actions | - |

## Branding

**Master logo:** `public/branding/logo-original.png` - 2816×1536 RGBA, banner format, contains the icon (illustrated shopping cart with fruit + bread + milk + paper plane), the "BUY THE WAY" wordmark, and the tagline "YOUR SMART GROCERY LIST". The logo is preserved as a brand mark only (used on the App Store/Play Store listing, marketing, and the PWA icons). It does NOT drive the in-app palette.

## Visual Direction

The product UI follows a **single editorial direction**: Editorial Cream / Lovable design system. This is the canonical visual language for v1.

- **Style:** editorial, minimal, magazine-like. High typographic hierarchy, no decoration.
- **Mood:** quiet, focused, confident. Not playful, not luxury, not brutalist.
- **Tone:** warm-neutral (cream, not white) with charcoal ink. Color used semantically for category icons only - never for surfaces, buttons, or chrome.
- **Single direction commitment:** versions B (cream + citrus) and C (notebook) explored during design were rejected. Version A is the canonical look.
- **Light + dark theme:** dark mode shipped in Sprint 4. Tokens flip on `[data-theme]`; manual override persisted per user; default follows the OS via `prefers-color-scheme`.
- **Typography:** Hanken Grotesk (Google Fonts) as the production substitute for Lovable's Camera Plain Variable. Weights 400/500/600 only.

**Canonical palette - Editorial Cream (Lovable tokens):**

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

**Required derived assets (generated from `logo-original.png` in Task 30, plus Phase 7.5 polish assets):**

- Square 1024×1024 icon (cart only, no wordmark) → source for PWA icons
- PWA icons: `icons/icon-192.png`, `icons/icon-512.png`
- Favicon `icons/favicon.ico` (16/32/48 multi-size)
- Apple touch icon `icons/apple-touch-icon.png` (180×180)
- Wordmark-only SVG `branding/wordmark.svg` (for the in-app header, no tagline, uses `currentColor`, supports i18n)
- Logo-icon SVG `branding/logo-icon.svg` (cart only, large, used on `LoginView` + small inline on `ListsView` header)
- Google G mark `branding/google-g.svg` (official, used on the Google sign-in button)
- Empty-state illustrations under `src/assets/illustrations/` (e.g. `empty-lists.svg`, `empty-items.svg`, `empty-shelf.svg`), inline SVG, `currentColor`-friendly

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
│   │   ├── catalog.ts                # Personal catalog + most-used suggestions
│   │   ├── listFavorites.ts          # Per-list favorite-shelf state
│   │   └── theme.ts                  # Light/dark theme switching + persistence
│   ├── views/                        # Pages (route targets)
│   │   ├── LoginView.vue
│   │   ├── ListsView.vue             # Home: all user lists + new-lists badge
│   │   ├── ListDetailView.vue        # Single list detail
│   │   ├── ListSettingsView.vue      # Owner: rename, manage collaborators, hard-delete (irreversible). Collaborator: leave
│   │   ├── SettingsView.vue          # Language, account, logout, account deletion
│   │   ├── StatsView.vue             # Totals + top items + category donut (lazy)
│   │   ├── AboutView.vue             # Public landing + FAQ + JSON-LD
│   │   ├── PrivacyView.vue           # Bilingual Privacy Policy (9 sections)
│   │   └── TermsView.vue             # Bilingual Terms of Service (6 sections)
│   ├── components/
│   │   ├── list/
│   │   │   ├── ListCard.vue
│   │   │   ├── ListItemRow.vue       # Row + custom-item UserPlus badge + priority cycle
│   │   │   ├── ItemAutocomplete.vue  # Input + inline suggestions
│   │   │   ├── ItemEditSheet.vue     # Edit + exclude-from-suggestions (custom only)
│   │   │   ├── ListPickerSheet.vue   # Copy / move target picker
│   │   │   ├── PriorityPickerSheet.vue
│   │   │   ├── WallpaperPicker.vue
│   │   │   ├── CategoryHeader.vue
│   │   │   ├── CategorySection.vue
│   │   │   ├── MostUsedShelf.vue     # Header is a single button toggling collapse
│   │   │   ├── ShelfTile.vue         # Trash2 exclude action
│   │   │   └── EmptyListButton.vue   # Ghost-destructive pill to clear list with count badge
│   │   ├── stats/
│   │   │   ├── TopItemsChart.vue
│   │   │   └── CategoryDonut.vue
│   │   ├── collaborators/
│   │   │   ├── AddCollaboratorForm.vue   # Lookup by email + add
│   │   │   └── CollaboratorList.vue      # Member list + remove (owner) / leave (self)
│   │   ├── onboarding/
│   │   │   └── OnboardingTour.vue        # First-run tour, persisted dismissal flag
│   │   └── ui/                       # Buttons, inputs, modals, toasts, LegalFooter, CompletionCelebration, FAB, UpdatePrompt, InstallPrompt, FeedbackModal
│   ├── composables/
│   │   ├── useAuth.ts
│   │   ├── useDebouncedRef.ts
│   │   ├── useCollapsedCategories.ts
│   │   ├── useDocumentHead.ts        # @unhead/vue wrapper, locale-reactive title + meta
│   │   ├── useHaptic.ts
│   │   ├── useLogoMotion.ts
│   │   ├── useReducedMotion.ts
│   │   ├── useBulkSelection.ts       # Long-press multi-select for items
│   │   ├── useUndoDelete.ts          # Toast + countdown + commit chain
│   │   ├── useSpeechRecognition.ts   # Web Speech API wrapper for voice add
│   │   ├── useImageCompress.ts       # Client-side JPEG compression for item photos
│   │   ├── useShareApp.ts            # Web Share API helper
│   │   ├── useModalBack.ts           # Hardware-back integration for sheets
│   │   ├── useSafeBack.ts            # Router back with fallback
│   │   └── useFitText.ts             # Auto-shrink long names
│   ├── services/                     # Firebase + serverless wrappers
│   │   ├── firebase.ts               # Init app + Auth + Firestore + Storage + Messaging
│   │   ├── auth.service.ts           # Google + email magic link + onAuthState + upsert users/{uid} + deleteAccountCascade
│   │   ├── users.service.ts          # findUserByEmail (per-uid getDoc; no list operation)
│   │   ├── lists.service.ts          # CRUD lists + collaborators + hard-delete + ownership transfer + categoryOrder
│   │   ├── items.service.ts          # CRUD items + bulk ops + cascade photo purge + notify hooks
│   │   ├── itemPhotos.service.ts     # Upload + delete photo/thumb + purge helper for cascades
│   │   ├── catalog.service.ts        # Personal catalog + ranking + pin/exclude
│   │   ├── listFavorites.service.ts  # Favorites shelf state
│   │   ├── notify.service.ts         # Client wrapper for the notify-list-event function
│   │   ├── invites.service.ts        # Client wrapper for the send-invite function
│   │   └── export.service.ts         # GDPR JSON export builder
│   ├── domain/                       # Pure types and logic, no I/O
│   │   ├── types.ts                  # List, Item, User, CatalogEntry, Category, ItemPriority
│   │   ├── categories.ts             # Predefined category seed enum
│   │   ├── public-catalog.ts         # ~200 public items + iconForName + isCustomItemName
│   │   ├── ranking.ts                # Recency-weighted ranking algorithm
│   │   ├── sort.ts                   # Locale-aware sorting
│   │   ├── stats.ts                  # Top items + category breakdown + totals
│   │   ├── text.ts                   # capitalizeInitial helper
│   │   ├── wallpapers.ts             # Wallpaper allow-list + random picker
│   │   └── id.ts                     # ulid() wrapper
│   ├── i18n/
│   │   ├── index.ts                  # vue-i18n setup + legal partials merged at init
│   │   └── locales/
│   │       ├── it.json
│   │       ├── en.json
│   │       ├── legal.it.json         # Privacy + Terms content (IT)
│   │       └── legal.en.json         # Privacy + Terms content (EN)
│   ├── router/
│   │   ├── index.ts                  # Route definitions + auth guard with public-route bypass
│   │   └── meta.ts                   # Per-route SEO metadata + PUBLIC_ROUTE_NAMES
│   ├── styles/
│   │   ├── tokens.css                # CSS custom properties
│   │   └── global.css                # Reset, base, global cursor rules
│   └── pwa/
│       ├── manifest.ts               # Manifest definition (description, categories, screenshots)
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
│   ├── animations/                   # success/empty/cart_empty lotties
│   ├── wallpapers/                   # 10 list-card backgrounds
│   ├── robots.txt                    # Allow public routes + Sitemap pointer
│   ├── sitemap.xml                   # 5 public URLs
│   └── manifest.webmanifest          # (generated by plugin)
├── firebase/
│   ├── firestore.rules               # Firestore security rules
│   ├── storage.rules                 # Storage rules for per-item photos (collaborator-gated)
│   └── firestore.indexes.json        # Composite index for lists.collaboratorUids + updatedAt desc
├── netlify/
│   └── functions/
│       ├── send-invite.ts            # Resend-backed email invites (rate-limited)
│       ├── find-user.ts              # Server-side email -> uid lookup
│       ├── notify-list-event.ts      # In-app notification fan-out (one doc per recipient)
│       └── _lib/                     # Shared rate-limit + firestore-admin helpers
├── .github/workflows/
│   └── ci-cd.yml                     # Lint + typecheck + unit + rules + e2e + deploy (Firebase + Netlify)
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

1. RED - write a failing test.
2. GREEN - implement the minimum to make it pass.
3. REFACTOR.

**Specific requirements:**

- Domain logic (`ranking.ts`, `categories.ts`) → 100% coverage.
- Service layer tested against the Firestore emulator, not only with mocks.
- Real-time sharing tested E2E with two simultaneous Playwright browser contexts.
- Offline scenario tested with `page.context().setOffline(true)`.
- i18n tests: no user-facing hardcoded string outside `i18n/locales/*.json`.
- Playwright accessibility tests (axe) on the main flows.

**Test quality rules (learned in Phase 1):**

- View tests must assert **user-observable outcomes** - final route, visible text, element presence - not only that a function was called. Example: after sign-in succeeds, assert `router.currentRoute.value.name === 'lists'`.
- When a Vue component uses `watch(() => store.x, ...)`, the mock store must be `reactive({})`, not a plain object, otherwise the watcher never fires.
- Every async operation visible to the user must have a test for the **error path** with visible feedback (error text rendered in the DOM).
- Firestore security rules for every new collection must have at least one integration test (`*.int.test.ts` against the emulator) before that phase is marked complete.

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
- Keep `firestore.rules` aligned with the data model: `lists/{id}` is readable by `ownerUid` or any uid in `collaboratorUids`. Update rules **in the same commit** that introduces a new collection - never leave a collection with the default deny-all scaffold.
- In `main.ts`, call `authStore.init()` **before** `app.use(router)`. Vue Router 4 starts the initial navigation synchronously inside `install()`; if the Firebase listener is not registered first, the auth guard waits on `ready` forever (blank page).
- Every async Firebase callback that sets `ready = true` (or any flag that unblocks a guard) must wrap side-effectful Firestore calls in `try/catch`. If `setDoc` throws and the callback is never called, `ready` stays false and the app freezes on the guard indefinitely.
- Rules on `users/{uid}`: any authenticated user can read (for email lookup) but can write only their own document. Read query limited to fields `uid`, `email`, `displayName` (do not expose `lastLoginAt` if avoidable).
- `collaboratorUids` is mutable only by `ownerUid` for adding/removing others; a collaborator can only remove their own uid (leave). It is never possible to remove `ownerUid` from `collaboratorUids` (owner is tracked in a separate field).
- PWA service worker uses network-first for Firestore data (delegated to the SDK's offline support) and cache-first for static assets.

**Ask first:**

- Adding new npm dependencies (especially heavy ones: animation libs, date libs > 30 KB). Phase 7.5 introduces `lucide-vue-next` (icons). Phase 11 adds: `@vueuse/motion` (~34 KB precache delta - hero-logo bounce + idle float on `ListsView` + `LoginView`, respects `prefers-reduced-motion`); `@lottiefiles/dotlottie-vue` (~320 KB - celebration + empty-state lotties; only loads on routes that render a lottie); `chart.js` + `vue-chartjs` (~50 KB gz combined - bar + donut on `/stats`; lazy-loaded via the StatsView route chunk).
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
- Soft-delete lists: deletion is immediate hard-delete (purges items + list doc), guarded by an irreversible-action confirm modal. No trash, no recovery.
- Mutate domain objects in place.
- Skip `--no-verify` on git, skip hooks, skip CI.
- Use `v-html` with non-sanitized user-generated content.
- Leave a view as an empty stub (`<h1>Stub</h1>`) if it is reachable from a navigable route in the current phase. Every routable view must have at minimum: a page title in the header and a back-navigation button (where applicable). Sign-out must be reachable from the UI in Phase 1 even if SettingsView is otherwise incomplete.

## Success Criteria

- [ ] Google login working end-to-end (emulator + production).
- [ ] On login, the `users/{uid}` profile is created/updated (lowercase email, displayName, lastLoginAt).
- [ ] Owner-side list CRUD with irreversible hard-delete (purges items + list doc, confirmed via modal).
- [ ] Collaborator addition via email lookup: existing user → added immediately; unregistered user → visible error, no outbound email, no pending invite.
- [ ] Collaborator sees the new list on first open after being added; "new" badge on the home.
- [ ] Collaborator can leave a list on their own (self-remove).
- [ ] Only the owner can add/remove collaborators and rename/delete the list. `ownerUid` is non-removable.
- [ ] Realtime sync: an edit by one collaborator is visible to the others in < 1s.
- [ ] Inline autocomplete: suggests from the personal catalog + built-in public catalog + top "most used" (recency-weighted); user catalog wins on dedupe.
- [ ] Custom items: creatable inline, persisted into the personal catalog, never visible to others.
- [ ] `checked` toggle persists; no automatic reset.
- [ ] Long-press on item opens edit sheet (name, quantity, note, category) and persists changes.
- [ ] Categories and items sorted alphabetically (locale-aware); category sections collapsible; header shows `bought/total` counter.
- [ ] No two lists with the same name (case-insensitive, trimmed) per user.
- [ ] MostUsedShelf renamed "I preferiti"; clicking title or chevron toggles collapse; default open, persists within session.
- [ ] All primary buttons render a leading icon (lucide-vue-next); Google sign-in uses the official Google G mark.
- [ ] Empty states show friendly illustrations above the headline text.
- [ ] Haptic tick fires on add/check/remove on supported devices; "All done!" confetti + toast triggers on transition to fully-checked; reduced-motion users opt out automatically.
- [ ] "Empty list" button clears all items after explicit confirmation; visible only with items present and not in autocomplete mode.
- [ ] Offline: edits work without connectivity; sync is automatic when back online; per-item conflict is last-write-wins.
- [ ] Language switchable between it/en at runtime; no hardcoded UI string.
- [ ] PWA installable (valid manifest, active SW, offline shell).
- [ ] Lighthouse: PWA ≥ 90, mobile Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95 on `/about` + `/login`.
- [ ] Test coverage ≥ 80%; CI green.
- [ ] Firestore rules tested with the emulator: no bypass possible for non-owner / non-collaborator.
- [ ] Public marketing/legal routes (`/about`, `/privacy`, `/terms`) reachable without authentication; not redirected away when authenticated.
- [ ] `/about` ships FAQPage + WebApplication JSON-LD (Google Rich Results valid).
- [ ] `robots.txt` allows public routes only; `sitemap.xml` lists the 5 public URLs.
- [ ] Privacy Policy enumerates Firebase + Resend as sub-processors; describes self-service account-deletion as the right-to-erasure path and GDPR JSON export as the right-to-portability path.
- [ ] Custom items flagged with `UserPlus` badge on `ListItemRow`; exclude-from-suggestions one-tap from the edit sheet.
- [ ] Item names auto-capitalized on add and edit (shared `capitalizeInitial`).
- [ ] In-app notifications inbox: server-side fan-out (`notify-list-event`) writes one templated doc per recipient under `users/{uid}/notifications/{id}`; the client renders an anchored popover and batch-deletes on read; FIFO-capped at 50 docs per user (no FCM, no browser permission, no service worker).
- [ ] Item photos: client-side compressed to 800 px photo + 200 px thumb; stored under `lists/{listId}/items/{itemId}/` with collaborator-gated Storage rules (allow-list `image/jpeg | image/png | image/webp`, 5 MiB cap).
- [ ] Category reorder via drag-and-drop, open to all collaborators (not admin-only), persisted in `lists/{listId}.categoryOrder`.
- [ ] Undo delete for single + bulk item removal via toast + countdown; new schedules chain on the in-flight commit.
- [ ] GDPR data export downloads a JSON snapshot of every doc the user owns or collaborates on.
- [ ] Dark theme toggle in Settings with system-following default.

## Open Questions

None blocking. All v1 decisions locked. Status of previously out-of-scope items after Sprints 1-4:

- ~~Rate limiting on serverless endpoints: deferred.~~ **Shipped.** Firestore-backed token bucket (`rateLimits/{uid}_{funcName}`) used by `send-invite` and `notify-list-event`.
- ~~Push notifications: out of scope for v1.~~ **Shipped in Sprint 3** (FCM Web Push + dedicated `firebase-messaging-sw.js`, per-recipient `pushEnabled` gate, stale-token pruning), then **replaced in Sprint 4 (S4.2) by an in-app notifications inbox**: the OS-level surface bothered users who weren't actively in the app and required browser permission + a service worker. FCM Web Push, `push.service.ts`, `firebase-messaging-sw.js`, and `fcmTokens` were removed; `notify-list-event` now writes one doc per recipient into `users/{uid}/notifications/{id}`, rendered in an anchored popover and FIFO-capped at 50 docs/user.
- ~~Ownership transfer: out of scope for v1.~~ **Shipped** as part of the account-deletion cascade.
- ~~Dark theme: rejected.~~ **Shipped in Sprint 4** with system-following default + manual override.
- ~~Trash / soft-delete with recovery: rejected for v1.~~ **Shipped as Undo delete in Sprint 2** (toast countdown + commit chain) for items; list deletion remains immediate hard-delete with a confirm modal.
- ~~Error tracking (Sentry/Highlight): deferred to v1.x.~~ **Removed.** Sentry was shipped in Phase 12 and rolled back; no third-party error monitoring is wired up. The Privacy Policy was updated accordingly.
- ~~Item photos: out of scope.~~ **Shipped in Sprint 2** (client-side compression to photo + thumb, Storage with collaborator gate).
- ~~Drag-and-drop category reorder: out of scope.~~ **Shipped in Sprint 4** for all collaborators (not admin-only).
- ~~GDPR data export: out of scope.~~ **Shipped in Sprint 3** (JSON download from Settings).
- ~~Voice + bulk-paste input: out of scope.~~ **Shipped in Sprint 2** (`useSpeechRecognition`, `BulkPasteSheet`).
- ~~Onboarding tour: out of scope.~~ **Shipped in Sprint 4** (dismissal flag in `users/{uid}/private/state`).
- User-defined custom categories: still out of scope.
- Analytics: never on v1; reconsider only if usage data is genuinely needed.
