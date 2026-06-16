<script setup lang="ts">
import { ref, watch, useId, toRef, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, X, Camera, Images, Trash2 } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { CATEGORY_ORDER, CATEGORIES } from '@/domain/categories';
import type { Item, Category } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    open: boolean;
    item: Item | null;
    pinned?: boolean;
    /** True while upload/remove is in flight (parent-owned). */
    photoBusy?: boolean;
  }>(),
  { pinned: false, photoBusy: false },
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

// S4.2: hidden <input type="file"> inputs for camera vs gallery. The parent
// handles upload via `upload-photo` so Firestore + Storage stay in the view.
const galleryInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);

const onPickFromGallery = (): void => {
  galleryInputRef.value?.click();
};
const onPickFromCamera = (): void => {
  cameraInputRef.value?.click();
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

const photoSrc = computed(
  () => props.item?.photoURL ?? props.item?.thumbURL ?? null,
);
const hasPhoto = computed(() => Boolean(photoSrc.value));

const imageLoading = ref(false);
watch(
  () => photoSrc.value,
  (url) => {
    imageLoading.value = Boolean(url);
  },
  { immediate: true },
);
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) imageLoading.value = false;
  },
);

const showPhotoSpinner = computed(
  () => props.photoBusy || (hasPhoto.value && imageLoading.value),
);

const onPhotoLoad = (): void => {
  imageLoading.value = false;
};
const onPhotoError = (): void => {
  imageLoading.value = false;
};

const photoZoomOpen = ref(false);
const zoomPhotoSrc = computed(
  () => props.item?.photoURL ?? props.item?.thumbURL ?? null,
);
useModalBack(photoZoomOpen, () => {
  photoZoomOpen.value = false;
});

const openPhotoZoom = (): void => {
  if (!zoomPhotoSrc.value || showPhotoSpinner.value) return;
  photoZoomOpen.value = true;
};

const onDialogKeydown = (e: KeyboardEvent): void => {
  if (e.key !== 'Escape') return;
  if (photoZoomOpen.value) {
    photoZoomOpen.value = false;
    return;
  }
  emit('cancel');
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) photoZoomOpen.value = false;
  },
);
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
      @keydown="onDialogKeydown"
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
            ref="galleryInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            data-testid="edit-photo-gallery-input"
            @change="onFileChosen"
          />
          <input
            ref="cameraInputRef"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            data-testid="edit-photo-camera-input"
            @change="onFileChosen"
          />
          <div v-if="hasPhoto || photoBusy" class="flex flex-col gap-3">
            <div class="flex flex-row gap-2">
              <button
                type="button"
                data-testid="edit-photo-camera"
                :disabled="photoBusy"
                class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10 disabled:opacity-40"
                @click="onPickFromCamera"
              >
                <Camera :size="16" :stroke-width="2" aria-hidden="true" />
                {{ t('item.photoCamera') }}
              </button>
              <button
                type="button"
                data-testid="edit-photo-gallery"
                :disabled="photoBusy"
                class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10 disabled:opacity-40"
                @click="onPickFromGallery"
              >
                <Images :size="16" :stroke-width="2" aria-hidden="true" />
                {{ t('item.photoGallery') }}
              </button>
            </div>
            <button
              type="button"
              data-testid="edit-photo-remove"
              :disabled="photoBusy"
              class="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white bg-red-700 hover:bg-red-800 active:bg-red-900 disabled:opacity-40"
              @click="onRemovePhoto"
            >
              <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
              {{ t('item.photoRemove') }}
            </button>
            <div
              class="relative mx-auto h-28 w-28 overflow-hidden rounded-xl border border-cream-soft bg-offwhite"
            >
              <button
                v-if="photoSrc"
                type="button"
                data-testid="edit-photo-zoom-open"
                :aria-label="t('item.photoZoom')"
                :disabled="showPhotoSpinner"
                class="absolute inset-0 disabled:cursor-default cursor-zoom-in"
                @click="openPhotoZoom"
              >
                <img
                  :src="photoSrc"
                  alt=""
                  data-testid="edit-photo-thumb"
                  :class="[
                    'h-full w-full object-cover transition-opacity',
                    showPhotoSpinner ? 'opacity-0 pointer-events-none' : 'opacity-100',
                  ]"
                  @load="onPhotoLoad"
                  @error="onPhotoError"
                />
              </button>
              <div
                v-if="showPhotoSpinner"
                data-testid="edit-photo-spinner"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 pointer-events-none"
                role="status"
                :aria-label="t('item.photoLoading')"
              >
                <div
                  class="h-6 w-6 animate-spin rounded-full border-2 border-charcoal/20 border-t-charcoal"
                  aria-hidden="true"
                />
                <span class="text-[10px] text-muted-gray text-center leading-tight px-1">
                  {{ t('item.photoLoading') }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-row gap-2">
            <button
              type="button"
              data-testid="edit-photo-camera"
              class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10"
              @click="onPickFromCamera"
            >
              <Camera :size="16" :stroke-width="2" aria-hidden="true" />
              {{ t('item.photoCamera') }}
            </button>
            <button
              type="button"
              data-testid="edit-photo-gallery"
              class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm text-charcoal bg-offwhite border border-cream-soft hover:bg-black/5 active:bg-black/10"
              @click="onPickFromGallery"
            >
              <Images :size="16" :stroke-width="2" aria-hidden="true" />
              {{ t('item.photoGallery') }}
            </button>
          </div>
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
          {{ t('list.cancel') }}
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

    <Teleport to="body">
      <div
        v-if="photoZoomOpen && zoomPhotoSrc"
        data-testid="edit-photo-zoom"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="t('item.photoZoom')"
        @click="photoZoomOpen = false"
      >
        <img
          :src="zoomPhotoSrc"
          alt=""
          data-testid="edit-photo-zoom-image"
          class="max-h-full max-w-full object-contain"
          @click.stop
        />
      </div>
    </Teleport>
  </div>
</template>
