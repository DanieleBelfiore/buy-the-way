---
type: overview
tags: [buy-the-way]
sources: 3
updated: 2026-05-28
---

# buy-the-way overview

**buy-the-way** is a mobile-first PWA for shared grocery shopping lists: add items, check them off, share with household members. Real-time sync via Firestore; usable offline with automatic flush when online.

## Stack (short)

| Layer | Choice |
|-------|--------|
| UI | Vue 3 Composition API, Pinia, Vue Router, Tailwind |
| i18n | vue-i18n (it + en) |
| Backend | Firebase Auth, Firestore, Storage |
| Serverless | Netlify Functions + firebase-admin |
| Build / host | Vite, Netlify |
| Tests | Vitest (≥80% coverage), Playwright e2e, Firestore rules tests |

## Repository map (mental model)

```
src/views/          # route-level screens (must self-load data on direct URL)
src/stores/         # Pinia state + Firestore subscriptions
src/services/       # only layer that talks to Firebase SDK
src/domain/         # pure types, ranking, sort, catalogs
firebase/           # firestore.rules, storage.rules, indexes
netlify/functions/  # email, notify, rate limits (admin SDK)
.claude/docs/       # agent coding discipline (authoritative for agents)
wiki/               # compiled project knowledge (this tree)
raw/                # immutable ingested sources
SPEC.md             # product source of truth
```

## Core product loops

1. **Auth** - Google one-tap or email magic link; profile in `users/{uid}` + private state subcollection.
2. **Lists** - Owner creates lists; adds collaborators by registered email; realtime item sync.
3. **Items** - Autocomplete from personal + public catalog; categories, photos, voice, bulk paste, favorites algorithm.
4. **Notifications** - In-app inbox (no FCM, no browser permission); server function `notify-list-event` writes `users/{uid}/notifications` on list events.

## Where to read next

- [Architecture](concepts/architecture.md) - code boundaries
- [Data model](concepts/data-model.md) - Firestore and Storage
- [Auth and collaboration](concepts/auth-and-collaboration.md)
- [Offline and sync](concepts/offline-and-sync.md)
- [Testing](concepts/testing.md)
- [CI and deploy](concepts/ci-deploy.md)

## Agent vs wiki

| Need | Read |
|------|------|
| How to implement / test / commit | `.claude/docs/`, `CLAUDE.md` |
| What the product is and how subsystems connect | This wiki |
| Exact acceptance criteria | [`SPEC.md`](../SPEC.md) |

After changing `SPEC.md` or architecture, run **ingest** so wiki pages stay aligned.
