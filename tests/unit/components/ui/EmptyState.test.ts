import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import EmptyState from '@/components/ui/EmptyState.vue';

describe('EmptyState', () => {
  test('renders title slot', () => {
    const w = mount(EmptyState, {
      slots: { title: '<span>No items</span>' },
    });
    expect(w.text()).toContain('No items');
  });

  test('renders body slot', () => {
    const w = mount(EmptyState, {
      slots: {
        title: 'Title',
        body: '<p>Some body text</p>',
      },
    });
    expect(w.text()).toContain('Some body text');
  });

  test('renders cta slot', () => {
    const w = mount(EmptyState, {
      slots: {
        title: 'Title',
        cta: '<button>Create</button>',
      },
    });
    expect(w.find('button').exists()).toBe(true);
  });

  test('renders icon slot', () => {
    const w = mount(EmptyState, {
      slots: {
        title: 'Title',
        icon: '<svg data-testid="icon"></svg>',
      },
    });
    expect(w.find('[data-testid="icon"]').exists()).toBe(true);
  });

  test('has empty-state class', () => {
    const w = mount(EmptyState, {
      slots: { title: 'Title' },
    });
    expect(w.find('.empty-state').exists()).toBe(true);
  });
});
