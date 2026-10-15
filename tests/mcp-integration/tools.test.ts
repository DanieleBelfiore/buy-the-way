import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { buildMcpServer } from '@/../netlify/mcp/server';
import { ensureSignedIn } from '@/../netlify/mcp/session';
import { ensureAuthUser } from './auth-users';
import { normalizeName } from '@/domain/public-catalog';

// The 17 MCP tools end to end: an MCP client talks to the real server over an
// in-memory transport, the server runs the unchanged src/services through the
// client SDK signed in with a custom token, against the emulators and the
// real rules. Same path as production minus HTTP and OAuth (covered by
// mcp-handler.test.ts).

const OWNER = 'tools-owner';
const MEMBER = 'tools-member';
const STRANGER = 'tools-stranger';

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }> };

const connectAs = async (uid: string): Promise<Client> => {
  await ensureAuthUser(uid);
  await ensureSignedIn(uid);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await buildMcpServer(uid).connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  return client;
};

const call = async (client: Client, name: string, args: Record<string, unknown>) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

const json = <T = any>(r: ToolResult): T => {
  expect(r.isError, r.content[0]?.text).toBeFalsy();
  return JSON.parse(r.content[0]!.text) as T;
};

type ListSummary = { id: string; itemCount: number; urgentCount: number };

/** Counts as list_lists reports them, for one list. */
const countsOf = async (client: Client, id: string) => {
  const lists = json<{ lists: ListSummary[] }>(await call(client, 'list_lists', {})).lists;
  const { itemCount, urgentCount } = lists.find((l) => l.id === id)!;
  return { itemCount, urgentCount };
};

const errorText = (r: ToolResult): string => {
  expect(r.isError).toBe(true);
  return r.content[0]!.text;
};

beforeAll(() => {
  if (!process.env['FIREBASE_AUTH_EMULATOR_HOST']) throw new Error('Run through `pnpm test:mcp`');
  if (getApps().length === 0) initializeApp({ projectId: 'demo-buy-the-way' });
});

afterAll(async () => {
  await signOut(auth);
});

