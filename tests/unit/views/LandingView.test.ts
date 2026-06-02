import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import en from '@/i18n/locales/en.json';
import legalEn from '@/i18n/locales/legal.en.json';

const useHeadCalls: Array<{ script?: Array<{ type?: string; innerHTML?: () => string }> }> = [];

vi.mock('@unhead/vue', () => ({
  useHead: (arg: { script?: Array<{ type?: string; innerHTML?: () => string }> }) => {
    useHeadCalls.push(arg);
  },
}));

import LandingView from '@/views/LandingView.vue';

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/about', name: 'about', component: { template: '<div />' } },
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

describe('LandingView', () => {
  beforeEach(() => {
    useHeadCalls.length = 0;
  });

  it('renders hero and the three highlights from i18n', async () => {
    const wrapper = mount(LandingView, {
      global: { plugins: [buildI18n(), buildRouter()] },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Shopping lists your whole family shares');
    expect(wrapper.text()).toContain('Real-time sync');
    expect(wrapper.findAll('section ul > li')).toHaveLength(3);
  });

  it('primary CTA navigates to /login', async () => {
    const router = buildRouter();
    const pushSpy = vi.spyOn(router, 'push');
    const wrapper = mount(LandingView, { global: { plugins: [buildI18n(), router] } });
    await wrapper.get('[data-testid="home-cta"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith({ name: 'login' });
  });

  it('secondary CTA navigates to /about', async () => {
    const router = buildRouter();
    const pushSpy = vi.spyOn(router, 'push');
    const wrapper = mount(LandingView, { global: { plugins: [buildI18n(), router] } });
    await wrapper.get('[data-testid="home-secondary"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith({ name: 'about' });
  });

  it('emits WebApplication and Organization JSON-LD via useHead', () => {
    mount(LandingView, { global: { plugins: [buildI18n(), buildRouter()] } });
    const headCall = useHeadCalls.find((c) => c.script);
    expect(headCall).toBeTruthy();
    const scripts = headCall!.script!;
    expect(scripts).toHaveLength(2);
    const webApp = JSON.parse(scripts[0]!.innerHTML!());
    expect(webApp['@type']).toBe('WebApplication');
    expect(webApp.name).toBe('Buy The Way');
    expect(webApp.offers.price).toBe('0');
    const org = JSON.parse(scripts[1]!.innerHTML!());
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('Buy The Way');
  });
});
