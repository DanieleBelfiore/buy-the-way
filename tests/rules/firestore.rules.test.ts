import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-buy-the-way';
const RULES_PATH = resolve(__dirname, '../../firebase/firestore.rules');

let env: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CARL = 'carl-uid';

const aliceCtx = (): RulesTestContext => env.authenticatedContext(ALICE).firestore() as unknown as RulesTestContext;
const bobCtx = (): RulesTestContext => env.authenticatedContext(BOB).firestore() as unknown as RulesTestContext;
const carlCtx = (): RulesTestContext => env.authenticatedContext(CARL).firestore() as unknown as RulesTestContext;
const anonCtx = (): RulesTestContext => env.unauthenticatedContext().firestore() as unknown as RulesTestContext;

const seedList = async (
  id: string,
  ownerUid: string,
  collaboratorUids: string[],
  extra: Record<string, unknown> = {},
): Promise<void> => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'lists', id), {
      id,
      name: 'Groceries',
      ownerUid,
      collaboratorUids,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    });
  });
};

const seedItem = async (listId: string, itemId: string): Promise<void> => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'lists', listId, 'items', itemId), {
      id: itemId,
      listId,
      name: 'Milk',
      quantity: '1',
      category: 'dairy',
      note: '',
      checked: false,
      createdByUid: ALICE,
      createdAt: 1,
      updatedAt: 1,
    });
  });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('firestore.rules — users/{uid}', () => {
  it('allows authenticated user to read any user profile', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', BOB), {
        uid: BOB, email: 'b@example.com', displayName: 'B', lastLoginAt: 1,
      });
    });
    await assertSucceeds(getDoc(doc(aliceCtx() as any, 'users', BOB)));
  });

  it('denies unauthenticated reads of user profiles', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', BOB), {
        uid: BOB, email: 'b@example.com', displayName: 'B', lastLoginAt: 1,
      });
    });
    await assertFails(getDoc(doc(anonCtx() as any, 'users', BOB)));
  });

  it('allows a user to write their own profile', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'users', ALICE), {
      uid: ALICE, email: 'a@example.com', displayName: 'A', lastLoginAt: 1,
    }));
  });

  it('denies a user from writing another profile', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'users', BOB), {
      uid: BOB, email: 'b@example.com', displayName: 'B', lastLoginAt: 1,
    }));
  });
});

describe('firestore.rules — lists/{id} reads', () => {
  it('allows a collaborator to read the list', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(getDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('denies a non-collaborator from reading the list', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(getDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('denies unauthenticated reads', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(getDoc(doc(anonCtx() as any, 'lists', 'L1')));
  });
});

describe('firestore.rules — lists/{id} create', () => {
  it('allows owner-uid creator who is in collaboratorUids', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [ALICE],
      createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when ownerUid is not the caller', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: BOB, collaboratorUids: [BOB],
      createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when caller is not in collaboratorUids', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [BOB],
      createdAt: 1, updatedAt: 1,
    }));
  });
});

describe('firestore.rules — lists/{id} update', () => {
  it('allows owner to rename the list', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      name: 'Renamed', updatedAt: 2,
    }));
  });

  it('denies non-owner rename', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      name: 'Hacked', updatedAt: 2,
    }));
  });

  it('allows owner to add a collaborator', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, BOB], updatedAt: 2,
    }));
  });

  it('allows owner to remove a non-owner collaborator', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE], updatedAt: 2,
    }));
  });

  it('denies owner removing themself from collaboratorUids', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [BOB], updatedAt: 2,
    }));
  });

  it('denies ownerUid change', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB, updatedAt: 2,
    }));
  });

  it('allows non-owner to remove only their own uid', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE], updatedAt: 2,
    }));
  });

  it('denies non-owner removing another collaborator', async () => {
    await seedList('L1', ALICE, [ALICE, BOB, CARL]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, BOB], updatedAt: 2,
    }));
  });

  it('denies non-owner renaming via collaboratorUids removal', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      name: 'Hacked', collaboratorUids: [ALICE], updatedAt: 2,
    }));
  });

  it('denies stranger from updating the list', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(updateDoc(doc(carlCtx() as any, 'lists', 'L1'), {
      name: 'Hacked', updatedAt: 2,
    }));
  });

  it('allows owner to toggle showFavorites', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      showFavorites: false, updatedAt: 2,
    }));
  });

  it('denies non-owner collaborator from toggling showFavorites', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      showFavorites: false, updatedAt: 2,
    }));
  });

  it('allows owner to set wallpaper', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      wallpaper: '05.jpg', updatedAt: 2,
    }));
  });

  it('denies non-owner collaborator from setting wallpaper', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      wallpaper: '05.jpg', updatedAt: 2,
    }));
  });
});

