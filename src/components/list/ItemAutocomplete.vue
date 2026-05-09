<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Category, CatalogEntry } from '@/domain/types';
import { rankByRecency } from '@/domain/ranking';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import Input from '@/components/ui/Input.vue';
import IconSearch from '@/components/ui/icons/IconSearch.vue';
import IconStar from '@/components/ui/icons/IconStar.vue';
import IconPlus from '@/components/ui/icons/IconPlus.vue';
import CategoryIcon from '@/components/ui/CategoryIcon.vue';

interface Props {
  entries: readonly CatalogEntry[];
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
});

type SelectPayload =
  | { kind: 'existing'; name: string; category: Category }
  | { kind: 'new'; name: string; category: Category };

const emit = defineEmits<{
  (e: 'select', payload: SelectPayload): void;
}>();

// Use vue-i18n when installed; fall back to in-component defaults so the
// component remains testable / usable without an i18n plugin installed.
type Translator = (key: string, params?: Record<string, unknown>) => string;
const fallbackT: Translator = (key, params) => {
  if (key === 'list.autocompleteCreate') {
    const name = (params?.name as string | undefined) ?? '';
    return `+ Create "${name}"`;
  }
  if (key === 'list.autocompleteStar') return 'Frequent';
  if (key === 'list.addItemPlaceholder') return 'Add an item';
  return key;
};

let t: Translator;
try {
  const i18n = useI18n();
  t = ((key: string, params?: Record<string, unknown>) =>
    params ? i18n.t(key, params) : i18n.t(key)) as Translator;
} catch {
  t = fallbackT;
}

const DEBOUNCE_MS = 200;
const MAX_SUGGESTIONS = 6;
const STAR_TOP_N = 3;

const query = ref<string>('');
const debouncedQuery = useDebouncedRef(query, DEBOUNCE_MS);

const open = ref<boolean>(false);
const activeIndex = ref<number>(0);

const placeholderText = computed((): string =>
  props.placeholder || t('list.addItemPlaceholder'),
);

interface SuggestionItem {
  readonly key: string;
  readonly kind: 'existing' | 'new';
  readonly name: string;
  readonly category: Category;
  readonly star: boolean;
}

const starredNames = computed((): ReadonlySet<string> => {
  const top = rankByRecency(props.entries, Date.now()).slice(0, STAR_TOP_N);
  return new Set(top.map((e) => e.name));
});

const suggestions = computed((): readonly SuggestionItem[] => {
  const q = debouncedQuery.value.trim();
  if (q === '') return [];

  const needle = q.toLowerCase();
  const starred = starredNames.value;

  const matches = props.entries
    .filter((e) => e.name.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStar = starred.has(a.name) ? 0 : 1;
      const bStar = starred.has(b.name) ? 0 : 1;
      if (aStar !== bStar) return aStar - bStar;
      return a.name.localeCompare(b.name);
    });

  const items: SuggestionItem[] = matches
    .slice(0, MAX_SUGGESTIONS - 1)
    .map((e) => ({
      key: `existing:${e.id}`,
      kind: 'existing' as const,
      name: e.name,
      category: e.category,
      star: starred.has(e.name),
    }));

  const exactMatch = matches.some((e) => e.name.toLowerCase() === needle);
  if (!exactMatch) {
    items.push({
      key: `new:${q}`,
      kind: 'new',
      name: q,
      category: 'other',
      star: false,
    });
  }

  return items.slice(0, MAX_SUGGESTIONS);
});

const showDropdown = computed(
  (): boolean => open.value && suggestions.value.length > 0,
);

const optionId = (idx: number): string => `item-ac-opt-${idx}`;

const activeDescendant = computed((): string | undefined => {
  if (!showDropdown.value) return undefined;
  return optionId(activeIndex.value);
});

watch(query, (val) => {
  open.value = val.trim().length > 0;
  activeIndex.value = 0;
});

watch(suggestions, () => {
  if (activeIndex.value >= suggestions.value.length) {
    activeIndex.value = Math.max(0, suggestions.value.length - 1);
  }
});

const selectItem = (item: SuggestionItem): void => {
  emit('select', {
    kind: item.kind,
    name: item.name,
    category: item.category,
  } as SelectPayload);
  query.value = '';
  open.value = false;
  activeIndex.value = 0;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    open.value = false;
    return;
  }
  if (!showDropdown.value) return;

  const len = suggestions.value.length;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % len;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + len) % len;
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const picked = suggestions.value[activeIndex.value];
    if (picked) selectItem(picked);
  }
};
</script>

<template>
  <div
    class="ac"
    role="combobox"
    aria-haspopup="listbox"
    :aria-expanded="showDropdown"
    aria-owns="item-ac-listbox"
  >
    <Input
      v-model="query"
      :placeholder="placeholderText"
      :aria-controls="'item-ac-listbox'"
      :aria-activedescendant="activeDescendant"
      :aria-autocomplete="'list'"
      @keydown="onKeydown"
    >
      <template #iconLeft>
        <IconSearch :size="18" />
      </template>
    </Input>
    <ul
      v-if="showDropdown"
      id="item-ac-listbox"
      class="ac__list"
      role="listbox"
    >
      <li
        v-for="(s, idx) in suggestions"
        :id="optionId(idx)"
        :key="s.key"
        class="ac__option"
        role="option"
        :aria-selected="idx === activeIndex"
        :data-active="idx === activeIndex || undefined"
        :data-kind="s.kind"
        @click="selectItem(s)"
        @mouseenter="activeIndex = idx"
      >
        <span class="ac__lead" aria-hidden="true">
          <IconStar v-if="s.star" :size="14" />
          <IconPlus v-else-if="s.kind === 'new'" :size="14" />
          <CategoryIcon v-else :category="s.category" :size="14" />
        </span>
        <span class="ac__label">
          <template v-if="s.kind === 'new'">
            {{ t('list.autocompleteCreate', { name: s.name }) }}
          </template>
          <template v-else>{{ s.name }}</template>
        </span>
        <span v-if="s.star" class="ac__hint">
          {{ t('list.autocompleteStar') }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ac {
  position: relative;
  display: block;
}

.ac__list {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--space-1);
  list-style: none;
  background: var(--offwhite);
  border: 1px solid var(--cream-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-elev-1);
  z-index: 20;
  max-height: 320px;
  overflow-y: auto;
}

.ac__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--text-base);
  color: var(--charcoal);
  transition: background-color 100ms ease;
}

.ac__option[data-active] {
  background: var(--cream);
}

.ac__option[data-kind='new'] {
  font-style: italic;
  color: var(--ink-82);
}

.ac__lead {
  display: inline-flex;
  align-items: center;
  width: 18px;
  flex-shrink: 0;
  color: var(--ink-40);
}

.ac__option[data-kind='new'] .ac__lead {
  color: var(--charcoal);
}

.ac__label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ac__hint {
  font-size: var(--text-xs);
  color: var(--ink-40);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
</style>
