import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import enMessages from '@/i18n/locales/en.json';
import itMessages from '@/i18n/locales/it.json';
import legalEn from '@/i18n/locales/legal.en.json';
import legalIt from '@/i18n/locales/legal.it.json';

vi.mock('@unhead/vue', () => ({
  useHead: () => undefined,
}));

import PrivacyView from '@/views/PrivacyView.vue';
import TermsView from '@/views/TermsView.vue';
import LegalFooter from '@/components/ui/LegalFooter.vue';

const buildI18n = (locale: 'it' | 'en' = 'en') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: {
      en: { ...enMessages, ...legalEn },
      it: { ...itMessages, ...legalIt },
    },
  });

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/about', name: 'about', component: { template: '<div />' } },
      { path: '/privacy', name: 'privacy', component: { template: '<div />' } },
      { path: '/terms', name: 'terms', component: { template: '<div />' } },
    ],
  });

describe('PrivacyView', () => {
  it('renders 9 privacy sections in English', () => {
    const wrapper = mount(PrivacyView, {
      global: { plugins: [buildI18n('en'), buildRouter()] },
    });
    expect(wrapper.findAll('section[id]').length).toBe(9);
    expect(wrapper.text()).toContain('Data controller');
    expect(wrapper.text()).toContain('Sentry');
    expect(wrapper.text()).toContain('Delete account');
  });

  it('renders 9 privacy sections in Italian and lists Firebase + Sentry as processors', () => {
    const wrapper = mount(PrivacyView, {
      global: { plugins: [buildI18n('it'), buildRouter()] },
    });
    expect(wrapper.findAll('section[id]').length).toBe(9);
    expect(wrapper.text()).toContain('Firebase');
    expect(wrapper.text()).toContain('Sentry');
    expect(wrapper.text()).toContain('Elimina account');
  });

  it('renders TOC anchors matching section ids', () => {
    const wrapper = mount(PrivacyView, {
      global: { plugins: [buildI18n('en'), buildRouter()] },
    });
    const anchors = wrapper.findAll('article nav a').map((a) => a.attributes('href'));
    expect(anchors).toEqual([
      '#controller',
      '#data-collected',
      '#legal-basis',
      '#processors',
      '#retention',
      '#rights',
      '#children',
      '#changes',
      '#effective-date',
    ]);
  });
});

describe('TermsView', () => {
  it('renders 6 terms sections in English', () => {
    const wrapper = mount(TermsView, {
      global: { plugins: [buildI18n('en'), buildRouter()] },
    });
    expect(wrapper.findAll('section[id]').length).toBe(6);
    expect(wrapper.text()).toContain('Governing law');
  });

  it('renders 6 terms sections in Italian', () => {
    const wrapper = mount(TermsView, {
      global: { plugins: [buildI18n('it'), buildRouter()] },
    });
    expect(wrapper.findAll('section[id]').length).toBe(6);
    expect(wrapper.text()).toContain('Legge applicabile');
  });
});

describe('LegalFooter', () => {
  it('contains links to /about, /privacy, /terms', () => {
    const wrapper = mount(LegalFooter, {
      global: { plugins: [buildI18n('en'), buildRouter()] },
    });
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'));
    expect(hrefs).toEqual(['/about', '/privacy', '/terms']);
  });
});
