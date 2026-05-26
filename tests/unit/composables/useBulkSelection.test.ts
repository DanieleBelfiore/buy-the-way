import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useBulkSelection } from '@/composables/useBulkSelection';

const host = (capture: { api?: ReturnType<typeof useBulkSelection> } = {}) =>
  defineComponent({
    setup() {
      capture.api = useBulkSelection();
      return () => h('div');
    },
  });

describe('useBulkSelection', () => {
  it('starts inactive with empty selection', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    expect(c.api!.active.value).toBe(false);
    expect(c.api!.count.value).toBe(0);
    expect(c.api!.isEmpty.value).toBe(true);
  });

  it('enter() activates mode and seeds with initial id', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.enter('a');
    expect(c.api!.active.value).toBe(true);
    expect(c.api!.has('a')).toBe(true);
    expect(c.api!.count.value).toBe(1);
  });

  it('enter() without id activates mode with empty selection', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.enter();
    expect(c.api!.active.value).toBe(true);
    expect(c.api!.count.value).toBe(0);
  });

  it('toggle() adds, removes, and auto-exits when last id is dropped', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.enter('a');
    c.api!.toggle('b');
    expect(c.api!.count.value).toBe(2);
    c.api!.toggle('a');
    expect(c.api!.count.value).toBe(1);
    c.api!.toggle('b');
    expect(c.api!.count.value).toBe(0);
    // Auto-exit when last selection is removed - the toolbar would be
    // useless otherwise and stay traps the user in mode.
    expect(c.api!.active.value).toBe(false);
  });

  it('exit() clears everything', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.enter('a');
    c.api!.toggle('b');
    c.api!.exit();
    expect(c.api!.active.value).toBe(false);
    expect(c.api!.count.value).toBe(0);
  });

  it('selectAll() activates mode and seeds with all ids', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.selectAll(['a', 'b', 'c']);
    expect(c.api!.active.value).toBe(true);
    expect(c.api!.count.value).toBe(3);
  });

  it('selectAll([]) does not activate mode', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.selectAll([]);
    expect(c.api!.active.value).toBe(false);
  });

  it('snapshot() returns a plain array of selected ids', () => {
    const c: { api?: ReturnType<typeof useBulkSelection> } = {};
    mount(host(c));
    c.api!.enter('a');
    c.api!.toggle('b');
    expect(new Set(c.api!.snapshot())).toEqual(new Set(['a', 'b']));
  });
});
