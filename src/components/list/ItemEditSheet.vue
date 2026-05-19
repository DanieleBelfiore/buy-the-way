<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, EyeOff, X } from '@lucide/vue';
import { CATEGORY_ORDER, CATEGORIES } from '@/domain/categories';
import { isCustomItemName } from '@/domain/public-catalog';
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
  'exclude-from-suggestions': [Item];
}>();

const { t, locale } = useI18n();

const isCustom = computed(() =>
  props.item ? isCustomItemName(props.item.name, locale.value) : false,
);

const onExcludeFromSuggestions = (): void => {
  if (props.item) emit('exclude-from-suggestions', props.item);
};

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
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
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
      tabindex="-1"
      class="relative z-10 w-full sm:max-w-md mx-0 sm:mx-5 rounded-t-2xl sm:rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <h2 :id="titleId" class="text-base font-semibold text-charcoal mb-4">
        {{ props.item?.name ?? '' }}
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

      </div>

      <div
        v-if="isCustom"
        data-testid="edit-exclude-block"
        class="mt-4 pt-4 border-t border-cream-soft"
      >
        <button
          type="button"
          data-testid="edit-exclude-suggestions"
          class="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-red-700 border border-red-200 bg-red-50/50 hover:bg-red-100 active:bg-red-200 transition-colors"
          @click="onExcludeFromSuggestions"
        >
          <EyeOff :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('item.removeFromSuggestions') }}
        </button>
        <p class="mt-2 text-xs text-muted-gray text-center">
          {{ t('item.removeFromSuggestionsHint') }}
        </p>
      </div>

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          data-testid="edit-cancel"
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('emptyList.cancel') }}
        </button>
        <button
          data-testid="edit-save"
          type="button"
          :disabled="!nameRef.trim()"
          class="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-offwhite hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="onSave"
        >
          <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ t('listSettings.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
