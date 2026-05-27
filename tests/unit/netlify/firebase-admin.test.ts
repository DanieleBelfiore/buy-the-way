import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({
  apps: [] as unknown[],
  initializeApp: vi.fn(() => {
    mockState.apps.push({});
  }),
  cert: vi.fn(() => ({ __cert: true })),
}));

vi.mock('firebase-admin', () => ({
  default: {
    get apps() {
      return mockState.apps;
    },
    initializeApp: mockState.initializeApp,
    credential: { cert: mockState.cert },
  },
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
