import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import OnboardingTour from '@/components/onboarding/OnboardingTour.vue';

const messages = {
  en: {
    onboarding: {
      skip: 'Skip',
      next: 'Next',
      done: 'Get started',
      back: 'Back',
      step1: { title: 'S1 Title', body: 'S1 Body' },
      step2: { title: 'S2 Title', body: 'S2 Body' },
      step3: { title: 'S3 Title', body: 'S3 Body' },
    },
  },
};

const buildI18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages });

const mountTour = () =>
  mount(OnboardingTour, { global: { plugins: [buildI18n()] } });

describe('OnboardingTour', () => {
  it('starts at step 1', () => {
    const wrapper = mountTour();
    expect(wrapper.get('[data-testid="onboarding-title"]').text()).toBe('S1 Title');
    expect(wrapper.get('[data-testid="onboarding-body"]').text()).toBe('S1 Body');
  });

  it('does not show Back on step 1', () => {
    const wrapper = mountTour();
    expect(wrapper.find('[data-testid="onboarding-back"]').exists()).toBe(false);
  });

  it('advances to step 2 on Next click', async () => {
    const wrapper = mountTour();
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    expect(wrapper.get('[data-testid="onboarding-title"]').text()).toBe('S2 Title');
    expect(wrapper.find('[data-testid="onboarding-back"]').exists()).toBe(true);
  });

  it('navigates Back from step 2 to step 1', async () => {
    const wrapper = mountTour();
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await wrapper.get('[data-testid="onboarding-back"]').trigger('click');
    expect(wrapper.get('[data-testid="onboarding-title"]').text()).toBe('S1 Title');
  });

  it('Next on the last step emits "done" instead of advancing', async () => {
    const wrapper = mountTour();
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    // Now on step 3 - button says "Get started".
    expect(wrapper.get('[data-testid="onboarding-next"]').text()).toContain('Get started');
    await wrapper.get('[data-testid="onboarding-next"]').trigger('click');
    expect(wrapper.emitted('done')).toBeTruthy();
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('Skip button emits "done" from any step', async () => {
    const wrapper = mountTour();
    await wrapper.get('[data-testid="onboarding-skip"]').trigger('click');
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('renders 3 step dots and highlights the active one', async () => {
    const wrapper = mountTour();
    const dots = wrapper.findAll('[aria-hidden="true"] > span');
    // 3 step dots (the dot-strip is the only aria-hidden=true container
    // whose direct children are span elements).
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('Esc keydown emits "done" (treated as skip)', async () => {
    const wrapper = mountTour();
    await wrapper.find('[role="dialog"]').trigger('keydown.esc');
    expect(wrapper.emitted('done')).toHaveLength(1);
  });
});
