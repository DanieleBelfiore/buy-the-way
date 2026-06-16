import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useUndoDelete } from '@/composables/useUndoDelete';

const hostFor = (capture: { api?: ReturnType<typeof useUndoDelete> } = {}) =>
  defineComponent({
    setup() {
      const api = useUndoDelete();
      capture.api = api;
      return () => h('div');
    },
  });

describe('useUndoDelete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no pending task', () => {
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));
    expect(capture.api!.pending.value).toBeNull();
  });

  it('schedule() exposes the pending task and runs commit after the window', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));

    capture.api!.schedule({
      id: 'item-1',
      message: 'Item deleted',
      durationMs: 5000,
      commit,
    });

    expect(capture.api!.pending.value?.id).toBe('item-1');
    expect(commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(commit).toHaveBeenCalledOnce();
    expect(capture.api!.pending.value).toBeNull();
  });

  it('undoCurrent() cancels the commit and invokes onUndo', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn();
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));

    capture.api!.schedule({
      id: 'item-1',
      message: 'gone',
      durationMs: 5000,
      commit,
      onUndo,
    });

    capture.api!.undoCurrent();

    expect(commit).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(capture.api!.pending.value).toBeNull();

    // Window expiry should be a no-op now (timer cleared).
    await vi.advanceTimersByTimeAsync(10_000);
    expect(commit).not.toHaveBeenCalled();
  });

  it('scheduling a second task flushes the first immediately so deletes are not silently swallowed', async () => {
    const commit1 = vi.fn().mockResolvedValue(undefined);
    const commit2 = vi.fn().mockResolvedValue(undefined);
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));

    capture.api!.schedule({ id: 'a', message: 'a', durationMs: 5000, commit: commit1 });
    capture.api!.schedule({ id: 'b', message: 'b', durationMs: 5000, commit: commit2 });

    // First commit fires synchronously from the second schedule call.
    await vi.advanceTimersByTimeAsync(0);
    expect(commit1).toHaveBeenCalledOnce();
    expect(capture.api!.pending.value?.id).toBe('b');

    await vi.advanceTimersByTimeAsync(5000);
    expect(commit2).toHaveBeenCalledOnce();
  });

  it('commits any pending task on component unmount', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    const wrapper = mount(hostFor(capture));

    capture.api!.schedule({ id: 'a', message: 'a', durationMs: 5000, commit });
    wrapper.unmount();

    // Microtask flush so the unmount-triggered commit settles.
    await vi.advanceTimersByTimeAsync(0);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('commitCurrent() fires once even when called concurrently', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));

    capture.api!.schedule({ id: 'a', message: 'a', durationMs: 5000, commit });
    await Promise.all([capture.api!.commitCurrent(), capture.api!.commitCurrent()]);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('uses default 1000 ms when durationMs is omitted', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const capture: { api?: ReturnType<typeof useUndoDelete> } = {};
    mount(hostFor(capture));

    capture.api!.schedule({ id: 'a', message: 'a', commit });
    await vi.advanceTimersByTimeAsync(999);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledOnce();
  });
});
