import { describe, it, expect, beforeEach } from 'vitest';
import { defineComponent, ref, toRef } from 'vue';
import { mount } from '@vue/test-utils';
import { useFocusTrap } from '@/composables/useFocusTrap';

const Host = defineComponent({
  props: { open: { type: Boolean, default: false } },
  setup(props) {
    const container = ref<HTMLElement | null>(null);
    useFocusTrap(toRef(props, 'open'), container);
    return { container };
  },
  template: `
    <div>
      <button id="outside">outside</button>
      <div v-if="open" ref="container" role="dialog">
        <button id="a">a</button>
        <input id="b" />
        <button id="c">c</button>
        <input id="hidden-input" tabindex="-1" />
      </div>
    </div>
  `,
});

const pressTab = (el: Element, shiftKey = false): void => {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  );
};

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('moves focus to the first focusable child when opened', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const outside = document.getElementById('outside')!;
    outside.focus();
    expect(document.activeElement).toBe(outside);

    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    expect(document.activeElement?.id).toBe('a');
    wrapper.unmount();
  });

  it('skips focusables with tabindex="-1"', async () => {
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body });
    await wrapper.vm.$nextTick();
    // Tab from the last *real* focusable (#c) wraps to #a, never the hidden input.
    document.getElementById('c')!.focus();
    pressTab(document.getElementById('c')!);
    expect(document.activeElement?.id).toBe('a');
    wrapper.unmount();
  });

  it('wraps Tab from the last element back to the first', async () => {
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body });
    await wrapper.vm.$nextTick();
    document.getElementById('c')!.focus();
    pressTab(document.getElementById('c')!);
    expect(document.activeElement?.id).toBe('a');
    wrapper.unmount();
  });

  it('wraps Shift+Tab from the first element to the last', async () => {
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body });
    await wrapper.vm.$nextTick();
    document.getElementById('a')!.focus();
    pressTab(document.getElementById('a')!, true);
    expect(document.activeElement?.id).toBe('c');
    wrapper.unmount();
  });

  it('does not hijack Tab between interior elements', async () => {
    const wrapper = mount(Host, { props: { open: true }, attachTo: document.body });
    await wrapper.vm.$nextTick();
    const b = document.getElementById('b')!;
    b.focus();
    pressTab(b);
    // Not first nor last -> handler leaves native Tab to the browser, focus stays.
    expect(document.activeElement?.id).toBe('b');
    wrapper.unmount();
  });

  it('restores focus to the trigger when closed', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const outside = document.getElementById('outside')!;
    outside.focus();
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    expect(document.activeElement?.id).toBe('a');

    await wrapper.setProps({ open: false });
    expect(document.activeElement?.id).toBe('outside');
    wrapper.unmount();
  });

  it('focuses the container, not a child, when initialFocus is "container"', async () => {
    const ContainerHost = defineComponent({
      props: { open: { type: Boolean, default: false } },
      setup(props) {
        const container = ref<HTMLElement | null>(null);
        useFocusTrap(toRef(props, 'open'), container, { initialFocus: 'container' });
        return { container };
      },
      template: `<div><button id="outside">outside</button><div v-if="open" ref="container" role="dialog"><input id="field" /></div></div>`,
    });
    const wrapper = mount(ContainerHost, { attachTo: document.body });
    document.getElementById('outside')!.focus();
    await wrapper.setProps({ open: true });
    await wrapper.vm.$nextTick();
    const container = wrapper.find('[role="dialog"]').element as HTMLElement;
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
    wrapper.unmount();
  });

  it('falls back to focusing the container when it has no focusable children', async () => {
    const Empty = defineComponent({
      props: { open: { type: Boolean, default: false } },
      setup(props) {
        const container = ref<HTMLElement | null>(null);
        useFocusTrap(toRef(props, 'open'), container);
        return { container };
      },
      template: `<div><div v-if="open" ref="container" role="dialog"><p>nothing focusable</p></div></div>`,
    });
    const wrapper = mount(Empty, { props: { open: true }, attachTo: document.body });
    await wrapper.vm.$nextTick();
    const container = wrapper.find('[role="dialog"]').element as HTMLElement;
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(container);
    wrapper.unmount();
  });
});
