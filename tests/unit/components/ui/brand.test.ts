import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import Avatar from '@/components/ui/Avatar.vue';
import AvatarStack from '@/components/ui/AvatarStack.vue';
import Wordmark from '@/components/ui/Wordmark.vue';

describe('Avatar', () => {
  test('shows first initial of single-word name', () => {
    const w = mount(Avatar, { props: { name: 'Alice' } });
    expect(w.text()).toContain('A');
  });

  test('shows two initials for two-word name', () => {
    const w = mount(Avatar, { props: { name: 'Alice Brown' } });
    expect(w.text()).toContain('AB');
  });

  test('applies cream tone by default', () => {
    const w = mount(Avatar, { props: { name: 'Alice' } });
    expect(w.classes()).toContain('chip');
  });

  test('applies dark class when tone is dark', () => {
    const w = mount(Avatar, { props: { name: 'Alice', tone: 'dark' } });
    expect(w.classes()).toContain('chip--dark');
  });
});

describe('AvatarStack', () => {
  test('renders up to 3 avatars for 3 names', () => {
    const w = mount(AvatarStack, { props: { names: ['Alice', 'Bob', 'Carol'] } });
    expect(w.findAll('[data-testid="avatar"]')).toHaveLength(3);
    expect(w.text()).not.toContain('+');
  });

  test('shows +N chip for more than 3 names', () => {
    const w = mount(AvatarStack, { props: { names: ['A', 'B', 'C', 'D', 'E'] } });
    expect(w.findAll('[data-testid="avatar"]')).toHaveLength(3);
    expect(w.text()).toContain('+2');
  });
});

describe('Wordmark', () => {
  test('contains Buy The Way text', () => {
    const w = mount(Wordmark);
    expect(w.text()).toContain('Buy The Way');
  });

  test('accepts size prop without error', () => {
    expect(() => mount(Wordmark, { props: { size: 'lg' } })).not.toThrow();
  });
});
