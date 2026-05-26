import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ItemEditSheet from '@/components/list/ItemEditSheet.vue';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        addPlaceholder: 'Add an item',
        name: 'Name',
        quantity: 'Quantity',
        note: 'Note',
        pinFavorite: 'Pin to favorites',
        customBadge: 'Custom item',
        photoReplace: 'Replace',
        photoCamera: 'Camera',
        photoGallery: 'Gallery',
        photoRemove: 'Remove',
        photoAdd: 'Add photo',
        photoLoading: 'Loading photo…',
        photoZoom: 'Zoom photo',
        photo: 'Photo',
        options: 'Options',
      },
      shelf: { title: 'Favorites' },
      listSettings: { save: 'Save' },
      emptyList: { cancel: 'Cancel' },
      category: {
        label: 'Category',
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

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '01ABC' as ULID,
  listId: '01LIST' as ULID,
  name: 'Latte',
  quantity: '1L',
  category: 'dairy',
  note: 'fresco',
  checked: false,
  createdByUid: 'u',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const mountSheet = (
  open: boolean,
  item: Item | null,
  extra?: { photoBusy?: boolean },
) =>
  mount(ItemEditSheet, {
    props: { open, item, photoBusy: extra?.photoBusy ?? false },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('ItemEditSheet', () => {
  it('does not render dialog when closed', () => {
    const wrapper = mountSheet(false, makeItem());
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders dialog and prefilled inputs when open', () => {
    const wrapper = mountSheet(true, makeItem());
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect((wrapper.get('[data-testid="edit-name"]').element as HTMLInputElement).value).toBe('Latte');
    expect((wrapper.get('[data-testid="edit-quantity"]').element as HTMLInputElement).value).toBe('1L');
    wrapper.unmount();
  });

  it('emits cancel on backdrop click', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="item-edit-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on Cancel button', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="edit-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits save with trimmed values on Save', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="edit-name"]').setValue('  Pane  ');
    await wrapper.get('[data-testid="edit-quantity"]').setValue(' 2 ');
    await wrapper.get('[data-testid="edit-note"]').setValue(' integrale ');
    await wrapper.get('[data-testid="edit-save"]').trigger('click');
    expect(wrapper.emitted('save')?.[0]).toEqual([
      { name: 'Pane', quantity: '2', note: 'integrale', category: 'dairy', pinned: false },
    ]);
    wrapper.unmount();
  });

  it('Save disabled when name empty', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="edit-name"]').setValue('   ');
    expect(wrapper.get('[data-testid="edit-save"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('does not emit save when name empty', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="edit-name"]').setValue('   ');
    await wrapper.get('[data-testid="edit-save"]').trigger('click');
    expect(wrapper.emitted('save')).toBeFalsy();
    wrapper.unmount();
  });

  it('allows changing category via select', async () => {
    const wrapper = mountSheet(true, makeItem());
    await wrapper.get('[data-testid="edit-category"]').setValue('bakery');
    await wrapper.get('[data-testid="edit-save"]').trigger('click');
    const payload = wrapper.emitted('save')![0]![0] as { category: string };
    expect(payload.category).toBe('bakery');
    wrapper.unmount();
  });

  it('does not render priority row', () => {
    const wrapper = mountSheet(true, makeItem({ priority: 'urgent' }));
    expect(wrapper.find('[data-testid="edit-priority-row"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="edit-priority-urgent"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('save payload does not include priority', async () => {
    const wrapper = mountSheet(true, makeItem({ priority: 'urgent' }));
    await wrapper.get('[data-testid="edit-save"]').trigger('click');
    const payload = wrapper.emitted('save')![0]![0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('priority');
    wrapper.unmount();
  });

  it('uses item.name label (not item.addPlaceholder)', () => {
    const wrapper = mountSheet(true, makeItem());
    const labels = wrapper.findAll('label').map((l) => l.text());
    expect(labels).toContain('Name');
    expect(labels).not.toContain('Add an item');
    wrapper.unmount();
  });

  it('never renders the exclude-from-suggestions block', () => {
    const wrapper = mountSheet(true, makeItem({ name: 'Babà' }));
    expect(wrapper.find('[data-testid="edit-exclude-block"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="edit-exclude-suggestions"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('offers separate camera and gallery pickers for photo attachment', () => {
    const wrapper = mountSheet(true, makeItem());
    expect(wrapper.find('[data-testid="edit-photo-camera"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edit-photo-gallery"]').exists()).toBe(true);
    const cameraInput = wrapper.find('[data-testid="edit-photo-camera-input"]').element as HTMLInputElement;
    const galleryInput = wrapper.find('[data-testid="edit-photo-gallery-input"]').element as HTMLInputElement;
    expect(cameraInput.getAttribute('capture')).toBe('environment');
    expect(galleryInput.hasAttribute('capture')).toBe(false);
    wrapper.unmount();
  });

  it('shows a spinner while photoBusy is true', () => {
    const wrapper = mountSheet(true, makeItem(), { photoBusy: true });
    expect(wrapper.find('[data-testid="edit-photo-spinner"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading photo…');
    wrapper.unmount();
  });

  it('shows spinner over an existing photo until the image loads', async () => {
    const wrapper = mountSheet(
      true,
      makeItem({ photoURL: 'https://example.com/photo.jpg' }),
    );
    expect(wrapper.find('[data-testid="edit-photo-spinner"]').exists()).toBe(true);
    await wrapper.get('[data-testid="edit-photo-thumb"]').trigger('load');
    expect(wrapper.find('[data-testid="edit-photo-spinner"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('opens a full-screen zoom when the photo thumb is clicked', async () => {
    const wrapper = mountSheet(
      true,
      makeItem({
        photoURL: 'https://example.com/photo-full.jpg',
        thumbURL: 'https://example.com/photo-thumb.jpg',
      }),
    );
    await wrapper.get('[data-testid="edit-photo-thumb"]').trigger('load');
    expect(document.querySelector('[data-testid="edit-photo-zoom"]')).toBeNull();
    await wrapper.get('[data-testid="edit-photo-zoom-open"]').trigger('click');
    const zoom = document.querySelector('[data-testid="edit-photo-zoom"]');
    expect(zoom).not.toBeNull();
    const img = document.querySelector('[data-testid="edit-photo-zoom-image"]') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/photo-full.jpg');
    await (zoom as HTMLElement).click();
    expect(document.querySelector('[data-testid="edit-photo-zoom"]')).toBeNull();
    wrapper.unmount();
  });
});
