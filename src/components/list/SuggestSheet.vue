<script setup lang="ts">
import { computed, ref, toRef, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, WandSparkles, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';
import CategoryIcon from '@/components/list/CategoryIcon.vue';
import { SUGGEST_MIN_RUNS, type SuggestStatus, type Suggestion } from '@/domain/suggest';

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

const { t } = useI18n();
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

const sections = computed(() =>
  [
    { id: 'due', label: t('suggest.sectionDue'), rows: props.suggestions.filter((s) => s.preselected) },
    { id: 'others', label: t('suggest.sectionOthers'), rows: props.suggestions.filter((s) => !s.preselected) },
  ].filter((section) => section.rows.length > 0),
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
          class="mb-3 last:mb-0"
        >
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-gray">
            {{ section.label }}
          </h3>
          <ul class="rounded-xl border border-cream-soft bg-offwhite">
            <li
              v-for="s in section.rows"
              :key="s.key"
              data-testid="suggest-row"
              class="border-b border-cream-soft last:border-b-0"
            >
              <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  :data-testid="`suggest-check-${s.key}`"
                  :checked="selected.has(s.key)"
                  class="h-5 w-5 shrink-0 accent-primary"
                  @change="toggle(s.key, ($event.target as HTMLInputElement).checked)"
                >
                <CategoryIcon :category="s.category" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-charcoal">{{ s.name }}</span>
                  <span v-if="detail(s)" class="block truncate text-xs text-muted-gray">
                    {{ detail(s) }}
                  </span>
                </span>
              </label>
            </li>
          </ul>
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
