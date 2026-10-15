import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeApp as initAdminApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { createList, fetchUserLists } from '@/services/lists.service';
import { bulkAddItems, countListItems, fetchItems } from '@/services/items.service';
import type { ULID } from '@/domain/id';

// Proves the MCP data path end to end: a firebase-admin custom token signs
// the client SDK in as the user, the unchanged services write through the
// real rules, and a non-collaborator is still refused. If this suite fails,
// the MCP function cannot work, whatever its unit tests say.

const ALICE = 'mcp-alice';
const MALLORY = 'mcp-mallory';

let adminApp: App;

const signInAs = async (uid: string): Promise<void> => {
  await signOut(auth);
  const token = await getAdminAuth(adminApp).createCustomToken(uid, { via: 'mcp' });
  await signInWithCustomToken(auth, token);
};

beforeAll(() => {
  if (!process.env['FIREBASE_AUTH_EMULATOR_HOST'] || !process.env['FIRESTORE_EMULATOR_HOST']) {
    throw new Error('Run through `pnpm test:mcp` so the emulators are up');
  }
  adminApp = initAdminApp({ projectId: 'demo-buy-the-way' }, 'mcp-integration-admin');
});

afterAll(async () => {
  await signOut(auth);
  await deleteApp(adminApp);
});

describe('MCP data path (client SDK in Node, custom token, real rules)', () => {
  let listId: ULID;

  it('signs in with a custom token carrying the via=mcp claim', async () => {
    await signInAs(ALICE);
    expect(auth.currentUser?.uid).toBe(ALICE);
    const { claims } = await auth.currentUser!.getIdTokenResult();
    expect(claims['via']).toBe('mcp');
  });

  it('creates a list and adds items through the unchanged services', async () => {
    await signInAs(ALICE);
    listId = (await createList('spesa mcp', ALICE)) as ULID;
    await bulkAddItems({
      listId,
      rows: [
        { name: 'latte', category: 'dairy', quantity: '2' },
        { name: 'mele', category: 'fruit_vegetables', quantity: '1 kg' },
      ],
      createdByUid: ALICE,
      addedVia: 'assistant',
    });

    const items = await fetchItems(listId);
    expect(items.map((i) => i.name)).toEqual(['Latte', 'Mele']);
    expect(items.every((i) => i.addedVia === 'assistant')).toBe(true);

    // Counts come from count() aggregations over the items, which the
    // Node client SDK runs under the same rules as the app.
    await expect(countListItems(listId)).resolves.toEqual({ itemCount: 2, urgentCount: 0 });
    const listSnap = await getDoc(doc(db, 'lists', listId));
    expect(listSnap.data()).not.toHaveProperty('itemCount');
  });

  it('returns the new list from fetchUserLists', async () => {
    await signInAs(ALICE);
    const lists = await fetchUserLists(ALICE);
    expect(lists.map((l) => l.id)).toContain(listId);
  });

  it('refuses a non-collaborator through the rules', async () => {
    await signInAs(MALLORY);
    await expect(fetchItems(listId)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await fetchUserLists(MALLORY)).toEqual([]);
  });
});
