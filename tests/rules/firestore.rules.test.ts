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

describe('firestore.rules - users/{uid}', () => {
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

  it('allows a user to write their own profile (public schema only - C4)', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'users', ALICE), {
      uid: ALICE, email: 'a@example.com', displayName: 'A',
    }));
  });

  it('denies a user from writing their own profile with arbitrary extra keys (C4 hasOnly)', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'users', ALICE), {
      uid: ALICE, email: 'a@example.com', displayName: 'A', isAdmin: true,
    }));
  });

  it('denies a user from writing their own profile with legacy private fields on create (C3 schema split)', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'users', ALICE), {
      uid: ALICE, email: 'a@example.com', displayName: 'A', lastLoginAt: 1,
    }));
  });

  it('denies a user from writing another profile', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'users', BOB), {
      uid: BOB, email: 'b@example.com', displayName: 'B',
    }));
  });

  it('allows owner to read their private/state subcollection (C3)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'private', 'state'), {
        lastLoginAt: 1, defaultListId: 'L1',
      });
    });
    await assertSucceeds(getDoc(doc(aliceCtx() as any, 'users', ALICE, 'private', 'state')));
  });

  it('denies cross-user read of private/state subcollection (closes C3 leak)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'private', 'state'), {
        lastLoginAt: 1, defaultListId: 'L1',
      });
    });
    await assertFails(getDoc(doc(bobCtx() as any, 'users', ALICE, 'private', 'state')));
  });

  it('allows owner to write their private/state subcollection', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'users', ALICE, 'private', 'state'), {
      lastLoginAt: 1700000000, defaultListId: 'L1', lastSeenListMap: { L1: 1 },
    }));
  });

  it('denies cross-user write of private/state subcollection', async () => {
    await assertFails(setDoc(doc(bobCtx() as any, 'users', ALICE, 'private', 'state'), {
      lastLoginAt: 1,
    }));
  });

  it('allows owner to strip legacy private fields from the top-level user doc via update (migration)', async () => {
    const { deleteField, updateDoc } = await import('firebase/firestore');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), {
        uid: ALICE, email: 'a@example.com', displayName: 'A',
        lastLoginAt: 1, lastSeenLists: 2,
      });
    });
    await assertSucceeds(
      updateDoc(doc(aliceCtx() as any, 'users', ALICE), {
        lastLoginAt: deleteField(),
        lastSeenLists: deleteField(),
      } as Record<string, unknown>),
    );
  });
});

describe('firestore.rules - users/{uid}/notifications/{id}', () => {
  it('allows owner to read their own notifications', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'notifications', 'n1'), {
        kind: 'item-modified', listId: 'L1', listName: 'Spesa',
        body: 'Bob: x', senderUid: BOB, senderName: 'Bob', createdAt: 1,
      });
    });
    await assertSucceeds(getDoc(doc(aliceCtx() as any, 'users', ALICE, 'notifications', 'n1')));
  });

  it('denies cross-user read of notifications', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'notifications', 'n1'), {
        kind: 'item-modified', listId: 'L1', listName: 'Spesa',
        body: 'Bob: x', senderUid: BOB, senderName: 'Bob', createdAt: 1,
      });
    });
    await assertFails(getDoc(doc(bobCtx() as any, 'users', ALICE, 'notifications', 'n1')));
  });

  it('allows owner to delete their own notification', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE, 'notifications', 'n1'), {
        kind: 'item-modified', listId: 'L1', listName: 'Spesa',
        body: 'Bob: x', senderUid: BOB, senderName: 'Bob', createdAt: 1,
      });
    });
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'users', ALICE, 'notifications', 'n1')));
  });

  it('denies the client from writing into their own notifications inbox', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'users', ALICE, 'notifications', 'forged'), {
      kind: 'item-modified', listId: 'L1', listName: 'Spesa',
      body: 'forged', senderUid: ALICE, senderName: 'Alice', createdAt: 1,
    }));
  });

  it('denies cross-user write into another user inbox', async () => {
    await assertFails(setDoc(doc(bobCtx() as any, 'users', ALICE, 'notifications', 'forged'), {
      kind: 'item-modified', listId: 'L1', listName: 'Spesa',
      body: 'forged', senderUid: BOB, senderName: 'Bob', createdAt: 1,
    }));
  });
});

