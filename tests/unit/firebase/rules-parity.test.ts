import { describe, it, expect } from 'vitest';
import rules from '../../../firebase/firestore.rules?raw';
import { ITEM_ADDED_VIA } from '@/domain/itemProvenance';

describe('firestore rules / domain parity', () => {
  it('validAddedVia accepts exactly ITEM_ADDED_VIA', () => {
    const match = /function validAddedVia\(data\) \{\s*return data\.addedVia in \[([^\]]*)\];/.exec(rules);
    expect(match).not.toBeNull();
    const allowed = match![1]!.split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    expect([...allowed].sort()).toEqual([...ITEM_ADDED_VIA].sort());
  });
});
