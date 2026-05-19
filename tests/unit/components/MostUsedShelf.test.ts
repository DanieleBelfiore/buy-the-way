import { describe, it, expect } from 'vitest';
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
        title: 'Your favorites | Your favorite item | Your {count} favorite items',
        empty: 'Add items to populate your shelf',
        collapse: 'Collapse shelf',
        expand: 'Expand shelf',
        alreadyInList: 'Already in list',
      },
      category: {
        fruit_vegetables: 'Fruit & Veg',
        dairy: 'Dairy',
        meat: 'Meat',
        fish: 'Fish',
        bakery: 'Bakery',
        beverages: 'Beverages',
        frozen: 'Frozen',
        cleaning: 'Cleaning',
        hygiene: 'Hygiene',
        other: 'Other',
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

  it('does not render shelf-tile-top accent bar', () => {
    const wrapperTop = mount_({ entry: makeEntry(), isTop: true });
    expect(wrapperTop.find('[data-testid="shelf-tile-top"]').exists()).toBe(false);
    const wrapperNot = mount_({ entry: makeEntry(), isTop: false });
    expect(wrapperNot.find('[data-testid="shelf-tile-top"]').exists()).toBe(false);
  });

  it('does not render shelf-tile-check element', () => {
    const wrapper = mount_({ entry: makeEntry(), isInList: true });
    expect(wrapper.find('[data-testid="shelf-tile-check"]').exists()).toBe(false);
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

  it('renders nothing when entries is empty', () => {
    const wrapper = mount_({ entries: [] });
    expect(wrapper.find('[data-testid="shelf-title"]').exists()).toBe(false);
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(0);
  });

  it('renders one tile per entry when expanded', async () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte' }),
      makeEntry({ id: '01B' as ULID, name: 'Pane' }),
      makeEntry({ id: '01C' as ULID, name: 'Mela' }),
    ];
    const wrapper = mount_({ entries });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(3);
  });

  it('renders title with the favorites count', () => {
    const entries = [
      makeEntry({ id: '01A' as ULID }),
      makeEntry({ id: '01B' as ULID, name: 'B' }),
    ];
    const wrapper = mount_({ entries });
    const headerText = wrapper.find('[data-testid="shelf-title"]').text();
    expect(headerText).toContain('2');
    expect(headerText).toContain('favorite');
  });

  it('renders singular title form when there is exactly one favorite', () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    const headerText = wrapper.find('[data-testid="shelf-title"]').text();
    expect(headerText).toBe('Your favorite item');
  });

  it('defaults to collapsed on mount', () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
  });

  it('passes isTop to tile when entry id is in topIds (expanded)', async () => {
    const entries = [
      makeEntry({ id: '01A' as ULID }),
      makeEntry({ id: '01B' as ULID }),
    ];
    const topIds = new Set(['01A' as ULID]);
    const wrapper = mount_({ entries, topIds });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    const tiles = wrapper.findAllComponents(ShelfTile);
    expect(tiles[0].props('isTop')).toBe(true);
    expect(tiles[1].props('isTop')).toBe(false);
  });

  it('passes isInList to tile when entry name is in itemNamesInList (expanded)', async () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte' }),
      makeEntry({ id: '01B' as ULID, name: 'Pane' }),
    ];
    const itemNamesInList = new Set(['Latte']);
    const wrapper = mount_({ entries, itemNamesInList });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    const tiles = wrapper.findAllComponents(ShelfTile);
    expect(tiles[0].props('isInList')).toBe(true);
    expect(tiles[1].props('isInList')).toBe(false);
  });

  it('re-emits add-from-shelf when tile emits add', async () => {
    const entry = makeEntry({ id: '01A' as ULID });
    const wrapper = mount_({ entries: [entry] });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    await wrapper.findComponent(ShelfTile).find('button').trigger('click');
    expect(wrapper.emitted('add-from-shelf')?.[0]).toEqual([entry]);
  });

  it('toggles open/closed when title clicked', async () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
    await wrapper.find('[data-testid="shelf-title"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(true);
    await wrapper.find('[data-testid="shelf-title"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
  });

  it('toggles open/closed when chevron clicked', async () => {
    const entries = [makeEntry({ id: '01A' as ULID })];
    const wrapper = mount_({ entries });
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(true);
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findComponent(ShelfTile).exists()).toBe(false);
  });

  it('renders one sub-section per distinct category when expanded', async () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte', category: 'dairy' }),
      makeEntry({ id: '01B' as ULID, name: 'Mela', category: 'fruit_vegetables' }),
      makeEntry({ id: '01C' as ULID, name: 'Yogurt', category: 'dairy' }),
    ];
    const wrapper = mount_({ entries });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="shelf-group-dairy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="shelf-group-fruit_vegetables"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="shelf-group-bakery"]').exists()).toBe(false);
  });

  it('renders sub-sections in alphabetical order by translated category label', async () => {
    const entries = [
      makeEntry({ id: '01A' as ULID, name: 'Latte', category: 'dairy' }),
      makeEntry({ id: '01B' as ULID, name: 'Pane', category: 'bakery' }),
      makeEntry({ id: '01C' as ULID, name: 'Mela', category: 'fruit_vegetables' }),
    ];
    const wrapper = mount_({ entries });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    const groupNodes = wrapper.findAll('[data-testid^="shelf-group-"]')
      .filter((n) => n.attributes('data-testid')?.startsWith('shelf-group-') && !n.attributes('data-testid')?.includes('-title-'));
    const order = groupNodes.map((n) => n.attributes('data-testid'));
    expect(order).toEqual([
      'shelf-group-bakery',
      'shelf-group-dairy',
      'shelf-group-fruit_vegetables',
    ]);
  });

  it('keeps tile order stable when entries prop is reordered with same ids', async () => {
    const a = makeEntry({ id: '01A' as ULID, name: 'A', category: 'dairy' });
    const b = makeEntry({ id: '01B' as ULID, name: 'B', category: 'dairy' });
    const c = makeEntry({ id: '01C' as ULID, name: 'C', category: 'dairy' });
    const wrapper = mount_({ entries: [a, b, c] });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').id)).toEqual([
      '01A',
      '01B',
      '01C',
    ]);
    // Simulate a re-rank: same ids, reordered by score
    await wrapper.setProps({ entries: [c, a, b] });
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').id)).toEqual([
      '01A',
      '01B',
      '01C',
    ]);
  });

  it('refreshes order when entries prop adds a new id', async () => {
    const a = makeEntry({ id: '01A' as ULID, name: 'A', category: 'dairy' });
    const b = makeEntry({ id: '01B' as ULID, name: 'B', category: 'dairy' });
    const wrapper = mount_({ entries: [a, b] });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    const c = makeEntry({ id: '01C' as ULID, name: 'C', category: 'dairy' });
    await wrapper.setProps({ entries: [c, a, b] });
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').id)).toEqual([
      '01C',
      '01A',
      '01B',
    ]);
  });

  it('refreshes order when entries prop removes an id', async () => {
    const a = makeEntry({ id: '01A' as ULID, name: 'A', category: 'dairy' });
    const b = makeEntry({ id: '01B' as ULID, name: 'B', category: 'dairy' });
    const c = makeEntry({ id: '01C' as ULID, name: 'C', category: 'dairy' });
    const wrapper = mount_({ entries: [a, b, c] });
    await wrapper.find('[data-testid="shelf-toggle"]').trigger('click');
    await wrapper.setProps({ entries: [b, c] });
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').id)).toEqual([
      '01B',
      '01C',
    ]);
  });
});
