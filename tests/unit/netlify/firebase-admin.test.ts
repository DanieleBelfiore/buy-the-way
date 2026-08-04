import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({
  apps: [] as unknown[],
  initializeApp: vi.fn(() => {
    mockState.apps.push({});
  }),
  cert: vi.fn(() => ({ __cert: true })),
}));

// Mock the modular subpath, not the 'firebase-admin' root. The root default
// export lost the legacy namespace in v14; mocking it would fabricate a shape
// the real package no longer has, which is exactly how the production
// TypeError slipped past this suite.
vi.mock('firebase-admin/app', () => ({
  getApps: () => mockState.apps,
  initializeApp: mockState.initializeApp,
  cert: mockState.cert,
}));

import { initAdmin } from '@/../netlify/functions/_lib/firebase-admin';

describe('initAdmin', () => {
  beforeEach(() => {
    mockState.apps.length = 0;
    mockState.initializeApp.mockClear();
    delete process.env['FIREBASE_SERVICE_ACCOUNT'];
  });

  it('initializes firebase-admin once from FIREBASE_SERVICE_ACCOUNT', () => {
    process.env['FIREBASE_SERVICE_ACCOUNT'] = JSON.stringify({ project_id: 'demo' });
    initAdmin();
    expect(mockState.initializeApp).toHaveBeenCalledOnce();
    initAdmin();
    expect(mockState.initializeApp).toHaveBeenCalledOnce();
  });

  it('throws when FIREBASE_SERVICE_ACCOUNT is missing', () => {
    expect(() => initAdmin()).toThrow('FIREBASE_SERVICE_ACCOUNT');
  });
});
