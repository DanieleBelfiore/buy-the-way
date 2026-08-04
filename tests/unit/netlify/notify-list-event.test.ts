import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken, listGet, userGet, notifSet, notifOrderGet, batchDelete } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  listGet: vi.fn(),
  userGet: vi.fn(),
  notifSet: vi.fn(),
  notifOrderGet: vi.fn(),
  batchDelete: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name === 'lists') {
        return {
          doc: (id: string) => ({ get: () => listGet(id) }),
        };
      }
      if (name === 'users') {
        return {
          doc: (uid: string) => ({
            get: () => userGet(uid),
            collection: (sub: string) => {
              if (sub !== 'notifications') throw new Error(`unexpected sub ${sub}`);
              return {
                doc: () => ({ set: notifSet }),
                orderBy: () => ({
                  offset: () => ({
                    get: notifOrderGet,
                  }),
                }),
              };
            },
          }),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    batch: () => ({
      delete: batchDelete,
      commit: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

vi.mock('@/../netlify/functions/_lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  rateLimitedResponse: vi.fn(),
}));

import handler from '@/../netlify/functions/notify-list-event';

const LIST_ID = '01LIST00000000000000000001';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const TOKEN = 'valid-token';

const post = (body: Record<string, unknown>, token = TOKEN): Promise<Response> =>
  handler(
    new Request('http://localhost/.netlify/functions/notify-list-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }),
    {} as any,
  );

describe('notify-list-event function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['FIREBASE_SERVICE_ACCOUNT'] = JSON.stringify({ project_id: 'demo' });
    verifyIdToken.mockResolvedValue({ uid: ALICE });
    listGet.mockImplementation(async (id: string) => {
      if (id !== LIST_ID) return { exists: false };
      return {
        exists: true,
        data: () => ({
          name: 'Spesa',
          collaboratorUids: [ALICE, BOB],
        }),
      };
    });
    userGet.mockResolvedValue({
      data: () => ({ displayName: 'Alice' }),
    });
    notifOrderGet.mockResolvedValue({ empty: true, docs: [] });
    notifSet.mockResolvedValue(undefined);
  });

  it('rejects requests without a bearer token', async () => {
    const res = await handler(
      new Request('http://localhost/.netlify/functions/notify-list-event', { method: 'POST' }),
      {} as any,
    );
    expect(res.status).toBe(401);
  });

  it('rejects malformed bodies', async () => {
    const res = await post({ listId: LIST_ID, kind: 'not-a-kind' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_body' });
  });

  it('rejects non-collaborators', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'outsider' });
    const res = await post({ listId: LIST_ID, kind: 'item-modified' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_a_collaborator' });
    expect(notifSet).not.toHaveBeenCalled();
  });

  it('fans out item-modified to other collaborators', async () => {
    const res = await post({ listId: LIST_ID, kind: 'item-modified', locale: 'en' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sent: 1, failed: 0 });
    expect(notifSet).toHaveBeenCalledOnce();
    const payload = notifSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.kind).toBe('item-modified');
    expect(payload.listId).toBe(LIST_ID);
    expect(payload.senderUid).toBe(ALICE);
  });

  it('returns sent=0 when collaborator-added has no valid target', async () => {
    const res = await post({ listId: LIST_ID, kind: 'collaborator-added' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: 0 });
    expect(notifSet).not.toHaveBeenCalled();
  });
});
