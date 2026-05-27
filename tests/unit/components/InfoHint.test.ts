import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Info } from '@lucide/vue';
import InfoHint from '@/components/ui/InfoHint.vue';

describe('InfoHint', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mountHint = (message = 'Hint text') =>
    mount(InfoHint, {
      props: { message, testId: 'sample-hint' },
      slots: { default: () => h(Info, { size: 14, 'aria-hidden': true }) },
      attachTo: document.body,
    });

  it('renders trigger and hides tooltip by default', () => {
    const wrapper = mountHint();
    expect(wrapper.find('[data-testid="sample-hint"]').exists()).toBe(true);
    expect(document.body.querySelector('[data-testid="info-hint-tooltip"]')).toBeNull();
  });

  it('teleports tooltip to body on hover', async () => {
    const wrapper = mountHint();
    await wrapper.trigger('mouseenter');
    await nextTick();
    await nextTick();
    const tooltip = document.body.querySelector('[data-testid="info-hint-tooltip"]') as HTMLElement | null;
    expect(tooltip?.textContent).toBe('Hint text');
    expect(tooltip?.style.transform).toContain('translateY(-50%)');
    await wrapper.trigger('mouseleave');
    await nextTick();
    expect(document.body.querySelector('[data-testid="info-hint-tooltip"]')).toBeNull();
  });

  it('opens tooltip to the right of the trigger when space allows', async () => {
    const wrapper = mountHint();
    const trigger = wrapper.get('[data-testid="info-hint-trigger"]').element as HTMLElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 16,
      y: 200,
      top: 200,
      left: 16,
      right: 36,
      bottom: 220,
      width: 20,
      height: 20,
      toJSON: () => ({}),
    } as DOMRect);

    await wrapper.trigger('mouseenter');
    await nextTick();
    await nextTick();

    const tooltip = document.body.querySelector('[data-testid="info-hint-tooltip"]') as HTMLElement;
    expect(tooltip.style.left).toBe(`${36 + 8}px`);
    expect(tooltip.style.transform).toBe('translateY(-50%)');
  });

  it('toggles tooltip on trigger click', async () => {
    const wrapper = mountHint();
    const trigger = wrapper.get('[data-testid="info-hint-trigger"]');
    await trigger.trigger('click');
    await nextTick();
    expect(document.body.querySelector('[data-testid="info-hint-tooltip"]')).not.toBeNull();
    await trigger.trigger('click');
    await nextTick();
    expect(document.body.querySelector('[data-testid="info-hint-tooltip"]')).toBeNull();
  });

  it('does not bubble click to parent', async () => {
    const parentClick = vi.fn();
    const Parent = {
      template: '<div @click="onClick"><InfoHint message="Hint"><span /></InfoHint></div>',
      components: { InfoHint },
      setup() {
        return { onClick: parentClick };
      },
    };
    const wrapper = mount(Parent, { attachTo: document.body });
    await wrapper.get('[data-testid="info-hint-trigger"]').trigger('click');
    expect(parentClick).not.toHaveBeenCalled();
  });
});
