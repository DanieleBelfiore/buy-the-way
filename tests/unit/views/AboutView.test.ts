import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import en from '@/i18n/locales/en.json';
import legalEn from '@/i18n/locales/legal.en.json';

const useHeadCalls: Array<{ script?: Array<{ type?: string; children?: () => string }> }> = [];

vi.mock('@unhead/vue', () => ({
  useHead: (arg: { script?: Array<{ type?: string; children?: () => string }> }) => {
    useHeadCalls.push(arg);
  },
}));

import AboutView from '@/views/AboutView.vue';

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });

const buildI18n = () =>
  createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: { ...en, ...legalEn },
    },
  });

describe('AboutView', () => {
  beforeEach(() => {
    useHeadCalls.length = 0;
  });

  it('renders hero, features and FAQ from i18n', async () => {
    const wrapper = mount(AboutView, {
      global: { plugins: [buildI18n(), buildRouter()] },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Shared shopping lists, in real time');
    expect(wrapper.findAll('li').length).toBeGreaterThanOrEqual(6);
    expect(wrapper.findAll('dt').length).toBe(10);
  });

  it('emits FAQPage and WebApplication JSON-LD via useHead', async () => {
    mount(AboutView, { global: { plugins: [buildI18n(), buildRouter()] } });
    const headCall = useHeadCalls.find((c) => c.script);
    expect(headCall).toBeTruthy();
    const scripts = headCall!.script!;
    expect(scripts).toHaveLength(2);
    const faqPayload = JSON.parse(scripts[0]!.children!());
    expect(faqPayload['@type']).toBe('FAQPage');
    expect(faqPayload.mainEntity).toHaveLength(10);
    expect(faqPayload.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer' },
    });
    const webAppPayload = JSON.parse(scripts[1]!.children!());
    expect(webAppPayload['@type']).toBe('WebApplication');
    expect(webAppPayload.name).toBe('Buy The Way');
    expect(webAppPayload.offers.price).toBe('0');
  });

  it('CTA button navigates to /login', async () => {
    const router = buildRouter();
    const pushSpy = vi.spyOn(router, 'push');
    const wrapper = mount(AboutView, { global: { plugins: [buildI18n(), router] } });
    await wrapper.get('[data-testid="about-cta"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith({ name: 'login' });
  });
});
