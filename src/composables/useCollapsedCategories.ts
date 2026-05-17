import { ref, watch, type Ref } from 'vue';
import type { Category } from '@/domain/types';

const storageKey = (listId: string): string =>
  `buy-the-way:list:${listId}:collapsedCategories`;

export interface CollapsedCategoriesApi {
  collapsed: Ref<Set<Category>>;
  toggle: (cat: Category) => void;
  isCollapsed: (cat: Category) => boolean;
}

export const useCollapsedCategories = (
  listId: Ref<string> | string,
): CollapsedCategoriesApi => {
  const resolveId = (): string =>
    typeof listId === 'string' ? listId : listId.value;

  const read = (id: string): Set<Category> => {
    if (typeof localStorage === 'undefined' || !id) return new Set();
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return new Set();
    try {
      const arr = JSON.parse(raw) as Category[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };

  const collapsed = ref<Set<Category>>(read(resolveId()));

  const persist = (id: string, s: Set<Category>): void => {
    if (typeof localStorage === 'undefined' || !id) return;
    localStorage.setItem(storageKey(id), JSON.stringify([...s]));
  };

  if (typeof listId !== 'string') {
    watch(
      listId,
      (id) => {
        collapsed.value = read(id);
      },
    );
  }

  const toggle = (cat: Category): void => {
    const next = new Set(collapsed.value);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    collapsed.value = next;
    persist(resolveId(), next);
  };

  const isCollapsed = (cat: Category): boolean => collapsed.value.has(cat);

  return { collapsed, toggle, isCollapsed };
};
