<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCatalogStore, type Suggestion } from '@/stores/catalog';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { normalizeName, iconForName } from '@/domain/public-catalog';
import type { Category } from '@/domain/types';

const { t, locale } = useI18n();
const catalog = useCatalogStore();

const emit = defineEmits<{
  'add-item': [{ name: string; category: Category; quantity: string; note: string }];
  'active-change': [boolean];
}>();

const { immediate: rawQuery, debounced: query } = useDebouncedRef('', 120);
const isOpen = ref(false);
const highlightIndex = ref(-1);

const suggestions = computed<Suggestion[]>(() =>
  catalog.suggestionsFor(query.value, locale.value),
);
const hasText = computed(() => rawQuery.value.trim().length > 0);
const typedMatchesSuggestion = computed(() => {
  if (!hasText.value) return false;
  const norm = normalizeName(rawQuery.value);
  return suggestions.value.some((s) => normalizeName(s.name) === norm);
});
const showCustom = computed(() => hasText.value && !typedMatchesSuggestion.value);

const totalOptions = computed(() => suggestions.value.length + (showCustom.value ? 1 : 0));

watch(rawQuery, (val) => {
  const active = val.trim().length > 0;
  isOpen.value = active;
  highlightIndex.value = -1;
  emit('active-change', active);
});

const optionId = (i: number) => `autocomplete-option-${i}`;
const listboxId = 'autocomplete-listbox';

const commit = (entry: Suggestion | null) => {
  const name = entry ? entry.name : rawQuery.value.trim();
  const category: Category = entry ? entry.category : 'other';
  if (!name) return;
  emit('add-item', { name, category, quantity: '', note: '' });
  rawQuery.value = '';
  isOpen.value = false;
  highlightIndex.value = -1;
};

const onKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value && e.key !== 'Enter') return;
  const count = totalOptions.value;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightIndex.value = count > 0 ? (highlightIndex.value + 1) % count : -1;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightIndex.value = count > 0 ? (highlightIndex.value - 1 + count) % count : -1;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightIndex.value >= 0 && highlightIndex.value < suggestions.value.length) {
      commit(suggestions.value[highlightIndex.value]);
    } else if (highlightIndex.value === suggestions.value.length && showCustom.value) {
      commit(null);
    } else if (showCustom.value) {
      commit(null);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    isOpen.value = false;
    highlightIndex.value = -1;
  }
};
</script>

<template>
  <div class="relative">
    <input
      id="autocomplete-input"
      v-model="rawQuery"
      type="text"
      role="combobox"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      :aria-activedescendant="highlightIndex >= 0 ? optionId(highlightIndex) : undefined"
      :placeholder="t('item.addPlaceholder')"
      class="w-full px-4 py-3 text-sm text-charcoal bg-offwhite border border-cream-soft rounded-xl placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
      autocomplete="off"
      @input="() => {}"
      @keydown="onKeydown"
    />

    <ul
      v-if="isOpen && totalOptions > 0"
      :id="listboxId"
      role="listbox"
      class="absolute top-full left-0 right-0 z-50 mt-1 bg-offwhite border border-cream-soft rounded-xl shadow-sm max-h-60 overflow-y-auto"
    >
      <li
        v-for="(entry, i) in suggestions"
        :id="optionId(i)"
        :key="entry.key"
        role="option"
        :aria-selected="highlightIndex === i"
        :class="[
          'flex items-center gap-2 px-5 py-3 text-sm text-charcoal cursor-pointer',
          highlightIndex === i ? 'bg-offwhite' : 'hover:bg-cream',
        ]"
        data-testid="suggestion-option"
        @click="commit(entry)"
      >
        <span aria-hidden="true" class="text-base leading-none">
          {{ entry.icon ?? iconForName(entry.name, locale) }}
        </span>
        <span>{{ entry.name }}</span>
      </li>

      <li
        v-if="showCustom"
        :id="optionId(suggestions.length)"
        role="option"
        :aria-selected="highlightIndex === suggestions.length"
        :class="[
          'px-5 py-3 text-sm text-muted-gray cursor-pointer italic',
          highlightIndex === suggestions.length ? 'bg-offwhite' : 'hover:bg-cream',
        ]"
        data-testid="custom-option"
        @click="commit(null)"
      >
        {{ t('item.addCustom', { name: rawQuery.trim() }) }}
      </li>
    </ul>
  </div>
</template>
