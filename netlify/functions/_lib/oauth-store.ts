import { getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { generateToken, hashToken, OAUTH_TTL, type ClientRegistration } from './oauth';

/**
 * Firestore persistence for the MCP authorization server, through
 * firebase-admin. Every collection here is `allow read, write: if false` for
 * clients except `oauthGrants`, which its owner may read (Connected apps).
 *
 *   oauthClients/{clientId}   registered public clients (RFC 7591)
 *   oauthCodes/{sha256(code)} authorization codes, single use
 *   oauthTokens/{sha256(tok)} access + refresh tokens
 *   oauthGrants/{grantId}     one per (uid, client): what the user approved
 *
 * Only hashes of codes and tokens are stored. `expireAt` is a Date so a
 * Firestore TTL policy can purge expired docs; logic reads `expiresAtMs`.
 * Requires the default firebase-admin app to be initialised by the caller.
 */

export interface OAuthClient {
  clientId: string;
  redirectUris: string[];
  clientName: string;
  createdAt: number;
}

export interface AuthCode {
  uid: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  expiresAtMs: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenInfo {
  uid: string;
  clientId: string;
  grantId: string;
}

interface TokenDoc {
  uid: string;
  clientId: string;
  grantId: string;
  resource: string;
  kind: 'access' | 'refresh';
  expiresAtMs: number;
  /** Refresh tokens only: set when rotated. A second use means theft. */
  usedAtMs?: number;
}

const db = (): Firestore => getFirestore();
const clients = () => db().collection('oauthClients');
const codes = () => db().collection('oauthCodes');
const tokens = () => db().collection('oauthTokens');
const grants = () => db().collection('oauthGrants');

/** Stable per (uid, client): re-approving the same client reuses the grant. */
export const grantIdFor = (uid: string, clientId: string): string => hashToken(`${uid}:${clientId}`);

export const createClient = async (reg: ClientRegistration, now = Date.now()): Promise<OAuthClient> => {
  const client: OAuthClient = {
    clientId: `mcp_${generateToken().slice(0, 32)}`,
    redirectUris: reg.redirectUris,
    clientName: reg.clientName,
    createdAt: now,
  };
  await clients().doc(client.clientId).set(client);
  return client;
};

export const getClient = async (clientId: string): Promise<OAuthClient | null> => {
  if (!clientId || clientId.includes('/')) return null;
  const snap = await clients().doc(clientId).get();
  return snap.exists ? (snap.data() as OAuthClient) : null;
};

export const createAuthCode = async (
  input: Omit<AuthCode, 'expiresAtMs'>,
  now = Date.now(),
): Promise<string> => {
  const code = generateToken();
  const expiresAtMs = now + OAUTH_TTL.codeMs;
  await codes().doc(hashToken(code)).set({ ...input, expiresAtMs, expireAt: new Date(expiresAtMs) });
  return code;
};

/** Single use: the doc is deleted in the same transaction that reads it. */
export const consumeAuthCode = async (code: string, now = Date.now()): Promise<AuthCode | null> => {
  const ref = codes().doc(hashToken(code));
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const data = snap.data() as AuthCode;
    return data.expiresAtMs > now ? data : null;
  });
};

// Transaction and WriteBatch `set` overloads do not unify, so callers pass
// their own setter.
type DocSetter = (ref: DocumentReference, data: Record<string, unknown>) => unknown;

const writeTokenPair = (
  set: DocSetter,
  base: Omit<TokenDoc, 'kind' | 'expiresAtMs'>,
  now: number,
): IssuedTokens => {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const accessExp = now + OAUTH_TTL.accessMs;
  const refreshExp = now + OAUTH_TTL.refreshMs;
  set(tokens().doc(hashToken(accessToken)), {
    ...base, kind: 'access', expiresAtMs: accessExp, expireAt: new Date(accessExp),
  });
  set(tokens().doc(hashToken(refreshToken)), {
    ...base, kind: 'refresh', expiresAtMs: refreshExp, expireAt: new Date(refreshExp),
  });
  return { accessToken, refreshToken, expiresIn: Math.floor(OAUTH_TTL.accessMs / 1000) };
};

