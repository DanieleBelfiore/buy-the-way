import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  adminsOf,
  capitalizeListName,
  createList,
  DuplicateListNameError,
  fetchUserLists,
  normalizeListName,
  renameList,
} from '@/services/lists.service';
import {
  bulkAddItems,
  bulkCopyItems,
  bulkMoveItems,
  bulkToggleChecked,
  emptyList,
  fetchItems,
  removeItem,
  updateItem,
} from '@/services/items.service';
import { fetchListHistory, recordListHistory } from '@/services/history.service';
import { CATEGORY_ORDER } from '@/domain/categories';
import { countUrgentItems } from '@/domain/priority';
import { capitalizeInitial } from '@/domain/text';
import type { ULID } from '@/domain/id';
import type { Category, Item, List } from '@/domain/types';

/**
 * The Buy The Way MCP server: 11 tools over the unchanged src/services.
 * Built fresh per request for the user resolved from the OAuth token; the
 * client SDK must already be signed in as that user (session.ts), so every
 * read and write goes through the Firestore rules.
 *
 * Tool scope and safety choices: tasks/mcp-plan.md (no list deletion, no
 * collaborators, no photos; destructive tools ask for confirmation).
 */

const NOT_FOUND = 'List not found, or not shared with you. Call list_lists to see the available lists.';

class ToolError extends Error {}

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
});

const fail = (message: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

const isPermissionDenied = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === 'permission-denied';

/** Uniform error mapping: the model gets an actionable sentence, never a stack. */
const guarded = <A>(name: string, run: (args: A) => Promise<unknown>) =>
  async (args: A): Promise<CallToolResult> => {
    try {
      return ok(await run(args));
    } catch (err) {
      if (err instanceof ToolError) return fail(err.message);
      if (err instanceof DuplicateListNameError) {
        return fail(`${err.message}. Pick another name or use the existing list.`);
      }
      if (isPermissionDenied(err)) return fail(NOT_FOUND);
      console.error(`[mcp] tool ${name} failed:`, err);
      return fail('Something went wrong on Buy The Way. Try again in a moment.');
    }
  };

// Bounds mirror firestore.rules, so invalid input fails here with a clear
// message instead of as a rules rejection.
const listId = z.string().min(1).max(64).describe('List id, from list_lists');
const itemId = z.string().min(1).max(64).describe('Item id, from get_list');
const itemIds = z.array(itemId).min(1).max(100);
const listName = z.string().trim().min(1).max(100);
const itemName = z.string().trim().min(1).max(200);
const quantity = z.string().trim().max(100);
const note = z.string().trim().max(1000);
const category = z.enum(CATEGORY_ORDER as [Category, ...Category[]]);
const priority = z.enum(['urgent', 'optional']);

const listView = (list: List, uid: string) => ({
  id: list.id,
  name: list.name,
  itemCount: list.itemCount ?? 0,
  urgentCount: list.urgentCount ?? 0,
  isAdmin: adminsOf(list).includes(uid),
  sharedWith: Math.max(0, list.collaboratorUids.length - 1),
});

const itemView = (item: Item) => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  category: item.category,
  checked: item.checked,
  ...(item.note ? { note: item.note } : {}),
  ...(item.priority ? { priority: item.priority } : {}),
});

const sameIds = (a: readonly Item[], b: readonly Item[]): boolean => {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((i) => i.id));
  return b.every((i) => ids.has(i.id));
};

const INSTRUCTIONS = `Buy The Way is a shared shopping-list app. Lists can be shared with other people, so changes appear live on their phones too.
- Start with list_lists to get list ids; use get_list before acting on items so you have their ids.
- Write item names in the user's language, as a shopper would ("Latte", "Mele"), one product per item. Put amounts in quantity, not in the name.
- Pick the closest category; use "other" when nothing fits.
- Mark an item "urgent" only when the user says it is needed soon.
- Never remove items or empty a list without the user's explicit confirmation.`;

