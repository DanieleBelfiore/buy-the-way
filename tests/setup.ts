import { vi } from 'vitest';

vi.mock('@/services/firebase', () => ({
  auth: {},
  db: {},
  app: {},
}));
