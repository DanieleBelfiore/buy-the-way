import { describe, expect, test } from 'vitest';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';

describe('newId', () => {
  test('returns a 26-character Crockford base32 string', () => {
    // Arrange + Act
    const id = newId();

    // Assert
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('returns a unique value on each call', () => {
    // Arrange + Act
    const ids = new Set<ULID>();
    for (let i = 0; i < 50; i += 1) {
      ids.add(newId());
    }

    // Assert
    expect(ids.size).toBe(50);
  });

  test('produces a value usable where ULID type is required', () => {
    // Arrange
    const accept = (value: ULID): string => value;

    // Act
    const id = newId();

    // Assert
    expect(accept(id)).toBe(id);
  });
});
