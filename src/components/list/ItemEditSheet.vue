<script setup lang="ts">
import { ref, watch, useId, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, X, Camera, Image as ImageIcon, Trash2 } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { CATEGORY_ORDER, CATEGORIES } from '@/domain/categories';
import type { Item, Category } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    open: boolean;
    item: Item | null;
    pinned?: boolean;
  }>(),
  { pinned: false },
);

const emit = defineEmits<{
  save: [
    {
      name: string;
      quantity: string;
      note: string;
      category: Category;
      pinned: boolean;
    },
  ];
  cancel: [];
  /** S4.2: user picked a file - parent runs `uploadItemPhoto`. */
  'upload-photo': [Item, File];
  /** S4.2: user tapped Remove on the existing photo. */
  'remove-photo': [Item];
}>();

const { t } = useI18n();

const nameRef = ref('');
const quantityRef = ref('');
const noteRef = ref('');
const categoryRef = ref<Category>('other');
const pinnedRef = ref(false);

watch(
  () => [props.open, props.item, props.pinned] as const,
  () => {
    if (props.open && props.item) {
      nameRef.value = props.item.name;
      quantityRef.value = props.item.quantity;
      noteRef.value = props.item.note;
      categoryRef.value = props.item.category;
      pinnedRef.value = props.pinned;
    }
  },
  { immediate: true },
);

const titleId = useId();

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));

const onSave = (): void => {
  const trimmed = nameRef.value.trim();
  if (!trimmed) return;
  emit('save', {
    name: trimmed,
    quantity: quantityRef.value.trim(),
    note: noteRef.value.trim(),
    category: categoryRef.value,
    pinned: pinnedRef.value,
  });
};

// S4.2: hidden <input type="file"> driven by a styled button. We expose the
// chosen file to the parent via `upload-photo` so the firestore + storage
// orchestration stays in the view (testable + composes with undo flows).
const fileInputRef = ref<HTMLInputElement | null>(null);
const onPickPhoto = (): void => {
  fileInputRef.value?.click();
};
const onFileChosen = (e: Event): void => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !props.item) return;
  emit('upload-photo', props.item, file);
  // Reset value so picking the same file twice still triggers `change`.
  input.value = '';
};
const onRemovePhoto = (): void => {
  if (props.item) emit('remove-photo', props.item);
};
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="item-edit-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      class="relative z-10 w-full sm:max-w-md mx-5 rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <h2 :id="titleId" class="text-base font-semibold text-charcoal mb-4">
        {{ t('item.options') }}
      </h2>

      <div class="space-y-3">
        <div>
          <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium mb-1">
            {{ t('item.name') }}
          </label>
          <input
            v-model="nameRef"
            data-testid="edit-name"
            class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium mb-1">
            {{ t('category.label') }}
          </label>
          <select
            v-model="categoryRef"
            data-testid="edit-category"
            class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          >
            <option v-for="c in CATEGORY_ORDER" :key="c" :value="c">
              {{ t(CATEGORIES[c].labelKey) }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium mb-1">
            {{ t('item.quantity') }}
          </label>
          <input
            v-model="quantityRef"
            data-testid="edit-quantity"
            class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium mb-1">
            {{ t('item.note') }}
          </label>
          <textarea
            v-model="noteRef"
            data-testid="edit-note"
            rows="2"
            class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        <!-- S4.2: photo attachment. Existing photo renders as a square thumb
             with a Remove overlay; absent photo shows a single Add button. -->
        <div data-testid="edit-photo-section">
          <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium mb-1">
            {{ t('item.photo') }}
          </label>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            data-testid="edit-photo-input"
            @change="onFileChosen"
          />
          <div v-if="props.item?.thumbURL || props.item?.photoURL" class="flex flex-col gap-3">
            <div class="flex flex-row gap-2">
              <button
                type="button"
                data-testid="edit-photo-replace"
                class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10"
                @click="onPickPhoto"
              >
                <Camera :size="16" :stroke-width="2" aria-hidden="true" />
                {{ t('item.photoReplace') }}
              </button>
              <button
                type="button"
                data-testid="edit-photo-remove"
                class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white bg-red-700 hover:bg-red-800 active:bg-red-900"
                @click="onRemovePhoto"
              >
                <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
                {{ t('item.photoRemove') }}
              </button>
            </div>
            <img
              :src="props.item.photoURL ?? props.item.thumbURL"
              alt=""
              data-testid="edit-photo-thumb"
              class="w-full max-h-64 rounded-xl object-contain"
            />
          </div>
          <button
            v-else
            type="button"
            data-testid="edit-photo-add"
            class="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10"
            @click="onPickPhoto"
          >
            <ImageIcon :size="16" :stroke-width="2" aria-hidden="true" />
            {{ t('item.photoAdd') }}
          </button>
        </div>

      </div>

      <div class="mt-5 flex flex-row items-center justify-between gap-2">
        <button
          data-testid="edit-cancel"
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('emptyList.cancel') }}
        </button>
        <button
          data-testid="edit-save"
          type="button"
          :disabled="!nameRef.trim()"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="onSave"
        >
          <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ t('listSettings.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
