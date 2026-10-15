import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import handler from '@/../netlify/mcp/handler';
import { createClient, grantIdFor, issueTokens } from '@/../netlify/functions/_lib/oauth-store';
import { ensureAuthUser } from './auth-users';
import { __resetMcpGateCache } from '@/../netlify/functions/_lib/mcp-gate';
import { RATE_LIMITS } from '@/../netlify/functions/_lib/rate-limit';

// /mcp over HTTP against the emulators: bearer token -> real token store ->
// beta gate -> rate limit -> custom-token sign-in -> MCP JSON-RPC.

const UID = 'handler-user';
const APP = 'https://app.example';
let accessToken: string;

const rpc = (body: unknown, token: string | null = accessToken, method = 'POST') =>
  handler(
    new Request(`${APP}/mcp`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    }),
    {} as any,
  );

const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
};

const gate = (data: Record<string, unknown> | null) => {
  __resetMcpGateCache();
  const ref = getFirestore().collection('config').doc('mcp');
  return data ? ref.set(data) : ref.delete();
};

beforeAll(async () => {
  if (!process.env['FIRESTORE_EMULATOR_HOST']) throw new Error('Run through `pnpm test:mcp`');
  if (getApps().length === 0) initializeApp({ projectId: 'demo-buy-the-way' });
  process.env['APP_URL'] = APP;
  await ensureAuthUser(UID);
  const client = await createClient({ redirectUris: ['https://claude.ai/cb'], clientName: 'Claude' });
  accessToken = (await issueTokens({ uid: UID, clientId: client.clientId, clientName: 'Claude', resource: `${APP}/mcp` })).accessToken;
});

beforeEach(async () => {
  await gate({ open: false, allowedUids: [UID] });
  await getFirestore().collection('rateLimits').doc(`${UID}_${RATE_LIMITS.mcp.funcName}`).delete();
});

afterAll(async () => {
  await signOut(auth);
  delete process.env['APP_URL'];
});

describe('/mcp handler', () => {
  it('points unauthenticated clients to the protected resource metadata', async () => {
    const res = await rpc(INIT, null);
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(
      `Bearer resource_metadata="${APP}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it('rejects an unknown token with invalid_token', async () => {
    const res = await rpc(INIT, 'not-a-token');
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
  });

  it('refuses users outside the private beta with 403, even with a valid token', async () => {
    await gate({ open: false, allowedUids: [] });
    const res = await rpc(INIT);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'access_denied' });
  });

  it('answers CORS preflight and refuses GET (no SSE stream on a function)', async () => {
    expect((await rpc(null, null, 'OPTIONS')).status).toBe(204);
    const get = await rpc(null, accessToken, 'GET');
    expect(get.status).toBe(405);
    expect(get.headers.get('Allow')).toBe('POST, OPTIONS');
  });

  it('serves MCP: initialize, tools/list, tools/call as the token owner', async () => {
    const init = await rpc(INIT);
    expect(init.status).toBe(200);
    expect(init.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(((await init.json()) as any).result.serverInfo.name).toBe('buy-the-way');

    const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(((await list.json()) as any).result.tools).toHaveLength(11);

    const created = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_list', arguments: { name: 'via http' } } });
    const createdText = ((await created.json()) as any).result.content[0].text;
    const { id } = JSON.parse(createdText) as { id: string };
    const doc = await getFirestore().collection('lists').doc(id).get();
    expect(doc.data()).toMatchObject({ ownerUid: UID, name: 'Via http' });
  });

  // A deleted account must not come back: signing in with a custom token
  // would silently re-create the Auth user. The grant goes away too.
  it('refuses a token whose user no longer exists, and revokes its grant', async () => {
    const GONE = 'handler-deleted-user';
    await gate({ open: false, allowedUids: [UID, GONE] });
    const client = await createClient({ redirectUris: ['https://claude.ai/cb'], clientName: 'Claude' });
    const { accessToken: goneToken } = await issueTokens({ uid: GONE, clientId: client.clientId, clientName: 'Claude', resource: `${APP}/mcp` });

    const res = await rpc(INIT, goneToken);
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
    await expect(getAdminAuth().getUser(GONE)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await getFirestore().collection('oauthGrants').doc(grantIdFor(GONE, client.clientId)).get()).exists).toBe(false);
    expect((await rpc(INIT, goneToken)).status).toBe(401);
  });

  it('returns 429 once the per-user bucket is full', async () => {
    await getFirestore().collection('rateLimits').doc(`${UID}_${RATE_LIMITS.mcp.funcName}`)
      .set({ windowStart: Date.now(), count: RATE_LIMITS.mcp.max });
    const res = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });
});
