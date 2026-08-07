import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import FavoritesPanel from '@/components/list/FavoritesPanel.vue';
import FavoritesSheet from '@/components/list/FavoritesSheet.vue';
import ShelfTile from '@/components/list/ShelfTile.vue';
import type { ListFavoriteState } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      shelf: {
        title: 'Your favorites | Your favorite item | Your {count} favorite items',
        openButton: 'Favorites',
        empty: 'Add items repeatedly or pin them from the item menu to build your favorites.',
        excludeTitle: 'Remove from favorites?',
        alreadyInList: 'Already in list',
        alreadyInListHint: 'Already on your list.',
      },
      list: { cancel: 'Cancel' },
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

const makeEntry = (overrides: Partial<ListFavoriteState> = {}): ListFavoriteState => ({
  slug: overrides.slug ?? 'latte',
  name: overrides.name ?? 'Latte',
  category: overrides.category ?? 'dairy',
  usageCount: overrides.usageCount ?? 1,
  lastUsedAt: overrides.lastUsedAt ?? 1000,
  ...(overrides.pinned !== undefined && { pinned: overrides.pinned }),
  ...(overrides.excluded !== undefined && { excluded: overrides.excluded }),
  ...(overrides.dismissedFavorite !== undefined && {
    dismissedFavorite: overrides.dismissedFavorite,
  }),
});

describe('ShelfTile', () => {
  const mount_ = (props: {
    entry: ListFavoriteState;
    isTop?: boolean;
  }) =>
    mount(ShelfTile, {
      props: {
        entry: props.entry,
        isTop: props.isTop ?? false,
      },
      global: { plugins: [i18n] },
    });

  it('renders entry name', () => {
    const wrapper = mount_({ entry: makeEntry({ name: 'Latte' }) });
    expect(wrapper.text()).toContain('Latte');
  });

  it('renders exclude (trash) button', () => {
    const wrapper = mount_({ entry: makeEntry() });
    expect(wrapper.find('[data-testid="shelf-tile-exclude"]').exists()).toBe(true);
  });

  it('emits add with entry on click (duplicates allowed)', async () => {
    const entry = makeEntry();
    const wrapper = mount_({ entry });
    await wrapper.find('[data-testid="shelf-tile-add"]').trigger('click');
    expect(wrapper.emitted('add')?.[0]).toEqual([entry]);
  });

  it('emits exclude when trash is clicked', async () => {
    const entry = makeEntry();
    const wrapper = mount_({ entry });
    await wrapper.find('[data-testid="shelf-tile-exclude"]').trigger('click');
    expect(wrapper.emitted('exclude')?.[0]).toEqual([entry]);
    expect(wrapper.emitted('add')).toBeUndefined();
  });

  it('always emits add even when re-clicked rapidly (no in-list gate)', async () => {
    const entry = makeEntry();
    const wrapper = mount_({ entry });
    await wrapper.find('[data-testid="shelf-tile-add"]').trigger('click');
    await wrapper.find('[data-testid="shelf-tile-add"]').trigger('click');
    expect(wrapper.emitted('add')).toHaveLength(2);
  });

  it('does not render shelf-tile-top accent bar', () => {
    const wrapperTop = mount_({ entry: makeEntry(), isTop: true });
    expect(wrapperTop.find('[data-testid="shelf-tile-top"]').exists()).toBe(false);
    const wrapperNot = mount_({ entry: makeEntry(), isTop: false });
    expect(wrapperNot.find('[data-testid="shelf-tile-top"]').exists()).toBe(false);
  });

  it('never renders the label in bold, top entry or not', () => {
    for (const isTop of [true, false]) {
      const wrapper = mount_({ entry: makeEntry({ name: 'Latte' }), isTop });
      const label = wrapper.findAll('span').find((s) => s.text() === 'Latte');
      expect(label?.classes().join(' ')).not.toMatch(/font-semibold|font-bold|font-medium/);
    }
  });

  it('does not render shelf-tile-check element', () => {
    const wrapper = mount_({ entry: makeEntry() });
    expect(wrapper.find('[data-testid="shelf-tile-check"]').exists()).toBe(false);
  });

  it('always renders add row as clickable (no aria-disabled, no line-through)', () => {
    const wrapper = mount_({ entry: makeEntry() });
    const btn = wrapper.find('[data-testid="shelf-tile-add"]');
    expect(btn.attributes('aria-disabled')).toBeUndefined();
    expect(btn.classes().join(' ')).not.toMatch(/line-through|cursor-not-allowed/);
    expect(btn.classes()).toContain('cursor-pointer');
  });

  it('aria-label is just the entry name (no in-list suffix)', () => {
    const wrapper = mount_({ entry: makeEntry({ name: 'Latte' }) });
    expect(wrapper.find('[data-testid="shelf-tile-add"]').attributes('aria-label')).toBe('Latte');
  });
});

