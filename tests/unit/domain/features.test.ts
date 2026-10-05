import { describe, it, expect } from 'vitest';
import { FEATURES } from '@/domain/features';

describe('FEATURES', () => {
  it('ships with in-app notifications switched off', () => {
    expect(FEATURES.notifications).toBe(false);
  });
});
