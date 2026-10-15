# Drop the denormalized list counters

Started 2026-10-15.

## Why

`lists/{id}.itemCount` / `urgentCount` were copies of data the item docs already hold, bumped with `increment()` next to every item write. Any lost or partial write left them wrong for good (production, 2026-10-15: Eurospin stored 5 with 9 real items). The app had already stopped trusting them (live counts since v1.17) and `ListDetailView` kept patching `urgentCount` back; only the MCP `list_lists` tool still read them as-is.

Other counters stay: `usageCount` (catalog, favorite state) and `completedShopCount` count events and are not copies of anything, and the history entry `itemCount` is immutable and pinned by the rules to `items.size()`.

## Step 1: stop writing and reading (this change)

- Item writes bump `lists/{id}.updatedAt` only (`listTouch` in `src/services/items.service.ts`). `removeItem` and `updateItem` no longer read the item first.
- `createList` no longer seeds the counters; `reconcileListUrgentCount` and its watcher are gone.
- `ListCard` shows neither a count nor "Empty" until the live count arrives.
- MCP: `list_lists` uses `countListItems` (two `count()` aggregations per list), `get_list` counts the items it already loaded.
- Rules: counters optional on create (zero if present), still writable as numbers on update. **Kept for builds released before this change**: they batch a counter increment with every item write, and a rejected field would fail the whole batch, item included. Installed PWAs update only when the user accepts the prompt (`registerType: 'prompt'`).

## Step 2: clean production docs (after step 1 is deployed)

```bash
pnpm firebase:drop-list-counters           # dry run, read-only
pnpm firebase:drop-list-counters --apply   # asks for the project ID, then writes
```

Dry run on 2026-10-15: 11 lists scanned, 11 with legacy counters.

A list used from an old build afterwards gets the field back through `increment()`. Harmless, nothing reads it.

## Step 3: close the legacy path (a few weeks later)

When old builds are no longer in use:

- [ ] Remove `itemCount` / `urgentCount` from `firebase/firestore.rules`: the `validListUpdateValues` checks, the create `get(...) == 0` lines and the `hasOnly` lists (create, admin update, collaborator update).
- [ ] Replace the LEGACY rules tests in `tests/rules/firestore.rules.test.ts` with "denies writing itemCount / urgentCount".
- [ ] Run `pnpm firebase:drop-list-counters --apply` again for fields re-added by old builds.
