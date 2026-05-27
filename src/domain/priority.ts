import type { ItemPriority } from '@/domain/types';

export const isUrgentPriority = (priority?: ItemPriority | null): boolean =>
  priority === 'urgent';

export const countUrgentItems = (
  items: readonly { priority?: ItemPriority }[],
): number => items.filter((item) => isUrgentPriority(item.priority)).length;
