import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-buy-the-way';
const FIRESTORE_RULES_PATH = resolve(__dirname, '../../firebase/firestore.rules');
const STORAGE_RULES_PATH = resolve(__dirname, '../../firebase/storage.rules');

const LIST_ID = '01LIST00000000000000000001';
const ITEM_ID = '01ITEM000000000000000000001';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CARL = 'carl-uid';

let env: RulesTestEnvironment;

const photoPath = `lists/${LIST_ID}/items/${ITEM_ID}/photo.jpg`;

const seedList = async (
  ownerUid: string,
  collaboratorUids: string[],
): Promise<void> => {
  // Seed through the rules-enabled Firestore client so Storage cross-service
  // firestore.get() sees the same data (withSecurityRulesDisabled writes to a
  // separate in-memory store invisible to Storage rules evaluation).
  const fs = env.authenticatedContext(ownerUid).firestore();
  await setDoc(doc(fs, 'lists', LIST_ID), {
    id: LIST_ID,
    name: 'Groceries',
    ownerUid,
    collaboratorUids: [...collaboratorUids],
    admins: [ownerUid],
    itemCount: 0,
    urgentCount: 0,
    wallpaper: '',
    createdAt: 1,
    updatedAt: 1,
  });
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

describe('storage.rules - item photos', () => {
  it('denies unsigned reads', async () => {
    await seedList(ALICE, [ALICE, BOB]);
    const storage = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, photoPath)));
  });

  it('allows collaborators to upload JPEG under 5 MiB', async () => {
    await seedList(ALICE, [ALICE, BOB]);
    const storage = env.authenticatedContext(BOB).storage();
    const payload = new Uint8Array(1024);
    await assertSucceeds(
      uploadBytes(ref(storage, photoPath), payload, { contentType: 'image/jpeg' }),
    );
  });

  it('denies non-collaborators', async () => {
    await seedList(ALICE, [ALICE, BOB]);
    const storage = env.authenticatedContext(CARL).storage();
    const payload = new Uint8Array(64);
    await assertFails(
      uploadBytes(ref(storage, photoPath), payload, { contentType: 'image/jpeg' }),
    );
  });

  it('denies SVG uploads (XSS hardening)', async () => {
    await seedList(ALICE, [ALICE]);
    const storage = env.authenticatedContext(ALICE).storage();
    const payload = new Uint8Array([60, 115, 118, 103]); // "<svg"
    await assertFails(
      uploadBytes(ref(storage, photoPath), payload, { contentType: 'image/svg+xml' }),
    );
  });

  it('denies uploads above 5 MiB', async () => {
    await seedList(ALICE, [ALICE]);
    const storage = env.authenticatedContext(ALICE).storage();
    const payload = new Uint8Array(5 * 1024 * 1024);
    await assertFails(
      uploadBytes(ref(storage, photoPath), payload, { contentType: 'image/jpeg' }),
    );
  });

  it('allows collaborators to delete photos', async () => {
    await seedList(ALICE, [ALICE, BOB]);
    const aliceStorage = env.authenticatedContext(ALICE).storage();
    await assertSucceeds(
      uploadBytes(ref(aliceStorage, photoPath), new Uint8Array(32), {
        contentType: 'image/jpeg',
      }),
    );
    const bobStorage = env.authenticatedContext(BOB).storage();
    await assertSucceeds(deleteObject(ref(bobStorage, photoPath)));
  });
});
