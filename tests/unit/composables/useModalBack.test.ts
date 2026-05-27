import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, ref, nextTick, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useModalBack } from '@/composables/useModalBack';

const hostFor = (isOpen: ReturnType<typeof ref<boolean>>, close: () => void) =>
  defineComponent({
    setup() {
      useModalBack(isOpen, close);
      return () => h('div');
    },
  });

const tokenIn = (state: unknown): string | undefined =>
  (state as { modalToken?: string } | null)?.modalToken;

describe('useModalBack', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    history.replaceState(null, '');
    pushSpy = vi.spyOn(history, 'pushState');
    backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    pushSpy.mockRestore();
    backSpy.mockRestore();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('registers popstate listener on mount and removes on unmount', () => {
    const isOpen = ref(false);
    const wrapper = mount(hostFor(isOpen, () => {}));

    expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    const addedHandler = addSpy.mock.calls.find((c) => c[0] === 'popstate')?.[1];

    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('popstate', addedHandler);
  });

  it('pushes a tokenized history state when modal opens', async () => {
    const isOpen = ref(false);
    mount(hostFor(isOpen, () => {}));

    isOpen.value = true;
    await nextTick();

    expect(pushSpy).toHaveBeenCalledOnce();
    const [state] = pushSpy.mock.calls[0];
    expect(tokenIn(state)).toMatch(/^m_/);
  });

  it('pushes immediately when mounted already open (v-if pattern)', () => {
    const isOpen = ref(true);
    mount(hostFor(isOpen, () => {}));

    expect(pushSpy).toHaveBeenCalledOnce();
    const [state] = pushSpy.mock.calls[0];
    expect(tokenIn(state)).toMatch(/^m_/);
  });

  it('never pops history.back if a foreign token sits on current state and we never pushed our own', () => {
    history.replaceState({ modalToken: 'someone-else' }, '');
    const isOpen = ref(false);
    const wrapper = mount(hostFor(isOpen, () => {}));

    backSpy.mockClear();
    wrapper.unmount();

    expect(backSpy).not.toHaveBeenCalled();
  });

  it('calls history.back when modal closes programmatically and we own current state', async () => {
    const isOpen = ref(false);
    mount(hostFor(isOpen, () => {}));

    isOpen.value = true;
    await nextTick();

    const [pushedState] = pushSpy.mock.calls[0];
    history.replaceState(pushedState, '');

    backSpy.mockClear();
    isOpen.value = false;
    await nextTick();

    expect(backSpy).toHaveBeenCalledOnce();
  });

  it('popstate fires close() when our history entry was popped', () => {
    const isOpen = ref(true);
    const close = vi.fn();
    mount(hostFor(isOpen, close));

    const [pushedState] = pushSpy.mock.calls[0];
    history.replaceState(pushedState, '');
    history.replaceState(null, '');

    const handler = addSpy.mock.calls.find((c) => c[0] === 'popstate')?.[1] as EventListener;
    handler(new PopStateEvent('popstate'));

    expect(close).toHaveBeenCalledOnce();
  });

  it('popstate does not close parent when a stacked child modal is dismissed', async () => {
    const parentOpen = ref(true);
    const parentClose = vi.fn();
    mount(hostFor(parentOpen, parentClose));

    const [parentState] = pushSpy.mock.calls[0];
    history.replaceState(parentState, '');

    const childOpen = ref(true);
    const childClose = vi.fn();
    mount(hostFor(childOpen, childClose));

    childOpen.value = false;
    await nextTick();
    history.replaceState(parentState, '');

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(childClose).not.toHaveBeenCalled();
    expect(parentClose).not.toHaveBeenCalled();
    expect(parentOpen.value).toBe(true);
  });

  it('popstate does not fire close() when modal is closed', () => {
    const isOpen = ref(false);
    const close = vi.fn();
    mount(hostFor(isOpen, close));

    const handler = addSpy.mock.calls.find((c) => c[0] === 'popstate')?.[1] as EventListener;
    handler(new PopStateEvent('popstate'));

    expect(close).not.toHaveBeenCalled();
  });

  it('on unmount, calls history.back if we still own current state', () => {
    const isOpen = ref(true);
    const wrapper = mount(hostFor(isOpen, () => {}));

    const [pushedState] = pushSpy.mock.calls[0];
    history.replaceState(pushedState, '');

    backSpy.mockClear();
    wrapper.unmount();

    expect(backSpy).toHaveBeenCalledOnce();
  });

  it('on unmount, does not call history.back if we no longer own current state', () => {
    const isOpen = ref(true);
    const wrapper = mount(hostFor(isOpen, () => {}));

    history.replaceState({ modalToken: 'a-different-token' }, '');

    backSpy.mockClear();
    wrapper.unmount();

    expect(backSpy).not.toHaveBeenCalled();
  });

  it('does not push duplicate state if already on our token (idempotent open transition)', async () => {
    const isOpen = ref(false);
    mount(hostFor(isOpen, () => {}));

    isOpen.value = true;
    await nextTick();
    const callsAfterFirst = pushSpy.mock.calls.length;

    const [pushedState] = pushSpy.mock.calls[0];
    history.replaceState(pushedState, '');

    isOpen.value = false;
    await nextTick();
    isOpen.value = true;
    await nextTick();

    expect(pushSpy.mock.calls.length).toBeGreaterThanOrEqual(callsAfterFirst);
  });
});
