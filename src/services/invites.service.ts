import { getAuth } from 'firebase/auth';
import type { Locale } from '@/domain/types';

export class InviteEmailError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'InviteEmailError';
  }
}

export interface SendInviteEmailParams {
  email: string;
  listName: string;
  inviterName: string;
  locale: Locale;
}

/**
 * Calls the Netlify `send-invite` function to deliver a transactional invite
 * email to an unregistered user. Auth is the caller's Firebase ID token; the
 * function verifies it server-side via firebase-admin before contacting Resend.
 *
 * Network errors and non-2xx responses surface as {@link InviteEmailError};
 * the pending invite is already persisted in Firestore by `addCollaborator`,
 * so a failure here is recoverable - the caller can retry or just warn.
 */
export const sendInviteEmail = async (params: SendInviteEmailParams): Promise<void> => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new InviteEmailError('Not signed in', 'not_signed_in');
  }
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/send-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const data = (await res.json()) as { error?: string };
      code = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new InviteEmailError(`Invite email failed (${res.status})`, code, res.status);
  }
};
