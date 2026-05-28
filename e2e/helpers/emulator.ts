const PROJECT_ID = 'buy-the-way';
const FIRESTORE_HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? 'localhost:8080';
const AUTH_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099';
const EMULATOR_OWNER_TOKEN = 'owner';
const FIRESTORE_QUERY_URL = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

export const resetFirestore = async (): Promise<void> => {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 200) {
    throw new Error(`Firestore reset failed: ${res.status}`);
  }
};

export const resetAuth = async (): Promise<void> => {
  const url = `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 200) {
    throw new Error(`Auth reset failed: ${res.status}`);
  }
};

export const resetEmulators = async (): Promise<void> => {
  await Promise.all([resetFirestore(), resetAuth()]);
};

/** Poll until a public users/{uid} doc exists (auth upsert finished). */
export const waitForUserByEmail = async (
  email: string,
  timeoutMs = 15_000,
): Promise<void> => {
  const normalized = email.toLowerCase().trim();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(FIRESTORE_QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: normalized },
            },
          },
          limit: 1,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Firestore user query failed: ${res.status}`);
    }
    const data = (await res.json()) as Array<{ document?: unknown }>;
    if (data[0]?.document) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for user profile: ${normalized}`);
};

export const countNotificationsForUser = async (uid: string): Promise<number> => {
  const url =
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/notifications`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Firestore notifications list failed: ${res.status}`);
  }
  const data = (await res.json()) as { documents?: unknown[] };
  return data.documents?.length ?? 0;
};

/** Wait until the inbox stays empty long enough to avoid async notify stragglers. */
export const waitForStableEmptyInbox = async (
  uid: string,
  stableMs = 400,
  timeoutMs = 15_000,
): Promise<void> => {
  let emptySince = 0;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await countNotificationsForUser(uid);
    if (count === 0) {
      if (emptySince === 0) emptySince = Date.now();
      if (Date.now() - emptySince >= stableMs) return;
    } else {
      emptySince = 0;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for empty inbox: ${uid}`);
};
