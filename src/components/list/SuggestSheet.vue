<script setup lang="ts">
import { computed, ref, toRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, WandSparkles, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';
import { CATEGORIES, CATEGORY_ORDER } from '@/domain/categories';
import { iconForItem } from '@/domain/public-catalog';
import { SUGGEST_MIN_RUNS, type SuggestStatus, type Suggestion } from '@/domain/suggest';
import type { Category } from '@/domain/types';

/**
 * Review step for history-based suggestions: the parent computes them, the
 * user unticks what is not needed, the parent commits the rest.
 */
const props = defineProps<{
  open: boolean;
  status: SuggestStatus;
  runCount: number;
  suggestions: Suggestion[];
}>();

const emit = defineEmits<{
  cancel: [];
  submit: [rows: Suggestion[]];
}>();

const { t, locale } = useI18n();
const titleId = useId();

const selected = ref<Set<string>>(new Set());
const submitting = ref(false);

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
const dialogRef = ref<HTMLElement | null>(null);
useFocusTrap(openRef, dialogRef, { initialFocus: 'container' });

watch(
  [() => props.open, () => props.suggestions],
  () => {
    selected.value = new Set(props.suggestions.filter((s) => s.preselected).map((s) => s.key));
    submitting.value = false;
  },
  { immediate: true },
);

const groupByCategory = (rows: Suggestion[]): Array<{ category: Category; rows: Suggestion[] }> =>
  CATEGORY_ORDER.map((category) => ({
    category,
    rows: rows.filter((s) => s.category === category),
  })).filter((group) => group.rows.length > 0);

const sections = computed(() =>
  [
    { id: 'due', label: t('suggest.sectionDue'), rows: props.suggestions.filter((s) => s.preselected) },
    { id: 'others', label: t('suggest.sectionOthers'), rows: props.suggestions.filter((s) => !s.preselected) },
  ]
    .filter((section) => section.rows.length > 0)
    .map((section) => ({ ...section, groups: groupByCategory(section.rows) })),
);

const message = computed((): string | null => {
  if (props.status === 'loading') return t('suggest.loading');
  if (props.status === 'error') return t('suggest.error');
  if (props.runCount < SUGGEST_MIN_RUNS) {
    return t('suggest.notEnoughHistory', { n: SUGGEST_MIN_RUNS });
  }
  if (props.suggestions.length === 0) return t('suggest.nothingToSuggest');
  return null;
});

const selectedCount = computed(() => selected.value.size);
const allSelected = computed(() => selectedCount.value === props.suggestions.length);
const canSubmit = computed(() => selectedCount.value > 0 && !submitting.value);

const toggle = (key: string, checked: boolean): void => {
  const next = new Set(selected.value);
  if (checked) next.add(key);
  else next.delete(key);
  selected.value = next;
};

const toggleAll = (): void => {
  selected.value = allSelected.value ? new Set() : new Set(props.suggestions.map((s) => s.key));
};

const detail = (s: Suggestion): string =>
  [
    s.quantity.trim(),
    s.intervalDays !== null && s.intervalDays >= 1
      ? t('suggest.every', { n: s.intervalDays }, s.intervalDays)
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

const onSubmit = (): void => {
  if (!canSubmit.value) return;
  submitting.value = true;
  emit('submit', props.suggestions.filter((s) => selected.value.has(s.key)));
};
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="suggest-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 flex w-full max-w-md max-h-[min(80dvh,640px)] flex-col rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="mb-3 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <h2
            :id="titleId"
            class="inline-flex items-center gap-1.5 text-base font-semibold text-charcoal"
          >
            <WandSparkles :size="16" :stroke-width="2" class="text-primary" aria-hidden="true" />
            <span>{{ t('suggest.title') }}</span>
          </h2>
          <button
            v-if="!message"
            type="button"
            data-testid="suggest-toggle-all"
            class="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-charcoal hover:bg-black/5 active:bg-black/10"
            @click="toggleAll"
          >
            {{ allSelected ? t('suggest.deselectAll') : t('suggest.selectAll') }}
          </button>
        </div>
        <p
          v-if="message"
          data-testid="suggest-message"
          role="status"
          class="mt-2 text-sm text-muted-gray"
        >
          {{ message }}
        </p>
        <p v-else class="mt-1 text-xs text-muted-gray">
          {{ t('suggest.hint') }}
        </p>
      </div>

      <div
        v-if="!message"
        data-testid="suggest-scroll"
        class="min-h-0 flex-1 overflow-y-auto -mx-1 px-1"
      >
        <section
          v-for="section in sections"
          :key="section.id"
          :data-testid="`suggest-section-${section.id}`"
          class="mb-4 last:mb-0"
        >
          <h3 class="mb-2 text-sm font-semibold text-charcoal">
            {{ section.label }}
          </h3>
          <div
            v-for="group in section.groups"
            :key="group.category"
            :data-testid="`suggest-group-${section.id}-${group.category}`"
            class="mb-3 last:mb-0"
          >
            <h4 class="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-gray">
              <span aria-hidden="true" :style="{ color: CATEGORIES[group.category].cssVar }">{{ CATEGORIES[group.category].icon }}</span>
              <span>{{ t(CATEGORIES[group.category].labelKey) }}</span>
            </h4>
            <ul class="flex flex-col gap-2">
              <li v-for="s in group.rows" :key="s.key" data-testid="suggest-row">
                <label
                  class="flex w-full cursor-pointer select-none items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors focus-within:ring-2 focus-within:ring-charcoal/20"
                  :class="selected.has(s.key)
                    ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 active:bg-primary/15'
                    : 'border-cream-soft bg-offwhite hover:bg-cream active:bg-cream-soft'"
                >
                  <input
                    type="checkbox"
                    :data-testid="`suggest-check-${s.key}`"
                    :checked="selected.has(s.key)"
                    class="sr-only"
                    @change="toggle(s.key, ($event.target as HTMLInputElement).checked)"
                  >
                  <span
                    aria-hidden="true"
                    data-testid="suggest-row-icon"
                    class="shrink-0 text-base leading-none"
                  >
                    {{ iconForItem(s.name, locale, s.category) }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-normal text-charcoal">{{ s.name }}</span>
                    <span v-if="detail(s)" class="block truncate text-xs text-muted-gray">
                      {{ detail(s) }}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors"
                    :class="selected.has(s.key)
                      ? 'border-primary bg-primary text-white'
                      : 'border-muted-gray/50 bg-transparent'"
                  >
                    <Check v-if="selected.has(s.key)" :size="12" :stroke-width="3" />
                  </span>
                </label>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <div class="mt-4 flex shrink-0 flex-row items-center gap-2">
        <button
          type="button"
          data-testid="suggest-cancel"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
        <button
          v-if="!message"
          type="button"
          data-testid="suggest-submit"
          :disabled="!canSubmit"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="onSubmit"
        >
          <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ t('suggest.addCount', { n: selectedCount }, selectedCount) }}
        </button>
      </div>
    </div>
  </div>
</template>
