---
type: concept
tags: [offline, firestore]
sources: 2
updated: 2026-10-13
---

# Offline and sync

## Offline-first

Firestore SDK **persistence** (IndexedDB) keeps lists readable and writable offline. Service worker caches the **static shell** only (Workbox via vite-plugin-pwa).

Success criteria (from spec): zero data loss offline-to-online; LWW per item.

## Conflict model

**Last-write-wins:** each write updates `updatedAt`. No merge of concurrent edits beyond latest timestamp.

## Realtime

Collaborators subscribe to list + items snapshots. Target: edits visible in under 1s on normal networks.

## Cold boot

A cold open (app launch, or Android discarding the installed PWA in the background) must paint from local data, with no Firestore round trip in front of the first view. Three places enforce it:

- `onAuthChanged` (`src/services/auth.service.ts`): when the first auth event of the page load already carries a user, the session was restored from local persistence. The callback fires at once and the per-sign-in work (profile upsert, legacy migration, `lastLoginAt`, invite claim) runs in the background. A real sign-in (a user arriving after a signed-out event) still awaits that work, so a new account has its profile doc before any view reads it.
- Router guard: the default-list redirect resolves from a `localStorage` cache, see [routing](routing.md).
- `ListsView`: the lists subscription starts without waiting for `listsStore.loadLastSeen()`. `lastSeenLoaded` keeps `isNewForUser` false until the seen map arrives, so shared lists do not flash a NEW badge.

Why it matters beyond speed: with the persistent cache a Firestore write only settles on server ack, so awaiting one at boot leaves the splash up indefinitely when offline.

Heavy code that is not needed for the first paint stays off the boot path too: the `dotlottie` player is loaded on first render through `src/components/ui/LazyDotLottie.ts`. Import that wrapper, never `@lottiefiles/dotlottie-vue` directly, from anything a view imports statically.

Still on the boot path: parsing the Firestore SDK chunk (about 530 kB minified), needed before any list can render.

## Client-only persistence

Examples (not Firestore): collapsed category state per list, theme, haptic opt-out, cached default list id per user - `localStorage` keys documented in SPEC/README.

## Related

- [Architecture](architecture.md)
- [Data model](data-model.md)