describe('MCP tools', () => {
  let owner: Client;
  let spesa: string;
  let weekend: string;

  it('lists the 17 tools with safety annotations', async () => {
    owner = await connectAs(OWNER);
    const { tools } = await owner.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_items', 'copy_items', 'create_list', 'empty_list', 'get_favorites', 'get_history',
      'get_list', 'get_stats', 'list_lists', 'move_items', 'remove_item', 'rename_list',
      'set_default_list', 'set_favorite', 'set_item_checked', 'suggest_items', 'update_item',
    ]);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName['list_lists']!.annotations?.readOnlyHint).toBe(true);
    expect(byName['get_list']!.annotations?.readOnlyHint).toBe(true);
    for (const name of ['get_favorites', 'suggest_items', 'get_history', 'get_stats']) {
      expect(byName[name]!.annotations?.readOnlyHint).toBe(true);
    }
    expect(byName['remove_item']!.annotations?.destructiveHint).toBe(true);
    expect(byName['empty_list']!.annotations?.destructiveHint).toBe(true);
    expect(byName['add_items']!.annotations?.destructiveHint).toBe(false);
    // empty_list mirrors the app's dialog: scope is required, no default.
    expect((byName['empty_list']!.inputSchema as { required?: string[] }).required).toContain('scope');
    for (const t of tools) expect(t.description!.length).toBeGreaterThan(30);
  });

  it('creates lists and refuses a duplicate name', async () => {
    spesa = json<{ id: string }>(await call(owner, 'create_list', { name: 'spesa' })).id;
    weekend = json<{ id: string }>(await call(owner, 'create_list', { name: 'weekend' })).id;
    expect(errorText(await call(owner, 'create_list', { name: 'Spesa' }))).toMatch(/already/i);

    const lists = json<{ lists: Array<{ id: string; name: string; isAdmin: boolean }> }>(await call(owner, 'list_lists', {})).lists;
    expect(lists.map((l) => l.name).sort()).toEqual(['Spesa', 'Weekend']);
    expect(lists.every((l) => l.isAdmin)).toBe(true);
  });

  it('adds items tagged as added by the assistant', async () => {
    const added = json<{ added: Array<{ id: string; name: string }> }>(await call(owner, 'add_items', {
      list_id: spesa,
      items: [
        { name: 'latte', quantity: '2', category: 'dairy' },
        { name: 'mele', quantity: '1 kg', category: 'fruit_vegetables', note: 'golden' },
        { name: 'pane', category: 'bakery', priority: 'urgent' },
      ],
    })).added;
    expect(added.map((i) => i.name)).toEqual(['Latte', 'Mele', 'Pane']);

    const list = json(await call(owner, 'get_list', { list_id: spesa }));
    expect(list.name).toBe('Spesa');
    expect(list.items).toHaveLength(3);
    expect(list.items.find((i: { name: string }) => i.name === 'Pane').priority).toBe('urgent');
    expect(list).toMatchObject({ itemCount: 3, urgentCount: 1 });
    expect(await countsOf(owner, spesa)).toEqual({ itemCount: 3, urgentCount: 1 });
    // Counts are derived from the item docs, never stored on the list.
    const doc = await getFirestore().collection('lists').doc(spesa).get();
    expect(doc.data()).not.toHaveProperty('itemCount');
    expect(doc.data()).not.toHaveProperty('urgentCount');
    const items = await getFirestore().collection('lists').doc(spesa).collection('items').get();
    expect(items.docs.every((d) => d.data()['addedVia'] === 'assistant')).toBe(true);
  });

  it('rejects an unknown category through the schema, before any write', async () => {
    const r = await call(owner, 'add_items', { list_id: spesa, items: [{ name: 'x', category: 'toys' }] });
    expect(r.isError).toBe(true);
    expect((await countsOf(owner, spesa)).itemCount).toBe(3);
  });

  it('reports real counts even when a legacy doc holds stale counters', async () => {
    await getFirestore().collection('lists').doc(spesa).update({ itemCount: 99, urgentCount: 42 });
    expect(await countsOf(owner, spesa)).toEqual({ itemCount: 3, urgentCount: 1 });
    expect(json(await call(owner, 'get_list', { list_id: spesa }))).toMatchObject({ itemCount: 3, urgentCount: 1 });
    await getFirestore().collection('lists').doc(spesa).update({
      itemCount: FieldValue.delete(),
      urgentCount: FieldValue.delete(),
    });
  });

  it('checks, edits and removes items', async () => {
    const items = json(await call(owner, 'get_list', { list_id: spesa })).items as Array<{ id: string; name: string }>;
    const id = (n: string) => items.find((i) => i.name === n)!.id;

    json(await call(owner, 'set_item_checked', { list_id: spesa, item_ids: [id('Latte'), id('Mele')], checked: true }));
    json(await call(owner, 'update_item', { list_id: spesa, item_id: id('Latte'), quantity: '3', note: 'scremato' }));
    json(await call(owner, 'update_item', { list_id: spesa, item_id: id('Pane'), priority: null }));
    json(await call(owner, 'remove_item', { list_id: spesa, item_id: id('Mele') }));

    const after = json(await call(owner, 'get_list', { list_id: spesa })).items as Array<Record<string, unknown>>;
    expect(after.map((i) => i['name']).sort()).toEqual(['Latte', 'Pane']);
    expect(after.find((i) => i['name'] === 'Latte')).toMatchObject({ checked: true, quantity: '3', note: 'Scremato' });
    expect(after.find((i) => i['name'] === 'Pane')!['priority']).toBeUndefined();
    expect(await countsOf(owner, spesa)).toEqual({ itemCount: 2, urgentCount: 0 });
    expect(errorText(await call(owner, 'remove_item', { list_id: spesa, item_id: 'missing' }))).toMatch(/not found/i);
  });

  it('copies and moves items between lists', async () => {
    const items = json(await call(owner, 'get_list', { list_id: spesa })).items as Array<{ id: string; name: string }>;
    const latte = items.find((i) => i.name === 'Latte')!.id;
    const pane = items.find((i) => i.name === 'Pane')!.id;

    json(await call(owner, 'copy_items', { list_id: spesa, item_ids: [latte], to_list_id: weekend }));
    json(await call(owner, 'move_items', { list_id: spesa, item_ids: [pane], to_list_id: weekend }));

    const src = json(await call(owner, 'get_list', { list_id: spesa })).items.map((i: { name: string }) => i.name);
    const dst = json(await call(owner, 'get_list', { list_id: weekend })).items.map((i: { name: string }) => i.name).sort();
    expect(src).toEqual(['Latte']);
    expect(dst).toEqual(['Latte', 'Pane']);
    expect(errorText(await call(owner, 'move_items', { list_id: spesa, item_ids: ['nope'], to_list_id: weekend }))).toMatch(/not found/i);
  });

  it('renames a list (admin only) and refuses a name taken by another list', async () => {
    json(await call(owner, 'rename_list', { list_id: weekend, name: 'gita al lago' }));
    expect(json(await call(owner, 'get_list', { list_id: weekend })).name).toBe('Gita al lago');
    expect(errorText(await call(owner, 'rename_list', { list_id: weekend, name: 'spesa' }))).toMatch(/already/i);

    await getFirestore().collection('lists').doc(spesa).update({ collaboratorUids: FieldValue.arrayUnion(MEMBER) });
    const member = await connectAs(MEMBER);
    expect(json(await call(member, 'get_list', { list_id: spesa })).name).toBe('Spesa');
    expect(errorText(await call(member, 'rename_list', { list_id: spesa, name: 'mia' }))).toMatch(/admin/i);
    owner = await connectAs(OWNER);
  });

  it('empties a list: requires a scope, snapshots history once, honours the scope', async () => {
    json(await call(owner, 'add_items', { list_id: spesa, items: [{ name: 'uova', category: 'other' }] }));
    const noScope = await call(owner, 'empty_list', { list_id: spesa });
    expect(noScope.isError).toBe(true);

    // Latte is checked, Uova is not: "checked" removes Latte only.
    expect(json(await call(owner, 'empty_list', { list_id: spesa, scope: 'checked' }))).toMatchObject({ removed: 1 });
    let names = json(await call(owner, 'get_list', { list_id: spesa })).items.map((i: { name: string }) => i.name);
    expect(names).toEqual(['Uova']);

    expect(json(await call(owner, 'empty_list', { list_id: spesa, scope: 'all' }))).toMatchObject({ removed: 1 });
    names = json(await call(owner, 'get_list', { list_id: spesa })).items;
    expect(names).toEqual([]);
    expect(await countsOf(owner, spesa)).toEqual({ itemCount: 0, urgentCount: 0 });

    const history = await getFirestore().collection('lists').doc(spesa).collection('history').get();
    expect(history.size).toBe(2);
    expect(history.docs.every((d) => d.data()['trigger'] === 'empty_fallback')).toBe(true);

    // Emptying an empty list is a no-op, no extra history.
    expect(json(await call(owner, 'empty_list', { list_id: spesa, scope: 'all' }))).toMatchObject({ removed: 0 });
    expect((await getFirestore().collection('lists').doc(spesa).collection('history').get()).size).toBe(2);
  });

  it('never reaches lists the user is not a member of', async () => {
    const stranger = await connectAs(STRANGER);
    expect(json(await call(stranger, 'list_lists', {})).lists).toEqual([]);
    expect(errorText(await call(stranger, 'get_list', { list_id: spesa }))).toMatch(/not found/i);
    expect(errorText(await call(stranger, 'add_items', { list_id: spesa, items: [{ name: 'x', category: 'other' }] }))).toMatch(/not found/i);
    expect(errorText(await call(stranger, 'empty_list', { list_id: weekend, scope: 'all' }))).toMatch(/not found/i);
    owner = await connectAs(OWNER);
    expect(json(await call(owner, 'get_list', { list_id: weekend })).items).toHaveLength(2);
  });
});

