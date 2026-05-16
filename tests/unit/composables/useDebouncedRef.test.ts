import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedRef } from '@/composables/useDebouncedRef';

describe('useDebouncedRef', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('immediate starts with initial value', () => {
    const { immediate } = useDebouncedRef('hello', 120);
    expect(immediate.value).toBe('hello');
  });

  it('debounced starts with initial value', () => {
    const { debounced } = useDebouncedRef('hello', 120);
    expect(debounced.value).toBe('hello');
  });

  it('debounced does not update before delay elapses', async () => {
    const { immediate, debounced } = useDebouncedRef('', 120);
    immediate.value = 'latte';
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    expect(debounced.value).toBe('');
  });

  it('debounced updates after delay elapses', async () => {
    const { immediate, debounced } = useDebouncedRef('', 120);
    immediate.value = 'latte';
    await Promise.resolve();
    vi.advanceTimersByTime(120);
    expect(debounced.value).toBe('latte');
  });

  it('rapid updates coalesce into one debounced value', async () => {
    const { immediate, debounced } = useDebouncedRef('', 120);
    immediate.value = 'l';
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    immediate.value = 'la';
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    immediate.value = 'lat';
    await Promise.resolve();
    vi.advanceTimersByTime(120);
    expect(debounced.value).toBe('lat');
  });
});
