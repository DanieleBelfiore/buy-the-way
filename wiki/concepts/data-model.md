---
type: concept
tags: [firebase, firestore]
sources: 2
updated: 2026-05-28
---

# Data model

Firestore is default-deny; every new path needs a rule in the **same task** as the code ([firebase discipline](../sources/claude-docs.md)).

## Firestore paths

| Path | Purpose |
|------|---------|
| `users/{uid}` | Public profile: `uid`, `email`, `displayName`, `photoURL` (readable by any signed-in user for lookup/avatars) |
| `users/{uid}/private/state` | Owner-only: onboarding, `defaultListId`, `lastSeenLists`, push prefs, etc. |
| `users/{uid}/notifications/{id}` | In-app notification feed; server write, owner read/delete |
| `lists/{listId}` | `ownerUid`, `collaboratorUids`, `admins`, name, wallpaper, `categoryOrder`, counts |
| `lists/{listId}/items/{itemId}` | Item fields: name, qty, category, checked, priority, photos URLs, timestamps, optional immutable `addedVia` |
| `lists/{listId}/favoriteState/{slug}` | Per-list favorites shelf: usage counts, `pinned` / `excluded` / `dismissedFavorite` |
| `lists/{listId}/history/{historyId}` | Immutable completed-shopping snapshots (see below); no UI in v1 |
| `catalog/{uid}/entries/{entryId}` | Personal catalog: usage, pinned, excluded |
| `rateLimits/{uid}_{funcName}` | Token bucket for Netlify functions; **client deny all** |

Subcollection rules must `get()` the parent list doc to verify collaborator membership - rules do not inherit.

## List history (`lists/{listId}/history`)

Per-list, immutable records of finished shopping runs. Intended for future suggest / LLM layers; collaborators can read via rules but nothing in the app surfaces this yet.

**Document shape (`ListHistoryEntry`):** `id`, `listId`, `completedAt`, `itemCount`, `recordedByUid`, `trigger`, `items[]`.

- **`items`:** full `Item` snapshot at write time (all live item fields, not a trimmed subset).
- **`trigger`:** `completion` when every item becomes checked; `empty_fallback` when the list is emptied without a completion snapshot in the current cycle.
- **Writes:** create-only (no updates). At most one snapshot per shopping cycle; a `sessionStorage` guard avoids duplicate `completion` + `empty_fallback` after refresh.
- **Retention:** newest **50** entries per list (`HISTORY_MAX_ENTRIES` in `src/domain/history.ts`); older docs pruned on insert.
- **Reads:** `fetchListHistory(listId, { limit? })` returns newest-first snapshots (default limit = cap).
- **Lifecycle:** cascade-deleted with the parent list (`deleteList`); included in GDPR export (`export.service.ts`).

Service: `src/services/history.service.ts` (`recordListHistory`, `fetchListHistory`, `pruneListHistory`, `deleteAllListHistory`). Rules: `match /history/{historyId}` under `lists/{listId}` in `firebase/firestore.rules`.

## Storage

```
lists/{listId}/items/{itemId}/photo.jpg   # ~800px JPEG
lists/{listId}/items/{itemId}/thumb.jpg   # ~200px JPEG
```

Collaborator-gated in `firebase/storage.rules`. Allowed types: jpeg, png, webp (no SVG). Bucket **CORS** is separate from `firebase deploy` - see README `pnpm storage:cors`.

Storage rules may call `firestore.get()` - enable Storage-Firestore link on first deploy.

## Item add provenance (`addedVia`)

Optional on legacy items; **required on create** for new writes. Immutable after create (not in item update allow-list).

| Value | Meaning |
|-------|---------|
| `autocomplete` | Typed or picked via `ItemAutocomplete` |
| `favorite` | One-tap from favorites shelf / sheet |
| `bulk` | Bulk paste sheet |
| `voice` | Voice add sheet |
| `copy` | Copied from another list |
| `move` | Moved from another list |

Copied into list `history` snapshots automatically (full `Item` shape).

## Privacy split

Never put new per-user flags on the public `users/{uid}` doc if collaborators should not see them - use `private/state` ([firebase.md](../../.claude/docs/firebase.md)).

## Related

- [Auth and collaboration](auth-and-collaboration.md)
- [Offline and sync](offline-and-sync.md)
- Live rules: [`firebase/firestore.rules`](../../firebase/firestore.rules)