describe('firestore.rules - lists/{id} reads', () => {
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

describe('firestore.rules - lists/{id} create', () => {
  it('allows owner-uid creator who is in collaboratorUids and admins=[self]', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [ALICE], admins: [ALICE],
      itemCount: 0, wallpaper: '01.jpg', createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when admins is missing', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [ALICE],
      itemCount: 0, wallpaper: '01.jpg', createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when admins includes someone other than the caller', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [ALICE, BOB], admins: [ALICE, BOB],
      itemCount: 0, wallpaper: '01.jpg', createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when ownerUid is not the caller', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: BOB, collaboratorUids: [BOB], admins: [BOB],
      itemCount: 0, wallpaper: '01.jpg', createdAt: 1, updatedAt: 1,
    }));
  });

  it('denies creation when caller is not in collaboratorUids', async () => {
    await assertFails(setDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      id: 'L1', name: 'New', ownerUid: ALICE, collaboratorUids: [BOB], admins: [ALICE],
      itemCount: 0, wallpaper: '01.jpg', createdAt: 1, updatedAt: 1,
    }));
  });
});

describe('firestore.rules - lists/{id} update', () => {
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

  it('allows admin to change ownerUid (pivot during owner demotion)', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE, BOB] });
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB, admins: [BOB], updatedAt: 2,
    }));
  });

  it('denies non-admin collaborator from changing ownerUid', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE] });
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB, updatedAt: 2,
    }));
  });

  it('denies admin update that would leave zero admins', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE] });
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      admins: [], updatedAt: 2,
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

describe('firestore.rules - lists/{id} delete', () => {
  it('allows owner (sole admin via legacy fallback) to delete', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(deleteDoc(doc(aliceCtx() as any, 'lists', 'L1')));
  });

  it('allows any explicit admin to delete (multi-admin model)', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE, BOB] });
    await assertSucceeds(deleteDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('denies non-admin collaborator delete', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(deleteDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('denies stranger delete', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(deleteDoc(doc(carlCtx() as any, 'lists', 'L1')));
  });
});

describe('firestore.rules - items subcollection', () => {
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

describe('firestore.rules - favoriteState subcollection', () => {
  it('allows a collaborator to read favoriteState entries', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lists', 'L1', 'favoriteState', 'latte'), {
        slug: 'latte', name: 'Latte', category: 'dairy', usageCount: 1, lastUsedAt: 1,
      });
    });
    await assertSucceeds(getDoc(doc(bobCtx() as any, 'lists', 'L1', 'favoriteState', 'latte')));
  });

  it('allows a collaborator to write favoriteState entries', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertSucceeds(
      setDoc(doc(bobCtx() as any, 'lists', 'L1', 'favoriteState', 'latte'), {
        slug: 'latte', name: 'Latte', category: 'dairy', usageCount: 1, lastUsedAt: 1,
      }),
    );
  });

  it('denies a non-collaborator from reading favoriteState', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'lists', 'L1', 'favoriteState', 'latte'), {
        slug: 'latte', name: 'Latte', category: 'dairy', usageCount: 1, lastUsedAt: 1,
      });
    });
    await assertFails(getDoc(doc(bobCtx() as any, 'lists', 'L1', 'favoriteState', 'latte')));
  });

  it('denies a non-collaborator from writing favoriteState', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(
      setDoc(doc(bobCtx() as any, 'lists', 'L1', 'favoriteState', 'latte'), {
        slug: 'latte', name: 'Latte', category: 'dairy', usageCount: 1, lastUsedAt: 1,
      }),
    );
  });
});

describe('firestore.rules - catalog/{uid}/entries', () => {
  it('allows owner to read/write their catalog', async () => {
    await assertSucceeds(setDoc(doc(aliceCtx() as any, 'catalog', ALICE, 'entries', 'milk'), {
      id: 'milk', ownerUid: ALICE, name: 'Milk', category: 'dairy', usageCount: 1, lastUsedAt: 1,
    }));
    await assertSucceeds(getDoc(doc(aliceCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('denies another user from reading the catalog', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'catalog', ALICE, 'entries', 'milk'), {
        id: 'milk', ownerUid: ALICE, name: 'Milk', category: 'dairy', usageCount: 1, lastUsedAt: 1,
      });
    });
    await assertFails(getDoc(doc(bobCtx() as any, 'catalog', ALICE, 'entries', 'milk')));
  });

  it('denies another user from writing the catalog', async () => {
    await assertFails(setDoc(doc(bobCtx() as any, 'catalog', ALICE, 'entries', 'milk'), {
      id: 'milk', ownerUid: ALICE, name: 'Milk', category: 'dairy', usageCount: 1, lastUsedAt: 1,
    }));
  });
});

