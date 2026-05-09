import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import IconPlus from '@/components/ui/icons/IconPlus.vue';
import IconCheck from '@/components/ui/icons/IconCheck.vue';

describe('Icons', () => {
  test('IconPlus renders SVG with correct viewBox', () => {
    const w = mount(IconPlus);
    const svg = w.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('viewBox')).toBe('0 0 24 24');
  });

  test('IconPlus accepts custom size', () => {
    const w = mount(IconPlus, { props: { size: 32 } });
    const svg = w.find('svg');
    expect(svg.attributes('width')).toBe('32');
    expect(svg.attributes('height')).toBe('32');
  });

  test('IconCheck renders SVG', () => {
    const w = mount(IconCheck);
    expect(w.find('svg').exists()).toBe(true);
  });

  test('icons/index re-exports IconPlus', async () => {
    const mod = await import('@/components/ui/icons/index');
    expect(mod.IconPlus).toBeDefined();
  });
});
