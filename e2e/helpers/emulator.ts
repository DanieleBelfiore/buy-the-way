const PROJECT_ID = 'buy-the-way';
const FIRESTORE_HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? 'localhost:8080';
const AUTH_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099';

export const resetFirestore = async (): Promise<void> => {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 200) {
    throw new Error(`Firestore reset failed: ${res.status}`);
  }
};

export const resetAuth = async (): Promise<void> => {
  const url = `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 200) {
    throw new Error(`Auth reset failed: ${res.status}`);
  }
};

export const resetEmulators = async (): Promise<void> => {
  await Promise.all([resetFirestore(), resetAuth()]);
};