describe('MCP tools: favorites, suggestions, history, stats, default list', () => {
  const PLANNER = 'tools-planner';
  const DAY = 24 * 60 * 60 * 1000;
  let planner: Client;
  let casa: string;

  const seedHistory = async (listId: string, daysAgo: number, names: string[]) => {
    const id = `h${daysAgo}`;
    await getFirestore().collection('lists').doc(listId).collection('history').doc(id).set({
      id,
      listId,
      completedAt: Date.now() - daysAgo * DAY,
      itemCount: names.length,
      recordedByUid: PLANNER,
      trigger: 'completion',
      items: names.map((name) => ({ id: `${id}-${name}`, name, category: 'other', quantity: '1', checked: true })),
    });
  };

  const seedFavorite = async (listId: string, name: string, usageCount: number) => {
    const slug = normalizeName(name);
    await getFirestore().collection('lists').doc(listId).collection('favoriteState').doc(slug).set({
      slug, name, category: 'other', usageCount, lastUsedAt: Date.now(),
    });
  };

  const favoriteNames = async () =>
    json<{ favorites: Array<{ name: string; pinned?: boolean }> }>(await call(planner, 'get_favorites', { list_id: casa })).favorites;

  it('sets up a list with history and favorites', async () => {
    planner = await connectAs(PLANNER);
    await getFirestore().collection('users').doc(PLANNER).set({ uid: PLANNER, email: 'p@example.com', displayName: 'P' });
    casa = json<{ id: string }>(await call(planner, 'create_list', { name: 'casa' })).id;
    json(await call(planner, 'add_items', { list_id: casa, items: [{ name: 'pane', category: 'bakery' }] }));
    for (const daysAgo of [21, 14, 7]) await seedHistory(casa, daysAgo, ['Latte', 'Pane']);
    await getFirestore().collection('lists').doc(casa).collection('favoriteState').get()
      .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())));
    await seedFavorite(casa, 'Uova', 5);
    await seedFavorite(casa, 'Burro', 1);
  });

  it('get_favorites ranks like the app shelf: below the usage threshold stays hidden', async () => {
    expect((await favoriteNames()).map((f) => f.name)).toEqual(['Uova']);
  });

  it('set_favorite pins, unpins and needs a category for an unknown item', async () => {
    json(await call(planner, 'set_favorite', { list_id: casa, name: 'burro', favorite: true }));
    expect(await favoriteNames()).toEqual([
      { name: 'Burro', category: 'other', timesAdded: 1, pinned: true },
      expect.objectContaining({ name: 'Uova' }),
    ]);

    json(await call(planner, 'set_favorite', { list_id: casa, name: 'Uova', favorite: false }));
    expect((await favoriteNames()).map((f) => f.name)).toEqual(['Burro']);

    expect(errorText(await call(planner, 'set_favorite', { list_id: casa, name: 'Zucchero', favorite: true }))).toMatch(/category/i);
    json(await call(planner, 'set_favorite', { list_id: casa, name: 'zucchero', favorite: true, category: 'other' }));
    expect((await favoriteNames()).map((f) => f.name)).toContain('Zucchero');
  });

  it('suggest_items proposes what is due and skips what is already on the list', async () => {
    const r = json<{ shopsInHistory: number; suggestions: Array<Record<string, unknown>> }>(
      await call(planner, 'suggest_items', { list_id: casa }),
    );
    expect(r.shopsInHistory).toBe(3);
    expect(r.suggestions).toEqual([
      { name: 'Latte', category: 'other', quantity: '1', due: true, timesBought: 3, everyDays: 7 },
    ]);
  });

  it('get_history returns past shops newest first, without uids', async () => {
    const { shops } = json<{ shops: Array<{ date: string; items: unknown[] }> }>(
      await call(planner, 'get_history', { list_id: casa, limit: 2 }),
    );
    expect(shops).toHaveLength(2);
    expect(Date.parse(shops[0]!.date)).toBeGreaterThan(Date.parse(shops[1]!.date));
    expect(JSON.stringify(shops)).not.toContain(PLANNER);
  });

  it('get_stats reads only the caller\'s own catalog', async () => {
    const entries = getFirestore().collection('catalog').doc(PLANNER).collection('entries');
    await entries.get().then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())));
    await entries.doc('c1').set({ id: 'c1', ownerUid: PLANNER, name: 'Latte', category: 'dairy', usageCount: 3, lastUsedAt: 1 });
    await entries.doc('c2').set({ id: 'c2', ownerUid: PLANNER, name: 'Mele', category: 'fruit_vegetables', usageCount: 1, lastUsedAt: 1 });
    const stats = json(await call(planner, 'get_stats', {}));
    expect(stats.topItems).toEqual([
      { name: 'Latte', category: 'dairy', timesAdded: 3 },
      { name: 'Mele', category: 'fruit_vegetables', timesAdded: 1 },
    ]);
    expect(stats.categories[0]).toEqual({ category: 'dairy', timesAdded: 3, percent: 75 });
    expect(stats.totals).toMatchObject({ totalUsage: 4 });

    const other = await connectAs('tools-stats-other');
    expect(json(await call(other, 'get_stats', {})).topItems).toEqual([]);
    planner = await connectAs(PLANNER);
  });

  it('set_default_list marks the list as default and can clear it', async () => {
    json(await call(planner, 'set_default_list', { list_id: casa }));
    const isDefault = async () =>
      json<{ lists: Array<{ id: string; isDefault: boolean }> }>(await call(planner, 'list_lists', {}))
        .lists.find((l) => l.id === casa)!.isDefault;
    expect(await isDefault()).toBe(true);
    json(await call(planner, 'set_default_list', { list_id: null }));
    expect(await isDefault()).toBe(false);
  });

  it('never reaches favorites, suggestions, history or default of a list the user is not a member of', async () => {
    const stranger = await connectAs(STRANGER);
    for (const [name, args] of [
      ['get_favorites', { list_id: casa }],
      ['set_favorite', { list_id: casa, name: 'Uova', favorite: true }],
      ['suggest_items', { list_id: casa }],
      ['get_history', { list_id: casa }],
      ['set_default_list', { list_id: casa }],
    ] as const) {
      expect(errorText(await call(stranger, name, args)), name).toMatch(/not found/i);
    }
    planner = await connectAs(PLANNER);
    expect((await favoriteNames()).map((f) => f.name)).not.toContain('Uova');
  });
});
