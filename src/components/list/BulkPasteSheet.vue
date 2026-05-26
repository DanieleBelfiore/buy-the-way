<script setup lang="ts">
import { ref, computed, useId, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardPaste, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

/**
 * Bulk-paste modal: lets the user dump a multi-line / comma-separated list
 * of items into a textarea. Each non-empty token becomes a candidate row,
 * with a best-guess category from the catalog (via the parent-provided
 * `inferCategory` callback). The parent commits via `bulkAddItems`.
 */
const props = defineProps<{
  open: boolean;
  inferCategory: (name: string) => Category;
}>();

const emit = defineEmits<{
  cancel: [];
  submit: [rows: Array<{ name: string; category: Category }>];
}>();

const { t } = useI18n();
const titleId = useId();

const raw = ref('');
const submitting = ref(false);

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));

// Reset the textarea every time the sheet opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      raw.value = '';
      submitting.value = false;
    }
  },
);

// Split on newlines AND commas. Trim and drop empties. Capitalisation
// happens in the service when the rows commit; we keep the raw token here
// so the preview shows what the user typed.
const tokens = computed<string[]>(() => {
  return raw.value
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
});

const rows = computed(() =>
  tokens.value.map((name) => ({
    name,
    category: props.inferCategory(name),
  })),
);

const canSubmit = computed(() => rows.value.length > 0 && !submitting.value);

const onSubmit = (): void => {
  if (!canSubmit.value) return;
  submitting.value = true;
  emit('submit', rows.value);
};
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="bulk-paste-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-md rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="mb-3">
        <h2 :id="titleId" class="text-base font-semibold text-charcoal">
          {{ t('item.bulkPasteTitle') }}
        </h2>
        <p class="mt-1 text-xs text-muted-gray whitespace-pre-line">
          {{ t('item.bulkPasteHint') }}
        </p>
      </div>

      <textarea
        v-model="raw"
        data-testid="bulk-paste-textarea"
        :aria-label="t('item.bulkPasteTitle')"
        :placeholder="t('item.bulkPastePlaceholder')"
        rows="6"
        class="w-full resize-y rounded-xl border border-cream-soft bg-offwhite px-3 py-2 text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
      />

      <!-- Preview of what we're about to add. Each chip = one item. -->
      <div
        v-if="rows.length > 0"
        data-testid="bulk-paste-preview"
        class="mt-3 max-h-40 overflow-y-auto rounded-xl border border-cream-soft bg-offwhite p-2"
      >
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="(r, i) in rows"
            :key="`${r.name}-${i}`"
            data-testid="bulk-paste-row"
            class="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-1 text-xs text-charcoal"
          >
            <span aria-hidden="true">{{ CATEGORIES[r.category].icon }}</span>
            <span>{{ r.name }}</span>
          </li>
        </ul>
      </div>
      <p
        v-else
        data-testid="bulk-paste-empty"
        class="mt-3 text-center text-xs text-muted-gray"
      >
        {{ t('item.bulkPasteNoneFound') }}
      </p>

      <div class="mt-5 flex flex-row items-center gap-2">
        <button
          type="button"
          data-testid="bulk-paste-cancel-bottom"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
        <button
          type="button"
          data-testid="bulk-paste-submit"
          :disabled="!canSubmit"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="onSubmit"
        >
          <ClipboardPaste :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ t('item.bulkPasteCount', { n: rows.length }, rows.length) }}
        </button>
      </div>
    </div>
  </div>
</template>
