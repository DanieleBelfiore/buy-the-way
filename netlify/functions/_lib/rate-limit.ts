import admin from 'firebase-admin';

/**
 * Result of a rate-limit check. `allowed=false` means the caller has spent
 * its quota for the current window; the function should respond with HTTP
 * 429 and include a `Retry-After` header derived from `retryAfterMs`.
 */
export interface RateLimitDecision {
  allowed: boolean;
  /**
   * Milliseconds the caller should wait before retrying. Zero when allowed.
   * Capped to the configured window length.
   */
  retryAfterMs: number;
}

/**
 * Fixed-window token bucket backed by Firestore.
 *
 * Storage layout:
 *   rateLimits/{uid}_{funcName} { windowStart: number, count: number }
 *
 * Free-tier friendly: 1 read + 1 write per allowed call, 1 read per denied
 * call. The doc is reset on the first call after the window expires; no
 * background cleanup needed.
 *
 * Uses a Firestore transaction so concurrent invocations of the same
 * function from the same user can't both squeeze through the last slot.
 *
 * The function-side caller already has firebase-admin initialised, so this
 * helper relies on `admin.firestore()` being available; it does NOT call
 * `admin.initializeApp` itself.
 */
export const checkRateLimit = async (
  uid: string,
  funcName: string,
  max: number,
  windowMs: number,
): Promise<RateLimitDecision> => {
  const db = admin.firestore();
  const ref = db.collection('rateLimits').doc(`${uid}_${funcName}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists
      ? (snap.data() as { windowStart?: number; count?: number })
      : null;
    const windowStart = data?.windowStart ?? 0;
    const count = data?.count ?? 0;
    const elapsed = now - windowStart;

    // Fresh window: reset counter to 1 and start the clock.
    if (!data || elapsed >= windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return { allowed: true, retryAfterMs: 0 };
    }

    // Inside the active window: either there's room left or we're full.
    if (count < max) {
      tx.set(ref, { windowStart, count: count + 1 });
      return { allowed: true, retryAfterMs: 0 };
    }

    // Denied: tell the caller exactly how long to wait. No write here so
    // attackers can't burn through our write quota by spamming us.
    return {
      allowed: false,
      retryAfterMs: Math.max(0, windowMs - elapsed),
    };
  });
};

/**
 * Build a 429 Response with the retry-after header in seconds (rounded up so
 * the client never reads "0" while the window is still active).
 */
export const rateLimitedResponse = (decision: RateLimitDecision): Response => {
  const retryAfterSec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: 'rate_limited', retryAfterMs: decision.retryAfterMs }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
      },
    },
  );
};

/** Fail-closed response when the limiter itself is unavailable (email endpoints). */
export const rateLimitUnavailableResponse = (): Response =>
  new Response(JSON.stringify({ error: 'rate_limit_unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

/** Standard caps. Exported so the call sites pick from a single source. */
export const RATE_LIMITS = {
  // Email lookup for collaborator invite UI. 60 per minute leaves room for
  // a normal user opening + retyping but throttles bulk enumeration.
  findUser: { max: 60, windowMs: 60_000, funcName: 'find-user' },
  // Transactional invite email send. 20 per hour is generous for legit
  // sharing flows and prevents spam blasts.
  sendInvite: { max: 20, windowMs: 60 * 60 * 1000, funcName: 'send-invite' },
  // Pre-login magic link. Cap per recipient email to limit inbox spam.
  sendMagicLink: { max: 5, windowMs: 60 * 60 * 1000, funcName: 'send-magic-link' },
} as const;
