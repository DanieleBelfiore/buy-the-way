import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import IconTooltip from '@/components/ui/IconTooltip.vue';

describe('IconTooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mountTooltip = (label = 'Pin list') =>
    mount(IconTooltip, {
      props: { label },
      slots: { default: '<button type="button">Pin</button>' },
      attachTo: document.body,
    });

  it('shows a toast-styled label on hover', async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger('mouseenter');
    await nextTick();
    await nextTick();

    const tooltip = document.body.querySelector('[data-testid="icon-tooltip-label"]') as HTMLElement | null;
    expect(tooltip?.textContent).toBe('Pin list');
    expect(tooltip?.className).toContain('bg-primary');
    expect(tooltip?.className).toContain('rounded-full');

    await wrapper.trigger('mouseleave');
    await nextTick();
    expect(document.body.querySelector('[data-testid="icon-tooltip-label"]')).toBeNull();
  });

  it('opens on focus and closes on focusout', async () => {
    const wrapper = mountTooltip();
    const button = wrapper.get('button');
    await button.trigger('focusin');
    await nextTick();
    await nextTick();
    expect(document.body.querySelector('[data-testid="icon-tooltip-label"]')).not.toBeNull();
    await button.trigger('focusout');
    await nextTick();
    expect(document.body.querySelector('[data-testid="icon-tooltip-label"]')).toBeNull();
  });

  it('positions below the trigger when there is no room above', async () => {
    const wrapper = mountTooltip();
    const root = wrapper.get('[data-testid="icon-tooltip"]').element as HTMLElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 16,
      y: 8,
      top: 8,
      left: 16,
      right: 36,
      bottom: 28,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    } as DOMRect);

    await wrapper.trigger('mouseenter');
    await nextTick();
    await nextTick();

    const tooltip = document.body.querySelector('[data-testid="icon-tooltip-label"]') as HTMLElement;
    expect(tooltip.style.transform).toBe('translate(-50%, 0)');
  });

  it('keeps the tooltip open when focus moves within the trigger subtree', async () => {
    const wrapper = mount(IconTooltip, {
      props: { label: 'Actions' },
      slots: {
        default: `
          <button type="button" data-testid="outer-btn">
            <span data-testid="inner-span">Go</span>
          </button>
        `,
      },
      attachTo: document.body,
    });
    const outer = wrapper.get('[data-testid="outer-btn"]');
    const inner = wrapper.get('[data-testid="inner-span"]');
    await outer.trigger('focusin');
    await nextTick();
    await nextTick();
    await inner.trigger('focusout', { relatedTarget: outer.element });
    await nextTick();
    expect(document.body.querySelector('[data-testid="icon-tooltip-label"]')).not.toBeNull();
  });

  it('updates position on scroll while open', async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger('mouseenter');
    await nextTick();
    await nextTick();
    window.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(document.body.querySelector('[data-testid="icon-tooltip-label"]')).not.toBeNull();
  });

  it('cleans up listeners on unmount', async () => {
    const wrapper = mountTooltip();
    await wrapper.trigger('mouseenter');
    wrapper.unmount();
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
  });

  it('ignores scroll events while the tooltip is closed', () => {
    mountTooltip();
    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
  });
});