export const buildMcpServer = (uid: string): McpServer => {
  const server = new McpServer(
    { name: 'buy-the-way', title: 'Buy The Way', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );

  const requireList = async (id: string): Promise<List> => {
    const list = (await fetchUserLists(uid)).find((l) => l.id === id);
    if (!list) throw new ToolError(NOT_FOUND);
    return list;
  };

  const requireItems = async (id: string, ids: readonly string[]): Promise<Item[]> => {
    const items = await fetchItems(id as ULID);
    const byId = new Map(items.map((i) => [i.id as string, i]));
    const missing = ids.filter((i) => !byId.has(i));
    if (missing.length > 0) {
      throw new ToolError(`Item not found in this list: ${missing.join(', ')}. Call get_list for current ids.`);
    }
    return ids.map((i) => byId.get(i)!);
  };

  server.registerTool(
    'list_lists',
    {
      title: 'List shopping lists',
      description: 'Lists every shopping list the user owns or shares, with item counts, urgent counts and whether the user is an admin of it.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded('list_lists', async () => ({
      lists: (await fetchUserLists(uid)).map((l) => listView(l, uid)),
    })),
  );

  server.registerTool(
    'get_list',
    {
      title: 'Read a list',
      description: 'Returns one list with all its items: name, quantity, category, note, checked (already bought) and priority (urgent / optional).',
      inputSchema: { list_id: listId },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded('get_list', async ({ list_id }: { list_id: string }) => {
      const list = await requireList(list_id);
      const items = await fetchItems(list.id);
      return { ...listView(list, uid), items: items.map(itemView) };
    }),
  );

  server.registerTool(
    'create_list',
    {
      title: 'Create a list',
      description: 'Creates a new shopping list owned by the user. Fails if the user already has a list with the same name (case-insensitive).',
      inputSchema: { name: listName.describe('List name, e.g. "Spesa" or "Grigliata sabato"') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    guarded('create_list', async ({ name }: { name: string }) => {
      const existing = (await fetchUserLists(uid)).map((l) => l.name);
      const id = await createList(name, uid, existing);
      return { id, name: capitalizeListName(name) };
    }),
  );

  server.registerTool(
    'add_items',
    {
      title: 'Add items',
      description: 'Adds up to 50 items to a list in one call. Check get_list first to avoid duplicates of items already there.',
      inputSchema: {
        list_id: listId,
        items: z
          .array(
            z.object({
              name: itemName.describe('Product name, in the user\'s language'),
              category,
              quantity: quantity.optional().describe('Free text, e.g. "2", "1 kg", "a bunch"'),
              note: note.optional(),
              priority: priority.optional().describe('Only when the user asks: urgent = needed soon'),
            }),
          )
          .min(1)
          .max(50),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    guarded('add_items', async ({ list_id, items }: {
      list_id: string;
      items: Array<{ name: string; category: Category; quantity?: string; note?: string; priority?: 'urgent' | 'optional' }>;
    }) => {
      const list = await requireList(list_id);
      const ids = await bulkAddItems({ listId: list.id, rows: items, createdByUid: uid, addedVia: 'assistant' });
      return { added: items.map((row, i) => ({ id: ids[i], name: capitalizeInitial(row.name) })) };
    }),
  );

  server.registerTool(
    'set_item_checked',
    {
      title: 'Check off items',
      description: 'Marks items as bought (checked: true) or puts them back on the list (checked: false).',
      inputSchema: { list_id: listId, item_ids: itemIds, checked: z.boolean() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    guarded('set_item_checked', async ({ list_id, item_ids, checked }: { list_id: string; item_ids: string[]; checked: boolean }) => {
      const list = await requireList(list_id);
      await requireItems(list.id, item_ids);
      await bulkToggleChecked(list.id, item_ids as ULID[], checked);
      return { updated: item_ids.length, checked };
    }),
  );

  server.registerTool(
    'update_item',
    {
      title: 'Edit an item',
      description: 'Changes name, quantity, note, category or priority of one item. Only the fields passed are changed; priority null removes it.',
      inputSchema: {
        list_id: listId,
        item_id: itemId,
        name: itemName.optional(),
        quantity: quantity.optional(),
        note: note.optional(),
        category: category.optional(),
        priority: priority.nullable().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    guarded('update_item', async ({ list_id, item_id, ...patch }: {
      list_id: string;
      item_id: string;
      name?: string;
      quantity?: string;
      note?: string;
      category?: Category;
      priority?: 'urgent' | 'optional' | null;
    }) => {
      if (Object.values(patch).every((v) => v === undefined)) {
        throw new ToolError('Nothing to change: pass at least one of name, quantity, note, category, priority.');
      }
      const list = await requireList(list_id);
      await requireItems(list.id, [item_id]);
      await updateItem(list.id, item_id as ULID, patch);
      return { updated: item_id };
    }),
  );

  server.registerTool(
    'remove_item',
    {
      title: 'Remove an item',
      description: 'Deletes one item from a list, for everyone sharing it. Cannot be undone. Confirm with the user first; to mark something as bought use set_item_checked instead.',
      inputSchema: { list_id: listId, item_id: itemId },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    guarded('remove_item', async ({ list_id, item_id }: { list_id: string; item_id: string }) => {
      const list = await requireList(list_id);
      await requireItems(list.id, [item_id]);
      await removeItem(list.id, item_id as ULID);
      return { removed: item_id };
    }),
  );

  const transfer = (mode: 'move' | 'copy') =>
    async ({ list_id, item_ids, to_list_id }: { list_id: string; item_ids: string[]; to_list_id: string }) => {
      if (list_id === to_list_id) throw new ToolError('Source and destination are the same list.');
      const [src, dst] = [await requireList(list_id), await requireList(to_list_id)];
      const items = await requireItems(src.id, item_ids);
      const ids = mode === 'move'
        ? await bulkMoveItems(src.id, items, dst.id, uid)
        : await bulkCopyItems(items, dst.id, uid);
      return { [mode === 'move' ? 'moved' : 'copied']: ids.length, to: { id: dst.id, name: dst.name }, newItemIds: ids };
    };

  server.registerTool(
    'move_items',
    {
      title: 'Move items to another list',
      description: 'Moves items from one list to another: they leave the source list. Both lists must be shared with the user.',
      inputSchema: { list_id: listId, item_ids: itemIds, to_list_id: listId.describe('Destination list id') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    guarded('move_items', transfer('move')),
  );

  server.registerTool(
    'copy_items',
    {
      title: 'Copy items to another list',
      description: 'Copies items into another list; the source list is unchanged. Both lists must be shared with the user.',
      inputSchema: { list_id: listId, item_ids: itemIds, to_list_id: listId.describe('Destination list id') },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    guarded('copy_items', transfer('copy')),
  );

  server.registerTool(
    'rename_list',
    {
      title: 'Rename a list',
      description: 'Renames a list. Only admins of the list can do it (isAdmin in list_lists). Fails if another list of the user has the same name.',
      inputSchema: { list_id: listId, name: listName },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    guarded('rename_list', async ({ list_id, name }: { list_id: string; name: string }) => {
      const lists = await fetchUserLists(uid);
      const list = lists.find((l) => l.id === list_id);
      if (!list) throw new ToolError(NOT_FOUND);
      if (!adminsOf(list).includes(uid)) {
        throw new ToolError('Only an admin of this list can rename it. Ask the list owner.');
      }
      const formatted = capitalizeListName(name);
      const target = normalizeListName(formatted);
      if (lists.some((l) => l.id !== list.id && normalizeListName(l.name) === target)) {
        throw new DuplicateListNameError(formatted);
      }
      await renameList(list.id, name);
      return { id: list.id, name: formatted };
    }),
  );

  server.registerTool(
    'empty_list',
    {
      title: 'Empty a list',
      description: 'Removes items from a list for everyone sharing it. Before calling, ask the user whether to remove ALL items or only the ones already CHECKED off (bought), unless they already said which, then confirm. A snapshot is saved in the list history, as the app does.',
      inputSchema: {
        list_id: listId,
        scope: z.enum(['all', 'checked']).describe('"all" removes every item, "checked" only the ones already bought'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    guarded('empty_list', async ({ list_id, scope }: { list_id: string; scope: 'all' | 'checked' }) => {
      const list = await requireList(list_id);
      const items = await fetchItems(list.id);
      const targets = scope === 'checked' ? items.filter((i) => i.checked) : items;
      if (targets.length === 0) return { removed: 0, scope };

      // Same snapshot rule as useListDetailActions.handleEmptyList. The app
      // guards "one snapshot per shopping cycle" in sessionStorage, which a
      // function does not have: skip when the newest entry already holds
      // exactly these items (e.g. the app snapshotted a completion).
      const snapshot = scope === 'checked' ? targets : items;
      const [latest] = await fetchListHistory(list.id, { limit: 1 });
      if (!latest || !sameIds(latest.items, snapshot)) {
        await recordListHistory(list.id, snapshot, uid, 'empty_fallback');
      }
      await emptyList(list.id, targets.map((i) => i.id), { urgentRemoved: countUrgentItems(targets) });
      return { removed: targets.length, scope };
    }),
  );

  return server;
};
