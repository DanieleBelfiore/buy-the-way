import { describe, it, expect } from 'vitest';
import indices from '../../../firebase/firestore.indexes.json';

interface IndexField {
  fieldPath: string;
  arrayConfig?: 'CONTAINS';
  order?: 'ASCENDING' | 'DESCENDING';
}

interface IndexEntry {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: IndexField[];
}

describe('firestore indexes', () => {
  const entries = (indices as { indexes: IndexEntry[] }).indexes;

  it('contains composite index for lists.collaboratorUids array-contains + updatedAt desc', () => {
    const match = entries.find(
      (idx) =>
        idx.collectionGroup === 'lists' &&
        idx.queryScope === 'COLLECTION' &&
        idx.fields.length === 2 &&
        idx.fields[0]!.fieldPath === 'collaboratorUids' &&
        idx.fields[0]!.arrayConfig === 'CONTAINS' &&
        idx.fields[1]!.fieldPath === 'updatedAt' &&
        idx.fields[1]!.order === 'DESCENDING',
    );
    expect(match).toBeDefined();
  });
});
