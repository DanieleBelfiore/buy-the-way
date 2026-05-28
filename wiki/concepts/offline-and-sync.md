---
type: concept
tags: [offline, firestore]
sources: 2
updated: 2026-05-28
---

# Offline and sync

## Offline-first

Firestore SDK **persistence** (IndexedDB) keeps lists readable and writable offline. Service worker caches the **static shell** only (Workbox via vite-plugin-pwa).

Success criteria (from spec): zero data loss offline-to-online; LWW per item.

## Conflict model

**Last-write-wins:** each write updates `updatedAt`. No merge of concurrent edits beyond latest timestamp.

## Realtime

Collaborators subscribe to list + items snapshots. Target: edits visible in under 1s on normal networks.

## Client-only persistence

Examples (not Firestore): collapsed category state per list, theme, haptic opt-out - `localStorage` keys documented in SPEC/README.

## Related

- [Architecture](architecture.md)
- [Data model](data-model.md)
