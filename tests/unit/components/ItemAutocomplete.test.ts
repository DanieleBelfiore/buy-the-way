import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import type { CatalogEntry } from '@/domain/types';
import { newId } from '@/domain/id';

vi.useFakeTimers();

const makeEntry = (name: string): CatalogEntry => ({
  id: newId(),
  ownerUid: 'uid',
  name,
  category: 'other',
  usageCount: 5,
  lastUsedAt: Date.now(),
});

const entries: CatalogEntry[] = [makeEntry('Latte'), makeEntry('Pane'), makeEntry('Pasta')];

describe('ItemAutocomplete', () => {
  test('shows no suggestions when query empty', () => {
    const w = mount(ItemAutocomplete, { props: { entries } });
    expect(w.find('[role="listbox"]').exists()).toBe(false);
  });

  test('shows suggestions after debounce when query matches', async () => {
    const w = mount(ItemAutocomplete, { props: { entries } });
    await w.find('input').setValue('La');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.find('[role="listbox"]').exists()).toBe(true);
    expect(w.text()).toContain('Latte');
  });

  test('hides dropdown on Escape', async () => {
    const w = mount(ItemAutocomplete, { props: { entries } });
    await w.find('input').setValue('La');
    vi.advanceTimersByTime(250);
    await flushPromises();
    await w.find('input').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="listbox"]').exists()).toBe(false);
  });

  test('emits select with existing kind when option clicked', async () => {
    const w = mount(ItemAutocomplete, { props: { entries } });
    await w.find('input').setValue('Latte');
    vi.advanceTimersByTime(250);
    await flushPromises();
    const options = w.findAll('[role="option"]');
    const latteOption = options.find((o) => o.text().includes('Latte'));
    await latteOption!.trigger('click');
    const emitted = w.emitted('select');
    expect(emitted).toBeTruthy();
    const payload = emitted![0]![0] as { kind: string; name: string };
    expect(payload.kind).toBe('existing');
    expect(payload.name).toBe('Latte');
  });

  test('shows create option for non-matching query', async () => {
    const w = mount(ItemAutocomplete, { props: { entries } });
    await w.find('input').setValue('Zucchero');
    vi.advanceTimersByTime(250);
    await flushPromises();
    expect(w.text()).toContain('Zucchero');
    const options = w.findAll('[role="option"]');
    const createOption = options.find(
      (o) =>
        o.text().toLowerCase().includes('crea') ||
        o.text().toLowerCase().includes('create') ||
        o.text().includes('+'),
    );
    expect(createOption).toBeDefined();
  });
});
