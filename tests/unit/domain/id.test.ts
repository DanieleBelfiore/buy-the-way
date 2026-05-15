import { describe, it, expect } from 'vitest';
import { newId } from '@/domain/id';

describe('newId', () => {
  it('returns a 26-char string', () => {
    expect(newId()).toHaveLength(26);
  });

  it('returns uppercase ULID chars', () => {
    expect(newId()).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('is monotonically increasing within same ms', () => {
    const ids = Array.from({ length: 100 }, () => newId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('branded type is string at runtime', () => {
    const id = newId();
    expect(typeof id).toBe('string');
  });
});
