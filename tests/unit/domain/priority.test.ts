import { describe, it, expect } from 'vitest';
import { countUrgentItems, isUrgentPriority } from '@/domain/priority';

describe('priority', () => {
  it('isUrgentPriority is true only for urgent', () => {
    expect(isUrgentPriority('urgent')).toBe(true);
    expect(isUrgentPriority('optional')).toBe(false);
    expect(isUrgentPriority(undefined)).toBe(false);
    expect(isUrgentPriority(null)).toBe(false);
  });

  it('countUrgentItems counts urgent rows only', () => {
    expect(
      countUrgentItems([
        { priority: 'urgent' },
        { priority: 'optional' },
        {},
        { priority: 'urgent' },
      ]),
    ).toBe(2);
  });
});
