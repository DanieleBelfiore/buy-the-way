---
type: concept
tags: [architecture, vue]
sources: 2
updated: 2026-05-28
---

# Architecture

Vertical slices ship user-visible capability; foundation (Firebase, router, auth guard) underpins everything.

## Layering rule

**Components and stores never import the Firestore SDK directly.** All persistence goes through `src/services/*.service.ts`. Stores subscribe via services/composables and hold UI-ready state.

```
Views  -->  Stores (Pinia)  -->  Services  -->  Firebase
                |
                v
            Domain (pure)
```

`src/domain/` holds types, sorting, favorites ranking (`ranking.ts`), public catalog, IDs (`newId()` / ULID). No I/O.

## IDs and conflicts

- IDs: ULID via `newId()` - ordered, not timestamp-random.
- **Last-write-wins** per item: every mutation sets `updatedAt`; no CRDT.

## Realtime

List and item data use `onSnapshot` wrapped in composables/stores. Collaborators see edits in under ~1s under normal conditions (per spec success metrics).

## Views and routing

Any view reachable by direct URL must load its own data in `onMounted` - never assume a parent route populated Pinia first. See [routing](routing.md) and `.claude/docs/vue.md` (view self-containment).

## PWA

`vite-plugin-pwa` + Workbox: SW caches app shell; Firestore persistence handles offline data. See [offline and sync](offline-and-sync.md).

## Serverless boundary

Netlify Functions use `firebase-admin` (bypasses client rules). Client cannot read/write `rateLimits/*`. See [data model](data-model.md).

## Related

- [Data model](data-model.md)
- [Testing](testing.md)