/** Records (or refreshes) the grant and issues a fresh token pair. */
export const issueTokens = async (
  input: { uid: string; clientId: string; clientName: string; resource: string },
  now = Date.now(),
): Promise<IssuedTokens> => {
  const grantId = grantIdFor(input.uid, input.clientId);
  const grantRef = grants().doc(grantId);
  // Re-approving the same client refreshes the grant: createdAt stays the
  // date of the first approval, shown in Connected apps.
  const existing = await grantRef.get();
  const batch = db().batch();
  batch.set(
    grantRef,
    {
      grantId,
      uid: input.uid,
      clientId: input.clientId,
      clientName: input.clientName,
      ...(existing.exists ? {} : { createdAt: now }),
      lastUsedAt: now,
    },
    { merge: true },
  );
  const issued = writeTokenPair(
    (ref, data) => batch.set(ref, data),
    { uid: input.uid, clientId: input.clientId, grantId, resource: input.resource },
    now,
  );
  await batch.commit();
  return issued;
};

export type RotateResult =
  | { ok: true; uid: string; tokens: IssuedTokens }
  | { ok: false; reason: 'invalid' | 'reused' };

/**
 * Refresh token rotation (OAuth 2.1 for public clients). A rotated token is
 * kept, marked used, until it expires: presenting it again means it leaked,
 * so the whole grant is revoked and the legitimate client must re-authorize.
 * A replay within `OAUTH_TTL.refreshReuseGraceMs` is only refused.
 */
export const rotateRefreshToken = async (
  refreshToken: string,
  clientId: string,
  now = Date.now(),
): Promise<RotateResult> => {
  const ref = tokens().doc(hashToken(refreshToken));
  const result = await db().runTransaction(async (tx): Promise<RotateResult | { reuse: string }> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'invalid' };
    const data = snap.data() as TokenDoc;
    if (data.kind !== 'refresh' || data.clientId !== clientId || data.expiresAtMs <= now) {
      return { ok: false, reason: 'invalid' };
    }
    if (data.usedAtMs !== undefined) {
      // Within the grace window it is a retry or a race, not a theft.
      if (now - data.usedAtMs < OAUTH_TTL.refreshReuseGraceMs) return { ok: false, reason: 'invalid' };
      return { reuse: data.grantId };
    }
    const grantSnap = await tx.get(grants().doc(data.grantId));
    if (!grantSnap.exists) return { ok: false, reason: 'invalid' };
    tx.update(ref, { usedAtMs: now });
    tx.update(grants().doc(data.grantId), { lastUsedAt: now });
    const issued = writeTokenPair(
      (r, d) => tx.set(r, d),
      { uid: data.uid, clientId: data.clientId, grantId: data.grantId, resource: data.resource },
      now,
    );
    return { ok: true, uid: data.uid, tokens: issued };
  });
  if ('reuse' in result) {
    await revokeGrant(result.reuse);
    return { ok: false, reason: 'reused' };
  }
  return result;
};

/** Valid, unexpired access token whose grant still exists. */
export const resolveAccessToken = async (
  accessToken: string,
  now = Date.now(),
): Promise<AccessTokenInfo | null> => {
  const snap = await tokens().doc(hashToken(accessToken)).get();
  if (!snap.exists) return null;
  const data = snap.data() as TokenDoc;
  if (data.kind !== 'access' || data.expiresAtMs <= now) return null;
  const grantSnap = await grants().doc(data.grantId).get();
  if (!grantSnap.exists) return null;
  return { uid: data.uid, clientId: data.clientId, grantId: data.grantId };
};

const DELETE_BATCH = 400;

/** Deletes the grant and every token issued under it. Idempotent. */
export const revokeGrant = async (grantId: string): Promise<void> => {
  for (;;) {
    const snap = await tokens().where('grantId', '==', grantId).limit(DELETE_BATCH).get();
    if (snap.empty) break;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < DELETE_BATCH) break;
  }
  await grants().doc(grantId).delete();
};

/**
 * Connected apps: the signed-in user revokes one of their grants. A grant id
 * that does not exist or belongs to someone else is left alone and reported
 * as not found, so the call cannot reveal other users' grants.
 */
export const revokeGrantOf = async (uid: string, grantId: string): Promise<boolean> => {
  if (!grantId || grantId.includes('/')) return false;
  const snap = await grants().doc(grantId).get();
  if (!snap.exists || snap.data()?.['uid'] !== uid) return false;
  await revokeGrant(grantId);
  return true;
};

/**
 * RFC 7009. A refresh token takes its whole grant down (it can mint new access
 * tokens); an access token is deleted on its own. Unknown tokens and tokens of
 * another client are ignored: the endpoint answers 200 either way.
 */
export const revokeToken = async (token: string, clientId: string | undefined): Promise<void> => {
  const ref = tokens().doc(hashToken(token));
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() as TokenDoc;
  if (clientId && data.clientId !== clientId) return;
  if (data.kind === 'refresh') {
    await revokeGrant(data.grantId);
    return;
  }
  await ref.delete();
};