describe('firestore.rules — lists/{id} delete', () => {
  it('allows owner to delete', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'lists', 'L1')));
  });

  it('denies non-owner collaborator delete', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(deleteDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('denies stranger delete', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(deleteDoc(doc(carlCtx() as any, 'lists', 'L1')));
  });
});

describe('firestore.rules — items subcollection', () => {
  it('allows a collaborator to read items', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await seedItem('L1', 'I1');
    await assertSucceeds(getDoc(doc(bobCtx() as any, 'lists', 'L1', 'items', 'I1')));
  });

  it('allows a collaborator to write items', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(setDoc(doc(bobCtx() as any, 'lists', 'L1', 'items', 'I1'), {
      id: 'I1', listId: 'L1', name: 'Bread', quantity: '1', category: 'bakery',
      note: '', checked: false, createdByUid: BOB, createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies a non-collaborator from reading items', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await seedItem('L1', 'I1');
    await assertFails(getDoc(doc(bobCtx() as any, 'lists', 'L1', 'items', 'I1')));
  });

  it('denies a non-collaborator from writing items', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(setDoc(doc(bobCtx() as any, 'lists', 'L1', 'items', 'I1'), {
      id: 'I1', listId: 'L1', name: 'Bread', quantity: '1', category: 'bakery',
      note: '', checked: false, createdByUid: BOB, createdAt: 1, updatedAt: 1,
    }));
  });
});

describe('firestore.rules — catalog/{uid}/entries', () => {
  it('allows owner to read/write their catalog', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'catalog', ALICE, 'entries', 'milk'), {
      name: 'Milk', category: 'dairy', useCount: 1, lastUsedAt: 1,
    }));
    await assertSucceeds(getDoc(doc(aliceCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('denies another user from reading the catalog', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'catalog', ALICE, 'entries', 'milk'), {
        name: 'Milk', category: 'dairy', useCount: 1, lastUsedAt: 1,
      });
    });
    await assertFails(getDoc(doc(bobCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('denies another user from writing the catalog', async () => {
    await assertFails(setDoc(doc(bobCtx() as any, 'catalog', ALICE, 'entries', 'milk'), {
      name: 'Milk', category: 'dairy', useCount: 1, lastUsedAt: 1,
    }));
  });
});

describe('firestore.rules — account-cascade self-deletes', () => {
  it('allows self to delete own users/{uid} doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), {
        uid: ALICE, email: 'a@example.com', displayName: 'A', lastLoginAt: 1,
      });
    });
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'users', ALICE)));
  });

  it('denies cross-user delete of users/{uid} doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), {
        uid: ALICE, email: 'a@example.com', displayName: 'A', lastLoginAt: 1,
      });
    });
    await assertFails(deleteDoc(doc(bobCtx() as any, 'users', ALICE)));
  });

  it('allows self to delete own catalog entries', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'catalog', ALICE, 'entries', 'milk'), {
        name: 'Milk', category: 'dairy', useCount: 1, lastUsedAt: 1,
      });
    });
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('denies cross-user delete of catalog entries', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'catalog', ALICE, 'entries', 'milk'), {
        name: 'Milk', category: 'dairy', useCount: 1, lastUsedAt: 1,
      });
    });
    await assertFails(deleteDoc(doc(bobCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('allows self to delete own lists (owner)', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'lists', 'L1')));
  });

  it('denies stranger delete of another user\'s list', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(deleteDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });
});

describe('firestore.rules — owner-transfer', () => {
  it('allows owner to transfer ownership to an existing collaborator, removing self', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB,
      collaboratorUids: [BOB],
      updatedAt: 2,
    }));
  });

  it('denies transfer to a non-collaborator', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: CARL,
      collaboratorUids: [CARL],
      updatedAt: 2,
    }));
  });

  it('denies transfer that keeps old owner in collaboratorUids', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB,
      collaboratorUids: [ALICE, BOB],
      updatedAt: 2,
    }));
  });

  it('denies transfer that renames the list at the same time', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB,
      collaboratorUids: [BOB],
      name: 'Hacked',
      updatedAt: 2,
    }));
  });

  it('denies non-owner from initiating transfer', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB,
      collaboratorUids: [BOB],
      updatedAt: 2,
    }));
  });
});
