/** How an item entered the list (immutable after create). */
export const ITEM_ADDED_VIA = [
  'autocomplete',
  'favorite',
  'bulk',
  'voice',
  'copy',
  'move',
] as const;

export type ItemAddedVia = (typeof ITEM_ADDED_VIA)[number];