describe('firestore.rules - account-cascade self-deletes', () => {
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

describe('firestore.rules - admin promote / demote', () => {
  it('allows admin to promote another collaborator into admins', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE] });
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      admins: [ALICE, BOB], updatedAt: 2,
    }));
  });

  it('allows any admin (not just owner) to promote', async () => {
    await seedList('L1', ALICE, [ALICE, BOB, CARL], { admins: [ALICE, BOB] });
    await assertSucceeds(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      admins: [ALICE, BOB, CARL], updatedAt: 2,
    }));
  });

  it('allows any admin to demote any other admin (even the creator)', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE, BOB] });
    // BOB demotes ALICE; ownerUid pivot already done service-side, so simulate
    // the full write: admins drops ALICE, ownerUid pivots to BOB.
    await assertSucceeds(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      admins: [BOB], ownerUid: BOB, updatedAt: 2,
    }));
  });

  it('denies non-admin from promoting anyone', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE] });
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      admins: [ALICE, BOB], updatedAt: 2,
    }));
  });

  it('denies last-admin removal (would leave list with zero admins)', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE] });
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      admins: [], updatedAt: 2,
    }));
  });

  it('admin can self-demote when other admins remain', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE, BOB] });
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      admins: [BOB], ownerUid: BOB, updatedAt: 2,
    }));
  });
});

describe('firestore.rules - pending email invites', () => {
  const CARL_EMAIL = 'carl@example.com';
  const carlInvitedCtx = (): RulesTestContext =>
    env.authenticatedContext(CARL, { email: CARL_EMAIL }).firestore() as unknown as RulesTestContext;

  it('allows owner to add an email to pendingInviteEmails', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      pendingInviteEmails: [CARL_EMAIL],
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('allows an invited user (email match) to read the list before claim', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertSucceeds(getDoc(doc(carlInvitedCtx() as any, 'lists', 'L1')));
  });

  it('denies a non-invited unauthenticated user from reading the list', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertFails(getDoc(doc(anonCtx() as any, 'lists', 'L1')));
  });

  it('denies a non-invited authenticated user from reading the list', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertFails(getDoc(doc(bobCtx() as any, 'lists', 'L1')));
  });

  it('allows the invited user to self-claim (add own uid, remove own email)', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertSucceeds(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, CARL],
      pendingInviteEmails: [],
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies a self-claim that also removes an existing collaborator', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { pendingInviteEmails: [CARL_EMAIL] });
    await assertFails(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      // Carl tries to drop Bob while claiming - forbidden.
      collaboratorUids: [ALICE, CARL],
      pendingInviteEmails: [],
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies a self-claim that drops another pending invitee', async () => {
    const OTHER = 'other@example.com';
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL, OTHER] });
    await assertFails(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, CARL],
      pendingInviteEmails: [],
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies a self-claim that injects another arbitrary uid', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertFails(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, CARL, 'attacker-uid'],
      pendingInviteEmails: [],
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies a self-claim that touches name, wallpaper, or other fields', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: [CARL_EMAIL] });
    await assertFails(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, CARL],
      pendingInviteEmails: [],
      name: 'Renamed',
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies a user with non-matching email from claiming', async () => {
    await seedList('L1', ALICE, [ALICE], { pendingInviteEmails: ['someone-else@example.com'] });
    await assertFails(updateDoc(doc(carlInvitedCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE, CARL],
      pendingInviteEmails: [],
      updatedAt: 2,
    } as Record<string, unknown>));
  });
});

describe('firestore.rules - owner update field whitelist', () => {
  it('denies owner from writing an arbitrary unknown field', async () => {
    await seedList('L1', ALICE, [ALICE]);
    await assertFails(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      maliciousField: 'pwn', updatedAt: 2,
    } as Record<string, unknown>));
  });

  // The owner-transfer-with-itemCount case used to be denied because the old
  // owner-transfer branch had a narrow whitelist. Under the new admin update
  // rule, both fields share a whitelist, so this combination is now allowed -
  // assert the new behaviour to lock the contract.
  it('allows admin to bundle ownerUid pivot + itemCount bump in a single write', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { admins: [ALICE, BOB] });
    await assertSucceeds(updateDoc(doc(aliceCtx() as any, 'lists', 'L1'), {
      ownerUid: BOB,
      collaboratorUids: [BOB],
      admins: [BOB],
      itemCount: 999,
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('denies non-owner leave that also bumps itemCount', async () => {
    await seedList('L1', ALICE, [ALICE, BOB]);
    await assertFails(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      collaboratorUids: [ALICE],
      itemCount: 999,
      updatedAt: 2,
    } as Record<string, unknown>));
  });

  it('allows any collaborator to bump itemCount + updatedAt only', async () => {
    await seedList('L1', ALICE, [ALICE, BOB], { itemCount: 0 });
    await assertSucceeds(updateDoc(doc(bobCtx() as any, 'lists', 'L1'), {
      itemCount: 5, updatedAt: 2,
    } as Record<string, unknown>));
  });
});
