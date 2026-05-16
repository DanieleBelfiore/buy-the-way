import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import ShelfTile from '@/components/list/ShelfTile.vue';
import type { CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      shelf: {
        title: 'Most Used',
        empty: 'Add items to populate your shelf',
        collapse: 'Collapse shelf',
        expand: 'Expand shelf',
        alreadyInList: 'Already in list',
      },
    },
  },
});

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: '01ABCDEFGH01234567890ABC12' as ULID,
  ownerUid: 'uid-1',
  name: 'Latte',
  category: 'dairy',
  usageCount: 1,
  lastUsedAt: 1000,
  ...overrides,
});

describe('ShelfTile', () => {
  const mount_ = (props: {
    entry: CatalogEntry;
    isTop?: boolean;
    isInList?: boolean;
  }) =>
    mount(ShelfTile, {
      props: {
        entry: props.entry,
        isTop: props.isTop ?? false,
        isInList: props.isInList ?? false,
      },
      global: { plugins: [i18n] },
    });

  it('renders entry name', () => {
    const wrapper = mount_({ entry: makeEntry({ name: 'Latte' }) });
    expect(wrapper.text()).toContain('Latte');
  });

  it('emits add with entry on click when not in list', async () => {
    const entry = makeEntry();
    const wrapper = mount_({ entry });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('add')?.[0]).toEqual([entry]);
  });

  it('does not emit add when entry already in list', async () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('add')).toBeUndefined();
  });

  it('applies top accent marker when isTop', () => {
    const wrapper = mount_({ entry: makeEntry(), isTop: true });
    expect(wrapper.find('[data-testid="shelf-tile-top"]').exists()).toBe(true);
  });

  it('omits top accent marker when not top', () => {
    const wrapper = mount_({ entry: makeEntry(), isTop: false });
    expect(wrapper.find('[data-testid="shelf-tile-top"]').exists()).toBe(false);
  });

  it('shows checkmark badge when in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    expect(wrapper.find('[data-testid="shelf-tile-check"]').exists()).toBe(true);
  });

  it('applies dimmed style when in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    const btn = wrapper.find('button');
    expect(btn.classes().join(' ')).toMatch(/line-through|opacity/);
  });

  it('button is aria-disabled when in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    expect(wrapper.find('button').attributes('aria-disabled')).toBe('true');
  });

  it('applies cursor-not-allowed when in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    expect(wrapper.find('button').classes()).toContain('cursor-not-allowed');
  });

  it('applies cursor-pointer when not in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: false });
    expect(wrapper.find('button').classes()).toContain('cursor-pointer');
  });

  it('sets title attribute with alreadyInList message when in list', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    expect(wrapper.find('button').attributes('title')).toBe('Already in list');
  });

  it('aria-label includes alreadyInList suffix when in list', () => {
    const wrapper = mount_({ entry: makeEntry({ name: 'Latte' }), isInList: true });
    expect(wrapper.find('button').attributes('aria-label')).toContain('Latte');
    expect(wrapper.find('button').attributes('aria-label')).toContain('Already in list');
  });
});

describe('MostUsedShelf', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  const mount_ = (props: {
    entries: CatalogEntry[];
    topIds?: Set<ULID>;
    itemNamesInList?: Set<string>;
  }) =>
    mount(MostUsedShelf, {
      props: {
        entries: props.entries,
        topIds: props.topIds ?? new Set<ULID>(),
        itemNamesInList: props.itemNamesInList ?? new Set<string>(),
      },
      global: { plugins: [i18n] },
    });

  it('renders empty state when entries is empty', () => {
    const wrapper = mount_({ entries: [] });
    expect(wrapper.text()).toContain('Add items to populate your shelf');
  });

  it('does not render tiles when entries is empty', () => {
    const wrapper = mount_({ entries: [] });
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(0);
  });

  it('renders one tile per entry', () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte' }),
      makeEntry({ id: '01B' as ULID, name: 'Pane' }),
      makeEntry({ id: '01C' as ULID, name: 'Mela' }),
    ];
    const wrapper = mount_({ entries });
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(3);
  });

  it('renders title and count in header', () => {
    const entries = [makeEntry({ id: '01A' as ULID }), makeEntry({ id: '01B' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.text()).toContain('Most Used');
    expect(wrapper.text()).toContain('2');
  });

  it('passes isTop to tile when entry id is in topIds', () => {
    const entries = [
      makeEntry({ id: '01A' as ULID }),
      makeEntry({ id: '01B' as ULID }),
    ];
    const topIds = new Set(['01A' as ULID]);
    const wrapper = mount_({ entries, topIds });
    const tiles = wrapper.findAllComponents(ShelfTile);
    expect(tiles[0].props('isTop')).toBe(true);
    expect(tiles[1].props('isTop')).toBe(false);
  });

  it('passes isInList to tile when entry name is in itemNamesInList', () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte' }),
      makeEntry({ id: '01B' as ULID, name: 'Pane' }),
    ];
    const itemNamesInList = new Set(['Latte']);
    const wrapper = mount_({ entries, itemNamesInList });
    const tiles = wrapper.findAllComponents(ShelfTile);
    expect(tiles[0].props('isInList')).toBe(true);
    expect(tiles[1].props('isInList')).toBe(false);
  });

  it('re-emits add-from-shelf when tile emits add', async () => {
    const entry = makeEntry({ id: '01A' as ULID });
    const wrapper = mount_({ entries: [entry] });
    await wrapper.findComponent(ShelfTile).find('button').trigger('click');
    expect(wrapper.emitted('add-from-shelf')?.[0]).toEqual([entry]);
  });

  it('toggles open/closed when chevron clicked', async () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(true);
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(true);
  });

  it('persists collapsed state to sessionStorage', async () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(sessionStorage.getItem('btw.shelf.collapsed')).toBe('true');
  });

  it('restores collapsed state from sessionStorage on mount', () => {
    sessionStorage.setItem('btw.shelf.collapsed', 'true');
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
  });

  it('defaults to open when sessionStorage has no value', () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(true);
  });
});
