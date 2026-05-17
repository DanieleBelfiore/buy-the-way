import { describe, it, expect, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useCollapsedCategories } from '@/composables/useCollapsedCategories';

const KEY = (id: string) => `buy-the-way:list:${id}:collapsedCategories`;

describe('useCollapsedCategories', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes empty when no storage entry', () => {
    const { collapsed } = useCollapsedCategories('list-1');
    expect(collapsed.value.size).toBe(0);
  });

  it('reads existing storage entry on init', () => {
    localStorage.setItem(KEY('list-1'), JSON.stringify(['dairy', 'bakery']));
    const { collapsed, isCollapsed } = useCollapsedCategories('list-1');
    expect(collapsed.value.size).toBe(2);
    expect(isCollapsed('dairy')).toBe(true);
    expect(isCollapsed('bakery')).toBe(true);
    expect(isCollapsed('other')).toBe(false);
  });

  it('toggle adds category to set', () => {
    const { isCollapsed, toggle } = useCollapsedCategories('list-1');
    toggle('dairy');
    expect(isCollapsed('dairy')).toBe(true);
  });

  it('toggle twice removes category', () => {
    const { isCollapsed, toggle } = useCollapsedCategories('list-1');
    toggle('dairy');
    toggle('dairy');
    expect(isCollapsed('dairy')).toBe(false);
  });

  it('persists toggle to localStorage', () => {
    const { toggle } = useCollapsedCategories('list-1');
    toggle('dairy');
    expect(localStorage.getItem(KEY('list-1'))).toContain('dairy');
  });

  it('uses per-list key', () => {
    const a = useCollapsedCategories('list-A');
    const b = useCollapsedCategories('list-B');
    a.toggle('dairy');
    expect(b.isCollapsed('dairy')).toBe(false);
  });

  it('reloads when reactive listId changes', async () => {
    localStorage.setItem(KEY('list-B'), JSON.stringify(['bakery']));
    const listId = ref('list-A');
    const { isCollapsed } = useCollapsedCategories(listId);
    expect(isCollapsed('bakery')).toBe(false);
    listId.value = 'list-B';
    await nextTick();
    expect(isCollapsed('bakery')).toBe(true);
  });

  it('handles malformed storage gracefully', () => {
    localStorage.setItem(KEY('list-1'), 'not-json');
    const { collapsed } = useCollapsedCategories('list-1');
    expect(collapsed.value.size).toBe(0);
  });
});
