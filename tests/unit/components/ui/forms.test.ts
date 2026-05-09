import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Chip from '@/components/ui/Chip.vue';
import FAB from '@/components/ui/FAB.vue';

describe('Button', () => {
  test('renders default slot content', () => {
    const w = mount(Button, { slots: { default: 'Click me' } });
    expect(w.text()).toContain('Click me');
  });

  test('has btn class', () => {
    const w = mount(Button);
    expect(w.classes()).toContain('btn');
  });

  test('applies variant class', () => {
    const w = mount(Button, { props: { variant: 'ghost' } });
    expect(w.classes()).toContain('btn--ghost');
  });

  test('applies full class when full prop', () => {
    const w = mount(Button, { props: { full: true } });
    expect(w.classes()).toContain('btn--full');
  });

  test('is disabled when disabled prop', () => {
    const w = mount(Button, { props: { disabled: true } });
    expect(w.attributes('disabled')).toBeDefined();
  });
});

describe('Input', () => {
  test('renders input element', () => {
    const w = mount(Input, { props: { modelValue: '' } });
    expect(w.find('input').exists()).toBe(true);
  });

  test('emits update:modelValue on input', async () => {
    const w = mount(Input, { props: { modelValue: '' } });
    await w.find('input').setValue('hello');
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['hello']);
  });
});

describe('Chip', () => {
  test('has chip class', () => {
    const w = mount(Chip);
    expect(w.classes()).toContain('chip');
  });

  test('applies dark variant class', () => {
    const w = mount(Chip, { props: { variant: 'dark' } });
    expect(w.classes()).toContain('chip--dark');
  });
});

describe('FAB', () => {
  test('renders with ariaLabel', () => {
    const w = mount(FAB, { props: { ariaLabel: 'Add item' } });
    expect(w.attributes('aria-label')).toBe('Add item');
  });

  test('has fab class', () => {
    const w = mount(FAB, { props: { ariaLabel: 'Add' } });
    expect(w.classes()).toContain('fab');
  });
});
