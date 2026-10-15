import { getAuth } from 'firebase/auth';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';

/**
 * Settings > Connected apps: the AI assistants the user has authorised to
 * use Buy The Way over MCP (one `oauthGrants` doc per user + client). The
 * owner may read their grants directly; revoking goes through the
 * `oauth-revoke-grant` function because grants are never client-writable.
 */

export interface ConnectedApp {
  grantId: string;
  /** Name the client registered with (RFC 7591 client_name). */
  clientName: string;
  createdAt: number;
  /** Last consent or token refresh (about hourly while in use). */
  lastUsedAt: number;
}

export class ConnectedAppsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectedAppsError';
  }
}

const toApp = (id: string, data: Record<string, unknown>): ConnectedApp => {
  const createdAt = typeof data['createdAt'] === 'number' ? data['createdAt'] : 0;
  return {
    grantId: id,
    clientName: typeof data['clientName'] === 'string' ? data['clientName'] : '',
    createdAt,
    lastUsedAt: typeof data['lastUsedAt'] === 'number' ? data['lastUsedAt'] : createdAt,
  };
};

// The rules only let a user read their own grants, so every query must be
// constrained to the caller's uid.
const grantsOf = (uid: string) => query(collection(db, 'oauthGrants'), where('uid', '==', uid));

/** Live list of the user's connected apps, most recently used first. */
export const subscribeConnectedApps = (
  uid: string,
  onChange: (apps: ConnectedApp[]) => void,
  onError: (err: Error) => void,
): (() => void) =>
  onSnapshot(
    grantsOf(uid),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((d) => toApp(d.id, d.data()))
          .sort((a, b) => b.lastUsedAt - a.lastUsedAt),
      ),
    (error) => onError(error as Error),
  );

/** Disconnects one app. A grant that is already gone counts as done. */
export const revokeConnectedApp = async (grantId: string): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user) throw new ConnectedAppsError('not signed in');

  let res: Response;
  try {
    res = await fetch('/.netlify/functions/oauth-revoke-grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ grantId }),
    });
  } catch (err) {
    throw new ConnectedAppsError(`transport: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok && res.status !== 404) throw new ConnectedAppsError(`HTTP ${res.status}`);
};

/** Account deletion: disconnects every app. Fails if any revocation fails. */
export const revokeAllConnectedApps = async (uid: string): Promise<void> => {
  const snap = await getDocs(grantsOf(uid));
  await Promise.all(snap.docs.map((d) => revokeConnectedApp(d.id)));
};
