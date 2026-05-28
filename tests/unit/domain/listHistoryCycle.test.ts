import { describe, it, expect, beforeEach } from 'vitest';
import {
  wasListHistoryRecorded,
  markListHistoryRecorded,
  clearListHistoryRecorded,
} from '@/domain/listHistoryCycle';
import type { ULID } from '@/domain/id';

const LIST_ID = '01LIST00000000000000000001' as ULID;
const OTHER_LIST = '01LIST00000000000000000002' as ULID;

describe('listHistoryCycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearListHistoryRecorded(LIST_ID);
    clearListHistoryRecorded(OTHER_LIST);
  });

  it('starts unrecorded for a list', () => {
    expect(wasListHistoryRecorded(LIST_ID)).toBe(false);
  });

  it('marks and clears per list id via sessionStorage', () => {
    markListHistoryRecorded(LIST_ID);
    expect(wasListHistoryRecorded(LIST_ID)).toBe(true);
    expect(wasListHistoryRecorded(OTHER_LIST)).toBe(false);
    clearListHistoryRecorded(LIST_ID);
    expect(wasListHistoryRecorded(LIST_ID)).toBe(false);
  });

  it('survives a simulated tab refresh (sessionStorage persists)', () => {
    markListHistoryRecorded(LIST_ID);
    expect(sessionStorage.getItem(`btw:historyRecorded:${LIST_ID}`)).toBe('1');
    expect(wasListHistoryRecorded(LIST_ID)).toBe(true);
  });
});