describe('FavoritesPanel', () => {
  const mount_ = (props: {
    entries: ListFavoriteState[];
    topSlugs?: Set<string>;
    presenceKeys?: Set<string>;
  }) =>
    mount(FavoritesPanel, {
      props: {
        entries: props.entries,
        topSlugs: props.topSlugs ?? new Set<string>(),
        presenceKeys: props.presenceKeys,
      },
      global: { plugins: [i18n] },
    });

  it('renders nothing when entries is empty', () => {
    const wrapper = mount_({ entries: [] });
    expect(wrapper.find('[data-testid="favorites-panel"]').exists()).toBe(false);
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(0);
  });

  it('renders one tile per entry', () => {
    const entries = [
      makeEntry({ slug: 'latte', name: 'Latte' }),
      makeEntry({ slug: 'pane', name: 'Pane' }),
      makeEntry({ slug: 'mela', name: 'Mela' }),
    ];
    const wrapper = mount_({ entries });
    expect(wrapper.findAllComponents(ShelfTile)).toHaveLength(3);
  });

  it('passes isTop to tile when entry slug is in topSlugs', () => {
    const entries = [
      makeEntry({ slug: 'a' }),
      makeEntry({ slug: 'b' }),
    ];
    const topSlugs = new Set(['a']);
    const wrapper = mount_({ entries, topSlugs });
    const tiles = wrapper.findAllComponents(ShelfTile);
    expect(tiles[0].props('isTop')).toBe(true);
    expect(tiles[1].props('isTop')).toBe(false);
  });

  it('passes inList when presenceKeys contains the entry slug+category', () => {
    const entry = makeEntry({ slug: 'latte', category: 'dairy' });
    const wrapper = mount_({
      entries: [entry],
      presenceKeys: new Set(['latte|dairy']),
    });
    expect(wrapper.findComponent(ShelfTile).props('inList')).toBe(true);
  });

  it('re-emits add-from-shelf when tile emits add', async () => {
    const entry = makeEntry({ slug: 'a' });
    const wrapper = mount_({ entries: [entry] });
    await wrapper.findComponent(ShelfTile).find('button').trigger('click');
    expect(wrapper.emitted('add-from-shelf')?.[0]).toEqual([entry]);
  });

  it('renders one sub-section per distinct category', () => {
    const entries = [
      makeEntry({ slug: 'l', name: 'Latte', category: 'dairy' }),
      makeEntry({ slug: 'm', name: 'Mela', category: 'fruit_vegetables' }),
      makeEntry({ slug: 'y', name: 'Yogurt', category: 'dairy' }),
    ];
    const wrapper = mount_({ entries });
    expect(wrapper.find('[data-testid="shelf-group-dairy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="shelf-group-fruit_vegetables"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="shelf-group-bakery"]').exists()).toBe(false);
  });

  it('keeps tile order stable when entries prop is reordered with same slugs', async () => {
    const a = makeEntry({ slug: 'a', name: 'A', category: 'dairy' });
    const b = makeEntry({ slug: 'b', name: 'B', category: 'dairy' });
    const c = makeEntry({ slug: 'c', name: 'C', category: 'dairy' });
    const wrapper = mount_({ entries: [a, b, c] });
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').slug)).toEqual([
      'a',
      'b',
      'c',
    ]);
    await wrapper.setProps({ entries: [c, a, b] });
    expect(wrapper.findAllComponents(ShelfTile).map((t) => t.props('entry').slug)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('FavoritesSheet', () => {
  const mount_ = (props: {
    open?: boolean;
    entries?: ListFavoriteState[];
    topSlugs?: Set<string>;
  }) =>
    mount(FavoritesSheet, {
      props: {
        open: props.open ?? true,
        entries: props.entries ?? [makeEntry()],
        topSlugs: props.topSlugs ?? new Set<string>(),
      },
      global: { plugins: [i18n] },
    });

  it('does not render when closed', () => {
    const wrapper = mount_({ open: false });
    expect(wrapper.find('[data-testid="favorites-backdrop"]').exists()).toBe(false);
  });

  it('shows empty hint when there are no favorites', () => {
    const wrapper = mount_({ entries: [] });
    expect(wrapper.find('[data-testid="favorites-sheet-scroll"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Add items repeatedly');
  });

  it('renders panel when entries exist', () => {
    const wrapper = mount_({ entries: [makeEntry({ name: 'Latte' })] });
    expect(wrapper.find('[data-testid="favorites-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Latte');
  });

  it('emits cancel on backdrop click', async () => {
    const wrapper = mount_({});
    await wrapper.find('[data-testid="favorites-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel on close button click', async () => {
    const wrapper = mount_({});
    await wrapper.find('[data-testid="favorites-close"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
