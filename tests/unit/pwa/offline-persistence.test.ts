import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIREBASE_TS = resolve(process.cwd(), 'src/services/firebase.ts');

describe('Firestore offline persistence', () => {
  it('firebase.ts enables IndexedDB persistence', () => {
    const src = readFileSync(FIREBASE_TS, 'utf8');
    expect(src).toContain('enableIndexedDbPersistence');
  });

  it('persistence call is wrapped in try/catch so errors are non-blocking', () => {
    const src = readFileSync(FIREBASE_TS, 'utf8');
    // Match a try block that contains enableIndexedDbPersistence (dotAll for multiline)
    expect(src).toMatch(/try\s*\{[^}]*enableIndexedDbPersistence/s);
  });
});
