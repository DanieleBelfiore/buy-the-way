import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Firebase modules before importing the service
vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: class {
    static credential = vi.fn();
  },
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { signInWithGoogle, signOutUser } from '@/services/auth.service';

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signInWithGoogle', () => {
    it('returns a UserProfile from the Firebase credential', async () => {
      mockSignInWithPopup.mockResolvedValue({
        user: { uid: 'uid-abc', email: 'user@example.com', displayName: 'Test User' },
      });
      mockDoc.mockReturnValue({ path: 'users/uid-abc' });
      mockSetDoc.mockResolvedValue(undefined);

      const profile = await signInWithGoogle();

      expect(profile.uid).toBe('uid-abc');
      expect(profile.email).toBe('user@example.com');
      expect(profile.displayName).toBe('Test User');
    });

    it('lowercases and trims the email before writing to Firestore', async () => {
      mockSignInWithPopup.mockResolvedValue({
        user: { uid: 'uid-1', email: '  USER@EXAMPLE.COM  ', displayName: 'A' },
      });
      mockDoc.mockReturnValue({});
      mockSetDoc.mockResolvedValue(undefined);

      const profile = await signInWithGoogle();

      expect(profile.email).toBe('user@example.com');
      const docData = mockSetDoc.mock.calls[0]![1] as Record<string, unknown>;
      expect(docData.email).toBe('user@example.com');
    });

    it('writes users/{uid} with correct fields on sign-in', async () => {
      const uid = 'uid-xyz';
      mockSignInWithPopup.mockResolvedValue({
        user: { uid, email: 'a@b.com', displayName: 'A B' },
      });
      const fakeDocRef = { id: uid };
      mockDoc.mockReturnValue(fakeDocRef);
      mockSetDoc.mockResolvedValue(undefined);

      await signInWithGoogle();

      expect(mockDoc).toHaveBeenCalledWith({}, 'users', uid);
      expect(mockSetDoc).toHaveBeenCalledWith(
        fakeDocRef,
        expect.objectContaining({ uid, email: 'a@b.com', displayName: 'A B' }),
        { merge: true },
      );
    });

    it('throws if Firebase signInWithPopup rejects', async () => {
      mockSignInWithPopup.mockRejectedValue(new Error('popup-closed'));
      await expect(signInWithGoogle()).rejects.toThrow('popup-closed');
    });
  });

  describe('signOutUser', () => {
    it('calls Firebase signOut', async () => {
      mockSignOut.mockResolvedValue(undefined);
      await signOutUser();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });
  });
});
