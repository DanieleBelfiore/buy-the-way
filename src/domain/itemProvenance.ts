/** How an item entered the list (immutable after create). */
export const ITEM_ADDED_VIA = [
  'autocomplete',
  'favorite',
  'bulk',
  'voice',
  'suggested',
  'copy',
  'move',
  // Added by an AI assistant through the MCP server (add_items tool).
  'assistant',
] as const;

export type ItemAddedVia = (typeof ITEM_ADDED_VIA)[number];
