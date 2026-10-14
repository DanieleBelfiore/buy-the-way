import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  createClient,
  getClient,
  createAuthCode,
  consumeAuthCode,
  issueTokens,
  rotateRefreshToken,
  resolveAccessToken,
  revokeToken,
  revokeGrant,
  grantIdFor,
} from '@/../netlify/functions/_lib/oauth-store';
import { readMcpGate, isMcpAllowed, __resetMcpGateCache, MCP_GATE_CACHE_MS } from '@/../netlify/functions/_lib/mcp-gate';
import { hashToken, OAUTH_TTL } from '@/../netlify/functions/_lib/oauth';

// Runs the store against the Firestore emulator with the REAL firebase-admin,
// no mocks: a mocked admin SDK once hid a production outage (see
// .claude/docs/firebase.md). Unit tests of the endpoints mock this module.

const RESOURCE = 'https://app.example/mcp';
const T0 = 1_800_000_000_000;

beforeAll(() => {
  if (!process.env['FIRESTORE_EMULATOR_HOST']) throw new Error('Run through `pnpm test:mcp`');
  if (getApps().length === 0) initializeApp({ projectId: 'demo-buy-the-way' });
});

const newClient = () =>
  createClient({ redirectUris: ['https://claude.ai/api/mcp/auth_callback'], clientName: 'Claude' }, T0);

describe('oauth-store', () => {
  it('creates and reads back a client', async () => {
    const client = await newClient();
    expect(client.clientId).toMatch(/^mcp_[A-Za-z0-9_-]{32}$/);
    expect(await getClient(client.clientId)).toEqual(client);
    expect(await getClient('mcp_unknown')).toBeNull();
    expect(await getClient('a/b')).toBeNull();
  });

  it('stores codes hashed, consumes them once, honours expiry', async () => {
    const input = { uid: 'u1', clientId: 'c1', redirectUri: 'https://a.example/cb', codeChallenge: 'x', resource: RESOURCE };
    const code = await createAuthCode(input, T0);
    expect((await getFirestore().collection('oauthCodes').doc(code).get()).exists).toBe(false);
    expect((await getFirestore().collection('oauthCodes').doc(hashToken(code)).get()).exists).toBe(true);

    expect(await consumeAuthCode(code, T0 + 1000)).toMatchObject(input);
    expect(await consumeAuthCode(code, T0 + 1000)).toBeNull();

    const late = await createAuthCode(input, T0);
    expect(await consumeAuthCode(late, T0 + OAUTH_TTL.codeMs + 1)).toBeNull();
  });

  it('issues tokens under a grant and resolves the access token', async () => {
    const client = await newClient();
    const issued = await issueTokens({ uid: 'u2', clientId: client.clientId, clientName: 'Claude', resource: RESOURCE }, T0);
    expect(issued.expiresIn).toBe(3600);

    const grant = await getFirestore().collection('oauthGrants').doc(grantIdFor('u2', client.clientId)).get();
    expect(grant.data()).toMatchObject({ uid: 'u2', clientId: client.clientId, clientName: 'Claude' });

    expect(await resolveAccessToken(issued.accessToken, T0 + 1000)).toEqual({
      uid: 'u2', clientId: client.clientId, grantId: grantIdFor('u2', client.clientId),
    });
    expect(await resolveAccessToken(issued.accessToken, T0 + OAUTH_TTL.accessMs + 1)).toBeNull();
    expect(await resolveAccessToken(issued.refreshToken, T0 + 1000)).toBeNull();
    expect(await resolveAccessToken('nope', T0)).toBeNull();
  });

  it('rotates refresh tokens and revokes the grant on reuse', async () => {
    const client = await newClient();
    const first = await issueTokens({ uid: 'u3', clientId: client.clientId, clientName: 'Claude', resource: RESOURCE }, T0);

    const rotated = await rotateRefreshToken(first.refreshToken, client.clientId, T0 + 1000);
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.uid).toBe('u3');
    expect(await resolveAccessToken(rotated.tokens.accessToken, T0 + 2000)).not.toBeNull();

    // Replaying the rotated token is treated as theft: the grant goes away.
    expect(await rotateRefreshToken(first.refreshToken, client.clientId, T0 + 3000)).toEqual({ ok: false, reason: 'reused' });
    expect(await resolveAccessToken(rotated.tokens.accessToken, T0 + 4000)).toBeNull();
    expect(await rotateRefreshToken(rotated.tokens.refreshToken, client.clientId, T0 + 5000)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a refresh token from another client or past its expiry', async () => {
    const client = await newClient();
    const issued = await issueTokens({ uid: 'u4', clientId: client.clientId, clientName: 'Claude', resource: RESOURCE }, T0);
    expect(await rotateRefreshToken(issued.refreshToken, 'mcp_other', T0 + 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(await rotateRefreshToken(issued.refreshToken, client.clientId, T0 + OAUTH_TTL.refreshMs + 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(await rotateRefreshToken(issued.accessToken, client.clientId, T0 + 1)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('revokes: access token alone, refresh token takes the grant', async () => {
    const client = await newClient();
    const a = await issueTokens({ uid: 'u5', clientId: client.clientId, clientName: 'Claude', resource: RESOURCE }, T0);
    await revokeToken(a.accessToken, client.clientId);
    expect(await resolveAccessToken(a.accessToken, T0 + 1)).toBeNull();
    expect(await rotateRefreshToken(a.refreshToken, client.clientId, T0 + 1)).toMatchObject({ ok: true });

    const b = await issueTokens({ uid: 'u6', clientId: client.clientId, clientName: 'Claude', resource: RESOURCE }, T0);
    await revokeToken(b.refreshToken, 'mcp_other');
    expect(await resolveAccessToken(b.accessToken, T0 + 1)).not.toBeNull();
    await revokeToken(b.refreshToken, client.clientId);
    expect(await resolveAccessToken(b.accessToken, T0 + 1)).toBeNull();
    expect((await getFirestore().collection('oauthGrants').doc(grantIdFor('u6', client.clientId)).get()).exists).toBe(false);

    await expect(revokeToken('unknown', undefined)).resolves.toBeUndefined();
    await expect(revokeGrant('missing-grant')).resolves.toBeUndefined();
  });
});

describe('mcp-gate', () => {
  const gateDoc = () => getFirestore().collection('config').doc('mcp');

  beforeEach(async () => {
    __resetMcpGateCache();
    await gateDoc().delete();
  });

  it('is closed when config/mcp is missing', async () => {
    expect(await readMcpGate(T0)).toEqual({ open: false, allowedUids: [] });
    expect(await isMcpAllowed('anyone', T0)).toBe(false);
  });

  it('lets allow-listed uids in while closed, everyone once open', async () => {
    await gateDoc().set({ open: false, allowedUids: ['me', 42] });
    expect(await isMcpAllowed('me', T0)).toBe(true);
    expect(await isMcpAllowed('other', T0)).toBe(false);

    __resetMcpGateCache();
    await gateDoc().set({ open: true, allowedUids: [] });
    expect(await isMcpAllowed('other', T0)).toBe(true);
  });

  it('caches for MCP_GATE_CACHE_MS, then picks up changes', async () => {
    await gateDoc().set({ open: false, allowedUids: ['me'] });
    expect(await isMcpAllowed('me', T0)).toBe(true);
    await gateDoc().set({ open: false, allowedUids: [] });
    expect(await isMcpAllowed('me', T0 + 1000)).toBe(true);
    expect(await isMcpAllowed('me', T0 + MCP_GATE_CACHE_MS)).toBe(false);
  });
});
