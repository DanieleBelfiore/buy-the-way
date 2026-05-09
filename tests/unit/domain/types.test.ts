import { describe, expect, test } from 'vitest';
import { newId } from '@/domain/id';
import type { CatalogEntry, Category, Item, List, Locale, UserProfile } from '@/domain/types';

describe('domain/types', () => {
  test('Locale accepts the supported language codes', () => {
    // Arrange + Act
    const it: Locale = 'it';
    const en: Locale = 'en';

    // Assert
    expect(it).toBe('it');
    expect(en).toBe('en');
  });

  test('Category accepts every documented value', () => {
    // Arrange
    const all: readonly Category[] = [
      'fruit_vegetables',
      'dairy',
      'meat_fish',
      'bakery',
      'beverages',
      'frozen',
      'cleaning',
      'hygiene',
      'other',
    ];

    // Assert
    expect(all).toHaveLength(9);
    expect(new Set(all).size).toBe(9);
  });

  test('List shape requires the documented fields', () => {
    // Arrange + Act
    const list: List = {
      id: newId(),
      name: 'Weekly groceries',
      ownerUid: 'uid_owner',
      collaboratorUids: ['uid_a', 'uid_b'],
      deletedAt: null,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000,
    };

    // Assert
    expect(list.collaboratorUids).toHaveLength(2);
    expect(list.deletedAt).toBeNull();
    expect(list.name).toBe('Weekly groceries');
  });

  test('List allows deletedAt to be a timestamp (soft-delete)', () => {
    // Arrange + Act
    const deleted: List = {
      id: newId(),
      name: 'old',
      ownerUid: 'uid_owner',
      collaboratorUids: [],
      deletedAt: 1_700_000_500_000,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_500_000,
    };

    // Assert
    expect(deleted.deletedAt).toBe(1_700_000_500_000);
  });

  test('Item shape carries free-text quantity and category', () => {
    // Arrange + Act
    const item: Item = {
      id: newId(),
      listId: newId(),
      name: 'Milk',
      quantity: '1.5l',
      category: 'dairy',
      note: 'lactose-free',
      checked: false,
      createdByUid: 'uid_owner',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    };

    // Assert
    expect(item.quantity).toBe('1.5l');
    expect(item.category).toBe('dairy');
    expect(item.checked).toBe(false);
  });

  test('CatalogEntry shape carries usage stats per owner', () => {
    // Arrange + Act
    const entry: CatalogEntry = {
      id: newId(),
      ownerUid: 'uid_owner',
      name: 'Bread',
      category: 'bakery',
      usageCount: 12,
      lastUsedAt: 1_700_000_000_000,
    };

    // Assert
    expect(entry.usageCount).toBe(12);
    expect(entry.category).toBe('bakery');
  });

  test('UserProfile shape carries the email-resolution payload', () => {
    // Arrange + Act
    const profile: UserProfile = {
      uid: 'uid_user',
      email: 'user@example.com',
      displayName: 'User',
      lastLoginAt: 1_700_000_000_000,
    };

    // Assert
    expect(profile.email).toMatch(/@/);
    expect(profile.uid).toBe('uid_user');
  });
});
