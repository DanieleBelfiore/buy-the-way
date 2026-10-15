import { getAuth } from 'firebase-admin/auth';

/**
 * Creates the Auth emulator user for `uid`, as production always has one:
 * /mcp refuses to sign in a uid that does not exist (deleted account), so
 * test users must exist before their first MCP call. Idempotent.
 */
export const ensureAuthUser = async (uid: string): Promise<void> => {
  try {
    await getAuth().createUser({ uid });
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/uid-already-exists') throw err;
  }
};
