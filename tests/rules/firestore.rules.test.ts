/**
 * Firestore security rules integration tests.
 * Requires the Firebase emulator running on localhost:8080.
 * Run: pnpm firebase:emulators   (in one terminal)
 *      pnpm test:rules           (in another)
 * Or:  firebase emulators:exec "pnpm test:rules"
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

const PROJECT_ID = 'buy-the-way-rules-test';
const RULES = readFileSync(join(process.cwd(), 'firebase/firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: 'localhost', port: 8080, rules: RULES },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── helpers ────────────────────────────────────────────────────────────────

const ALICE = 'uid-alice';
const BOB = 'uid-bob';
const CAROL = 'uid-carol';

function auth(uid: string) {
  return testEnv.authenticatedContext(uid);
}
function unauth() {
  return testEnv.unauthenticatedContext();
}
async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

function listData(ownerUid: string, collaboratorUids: string[] = []) {
  return {
    id: 'list-1',
    name: 'Groceries',
    ownerUid,
    collaboratorUids,
    deletedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

// ── users/{uid} ────────────────────────────────────────────────────────────

describe('users/{uid}', () => {
  it('unauthenticated cannot read a user profile', async () => {
    await seed('users/uid-alice', {
      uid: ALICE,
      email: 'alice@test.com',
      displayName: 'Alice',
      lastLoginAt: 0,
    });
    await assertFails(getDoc(doc(unauth().firestore(), 'users', ALICE)));
  });

  it('authenticated user can read any profile (email→uid lookup)', async () => {
    await seed('users/uid-alice', {
      uid: ALICE,
      email: 'alice@test.com',
      displayName: 'Alice',
      lastLoginAt: 0,
    });
    await assertSucceeds(getDoc(doc(auth(BOB).firestore(), 'users', ALICE)));
  });

  it('authenticated user can query users by email', async () => {
    await seed('users/uid-alice', {
      uid: ALICE,
      email: 'alice@test.com',
      displayName: 'Alice',
      lastLoginAt: 0,
    });
    const q = query(
      collection(auth(BOB).firestore(), 'users'),
      where('email', '==', 'alice@test.com'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('user can create their own profile', async () => {
    await assertSucceeds(
      setDoc(doc(auth(ALICE).firestore(), 'users', ALICE), {
        uid: ALICE,
        email: 'alice@test.com',
        displayName: 'Alice',
        lastLoginAt: 0,
      }),
    );
  });

  it("user cannot write another user's profile", async () => {
    await assertFails(
      setDoc(doc(auth(ALICE).firestore(), 'users', BOB), {
        uid: BOB,
        email: 'bob@test.com',
        displayName: 'Bob',
        lastLoginAt: 0,
      }),
    );
  });

  it('profiles cannot be hard-deleted', async () => {
    await seed('users/uid-alice', {
      uid: ALICE,
      email: 'alice@test.com',
      displayName: 'Alice',
      lastLoginAt: 0,
    });
    await assertFails(deleteDoc(doc(auth(ALICE).firestore(), 'users', ALICE)));
  });
});

// ── lists/{listId} ─────────────────────────────────────────────────────────

describe('lists/{listId}', () => {
  it('unauthenticated cannot read a list', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertFails(getDoc(doc(unauth().firestore(), 'lists', 'list-1')));
  });

  it('non-member authenticated user cannot read a list', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertFails(getDoc(doc(auth(CAROL).firestore(), 'lists', 'list-1')));
  });

  it('owner can read their list', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertSucceeds(getDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1')));
  });

  it('collaborator can read a list', async () => {
    await seed('lists/list-1', listData(ALICE, [BOB]));
    await assertSucceeds(getDoc(doc(auth(BOB).firestore(), 'lists', 'list-1')));
  });

  it('owner can create a list with themselves as ownerUid', async () => {
    await assertSucceeds(setDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1'), listData(ALICE)));
  });

  it('user cannot create a list with another uid as owner', async () => {
    await assertFails(setDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1'), listData(BOB)));
  });

  it('owner can update (rename) a list', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertSucceeds(
      updateDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1'), {
        name: 'Renamed',
        updatedAt: 2000,
      }),
    );
  });

  it('collaborator can update a list (leaveList removes self from collaboratorUids)', async () => {
    await seed('lists/list-1', listData(ALICE, [BOB]));
    await assertSucceeds(
      updateDoc(doc(auth(BOB).firestore(), 'lists', 'list-1'), {
        collaboratorUids: [],
        updatedAt: 2000,
      }),
    );
  });

  it('non-member cannot update a list', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertFails(
      updateDoc(doc(auth(CAROL).firestore(), 'lists', 'list-1'), {
        name: 'Hacked',
        updatedAt: 2000,
      }),
    );
  });

  it('lists cannot be hard-deleted (use soft-delete)', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertFails(deleteDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1')));
  });
});

// ── lists/{listId}/items/{itemId} ──────────────────────────────────────────

describe('lists/{listId}/items/{itemId}', () => {
  it('unauthenticated cannot read items', async () => {
    await seed('lists/list-1', listData(ALICE));
    await seed('lists/list-1/items/item-1', {
      id: 'item-1',
      name: 'Milk',
      checked: false,
      createdByUid: ALICE,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await assertFails(getDoc(doc(unauth().firestore(), 'lists', 'list-1', 'items', 'item-1')));
  });

  it('non-member cannot read items', async () => {
    await seed('lists/list-1', listData(ALICE));
    await seed('lists/list-1/items/item-1', {
      id: 'item-1',
      name: 'Milk',
      checked: false,
      createdByUid: ALICE,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await assertFails(getDoc(doc(auth(CAROL).firestore(), 'lists', 'list-1', 'items', 'item-1')));
  });

  it('owner can write items', async () => {
    await seed('lists/list-1', listData(ALICE));
    await assertSucceeds(
      setDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1', 'items', 'item-1'), {
        id: 'item-1',
        name: 'Eggs',
        checked: false,
        createdByUid: ALICE,
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );
  });

  it('collaborator can write items', async () => {
    await seed('lists/list-1', listData(ALICE, [BOB]));
    await assertSucceeds(
      setDoc(doc(auth(BOB).firestore(), 'lists', 'list-1', 'items', 'item-1'), {
        id: 'item-1',
        name: 'Bread',
        checked: false,
        createdByUid: BOB,
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );
  });

  it('owner can read items', async () => {
    await seed('lists/list-1', listData(ALICE));
    await seed('lists/list-1/items/item-1', {
      id: 'item-1',
      name: 'Milk',
      checked: false,
      createdByUid: ALICE,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await assertSucceeds(
      getDoc(doc(auth(ALICE).firestore(), 'lists', 'list-1', 'items', 'item-1')),
    );
  });
});

// ── catalog/{entryId} ──────────────────────────────────────────────────────

describe('catalog/{entryId}', () => {
  const CATALOG_PATH = 'catalog/uid-alice_milk_dairy';
  const CATALOG_DATA = {
    ownerUid: ALICE,
    name: 'Milk',
    category: 'dairy',
    usageCount: 1,
    lastUsedAt: 1000,
  };

  it('unauthenticated cannot read catalog entries', async () => {
    await seed(CATALOG_PATH, CATALOG_DATA);
    await assertFails(getDoc(doc(unauth().firestore(), CATALOG_PATH)));
  });

  it("user cannot read another user's catalog entry", async () => {
    await seed(CATALOG_PATH, CATALOG_DATA);
    await assertFails(getDoc(doc(auth(BOB).firestore(), CATALOG_PATH)));
  });

  it('user can read their own catalog entry', async () => {
    await seed(CATALOG_PATH, CATALOG_DATA);
    await assertSucceeds(getDoc(doc(auth(ALICE).firestore(), CATALOG_PATH)));
  });

  it('user can create their own catalog entry', async () => {
    await assertSucceeds(
      setDoc(doc(auth(ALICE).firestore(), 'catalog', 'uid-alice_eggs_dairy'), {
        ownerUid: ALICE,
        name: 'Eggs',
        category: 'dairy',
        usageCount: 1,
        lastUsedAt: 1000,
      }),
    );
  });

  it('user cannot create a catalog entry for another user', async () => {
    await assertFails(
      setDoc(doc(auth(ALICE).firestore(), 'catalog', 'uid-bob_eggs_dairy'), {
        ownerUid: BOB,
        name: 'Eggs',
        category: 'dairy',
        usageCount: 1,
        lastUsedAt: 1000,
      }),
    );
  });

  it('user can query their own catalog entries', async () => {
    await seed(CATALOG_PATH, CATALOG_DATA);
    const q = query(collection(auth(ALICE).firestore(), 'catalog'), where('ownerUid', '==', ALICE));
    await assertSucceeds(getDocs(q));
  });

  it("user cannot query another user's catalog entries", async () => {
    await seed(CATALOG_PATH, CATALOG_DATA);
    const q = query(collection(auth(BOB).firestore(), 'catalog'), where('ownerUid', '==', ALICE));
    await assertFails(getDocs(q));
  });
});
