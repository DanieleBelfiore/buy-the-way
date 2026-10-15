---
type: concept
tags: [firebase, firestore]
sources: 2
updated: 2026-10-15
---

# Data model

Firestore is default-deny; every new path needs a rule in the **same task** as the code ([firebase discipline](../sources/claude-docs.md)).

## Firestore paths

| Path | Purpose |
|------|---------|
| `users/{uid}` | Public profile: `uid`, `email`, `displayName`, `photoURL` (readable by any signed-in user for lookup/avatars) |
| `users/{uid}/private/state` | Owner-only: onboarding, `defaultListId`, `lastSeenLists`, etc. |
| `users/{uid}/notifications/{id}` | In-app notification feed; server write, owner read/delete |
| `lists/{listId}` | `ownerUid`, `collaboratorUids`, `admins`, name, wallpaper, `categoryOrder`. No item counts (see below) |
| `lists/{listId}/items/{itemId}` | Item fields: name, qty, category, checked, priority, photos URLs, timestamps, optional immutable `addedVia` |
| `lists/{listId}/favoriteState/{slug}` | Per-list favorites shelf: usage counts, `pinned` / `excluded` / `dismissedFavorite` |
| `lists/{listId}/history/{historyId}` | Immutable completed-shopping snapshots (see below); read by the suggest sheet |
| `catalog/{uid}/entries/{entryId}` | Personal catalog: usage, pinned, excluded |
| `rateLimits/{uid}_{funcName}` | Token bucket for Netlify functions; **client deny all** |
| `oauthClients`, `oauthCodes`, `oauthTokens`, `oauthGrants`, `config/mcp` | MCP server and its OAuth state, see below |

Subcollection rules must `get()` the parent list doc to verify collaborator membership - rules do not inherit.

## MCP and OAuth collections

Written only by Netlify functions through firebase-admin ([MCP server](mcp-server.md)).

| Path | Content | Client access |
|------|---------|---------------|
| `oauthClients/{clientId}` | Registered clients: `redirectUris`, `clientName`, `createdAt` | none |
| `oauthCodes/{sha256(code)}` | Single-use auth codes, PKCE challenge, `expiresAtMs`, `expireAt` (TTL) | none |
| `oauthTokens/{sha256(token)}` | Access and refresh tokens: `uid`, `clientId`, `grantId`, `kind`, `expiresAtMs`, `expireAt` (TTL), `usedAtMs` | none |
| `oauthGrants/{grantId}` | One per user + client: `uid`, `clientId`, `clientName`, `createdAt`, `lastUsedAt` | owner read |
| `config/mcp` | Beta gate: `open`, `allowedUids` | none |

`grantId` is `sha256(uid:clientId)`. A Firestore TTL policy on `expireAt` purges expired codes and tokens.

## Item counts are derived, never stored

The list doc used to carry denormalized `itemCount` / `urgentCount`, bumped with `increment()` next to every item write. They drifted (a lost write left them wrong forever) and were dropped on 2026-10-15. Counts now always come from the item docs: the lists overview uses `stores/listItemCounts` (one items listener per list), the detail view counts its loaded items, the MCP `list_lists` tool uses `countListItems` (`count()` aggregations). Old docs may still hold the fields until `pnpm firebase:drop-list-counters --apply` runs; the rules keep accepting them for app builds released before the change ([`tasks/drop-list-counters.md`](../../tasks/drop-list-counters.md)).

Other counters are event counts, not copies of existing data, so they cannot drift against anything: `usageCount` on catalog entries and favorite state (how often a product was added, input for ranking), `completedShopCount` on `users/{uid}/private/state`. The history entry `itemCount` is immutable and pinned by the rules to `items.size()`.

## List history (`lists/{listId}/history`)

Per-list, immutable records of finished shopping runs. Collaborators can read via rules. The suggest sheet (below) is the only reader in the app.

**Document shape (`ListHistoryEntry`):** `id`, `listId`, `completedAt`, `itemCount`, `recordedByUid`, `trigger`, `items[]`.

- **`items`:** full `Item` snapshot at write time (all live item fields, not a trimmed subset).
- **`trigger`:** `completion` when every item becomes checked; `empty_fallback` when the list is emptied without a completion snapshot in the current cycle.
- **Writes:** create-only (no updates). At most one snapshot per shopping cycle; a `sessionStorage` guard avoids duplicate `completion` + `empty_fallback` after refresh.
- **Retention:** newest **50** entries per list (`HISTORY_MAX_ENTRIES` in `src/domain/history.ts`); older docs pruned on insert.
- **Reads:** `fetchListHistory(listId, { limit? })` returns newest-first snapshots (default limit = cap).
- **Lifecycle:** cascade-deleted with the parent list (`deleteList`); included in GDPR export (`export.service.ts`).

Service: `src/services/history.service.ts` (`recordListHistory`, `fetchListHistory`, `pruneListHistory`, `deleteAllListHistory`). Rules: `match /history/{historyId}` under `lists/{listId}` in `firebase/firestore.rules`.

### History-based suggestions (wand)

The wand button in the `ListDetailView` header (right end of the "last updated" stats row, under the settings icon) opens `SuggestSheet`: items proposed from the list history, pre-ticked when due, committed through `bulkAddItems` with `addedVia: 'suggested'` and the last purchased quantity. No AI, no network beyond one `fetchListHistory` read; the engine is the pure function `buildSuggestions` in `src/domain/suggest.ts`.

- **Input:** every history entry counts as a shopping run and every item in it as bought, whatever the `trigger` or `checked` flag. Entries from the same local calendar day merge into one run (covers double writes from a second tab or collaborator).
- **Identity:** `normalizeName(name)`; display name, category and quantity come from the most recent purchase.
- **3+ purchases (cadence):** score = max(runs since last purchase / median gap in runs, days since last purchase / median gap in days). Score >= 0.8 pre-ticked, >= 0.5 listed unticked, below that hidden. Run score > 4 means a dropped habit: hidden.
- **2 purchases (frequency fallback):** share of the last 8 runs containing the item; >= 60% pre-ticked, >= 30% listed.
- **Excluded:** items bought once, items already on the list. Fewer than 2 runs: the sheet shows a "not enough history" message.
- **Known gap:** deleting items one by one instead of ticking them records no history, so those shops never feed the engine.

Thresholds are named constants at the top of `src/domain/suggest.ts`.

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
| `suggested` | Picked in the suggest sheet (wand), proposed from shopping history |
| `copy` | Copied from another list |
| `move` | Moved from another list |

Copied into list `history` snapshots automatically (full `Item` shape).

## Privacy split

Never put new per-user flags on the public `users/{uid}` doc if collaborators should not see them - use `private/state` ([firebase.md](../../.claude/docs/firebase.md)).

## Related

- [Auth and collaboration](auth-and-collaboration.md)
- [Offline and sync](offline-and-sync.md)
- Live rules: [`firebase/firestore.rules`](../../firebase/firestore.rules)
