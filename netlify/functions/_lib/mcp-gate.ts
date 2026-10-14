import { getFirestore } from 'firebase-admin/firestore';

/**
 * Private-beta switch for the MCP server: Firestore doc `config/mcp`
 * `{ open: boolean, allowedUids: string[] }`, edited by hand in the Firebase
 * console and unreadable by clients (rules: `if false`). A missing or
 * malformed doc means closed. Checked by `oauth-authorize` before issuing a
 * code and by `/mcp` on every request, so a change takes effect within
 * CACHE_MS even for tokens already issued.
 */

export interface McpGate {
  open: boolean;
  allowedUids: readonly string[];
}

const CLOSED: McpGate = { open: false, allowedUids: [] };
export const MCP_GATE_CACHE_MS = 60_000;

let cached: { gate: McpGate; at: number } | null = null;

/** Test-only: drop the per-container cache. */
export const __resetMcpGateCache = (): void => {
  cached = null;
};

export const readMcpGate = async (now = Date.now()): Promise<McpGate> => {
  if (cached && now - cached.at < MCP_GATE_CACHE_MS) return cached.gate;
  let gate = CLOSED;
  try {
    const snap = await getFirestore().collection('config').doc('mcp').get();
    const data = snap.exists ? snap.data() : undefined;
    if (data) {
      gate = {
        open: data['open'] === true,
        allowedUids: Array.isArray(data['allowedUids'])
          ? data['allowedUids'].filter((u: unknown): u is string => typeof u === 'string')
          : [],
      };
    }
  } catch (err) {
    // Fail closed: a Firestore hiccup must never open the beta.
    console.error('[mcp-gate] read failed (closed):', err);
    return CLOSED;
  }
  cached = { gate, at: now };
  return gate;
};

export const isMcpAllowed = async (uid: string, now = Date.now()): Promise<boolean> => {
  const gate = await readMcpGate(now);
  return gate.open || gate.allowedUids.includes(uid);
};
