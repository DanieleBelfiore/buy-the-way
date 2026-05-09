<script setup lang="ts">
import { computed } from 'vue';
import type { Category } from '@/domain/types';
import CategoryIcon from '@/components/ui/CategoryIcon.vue';
import IconCheck from '@/components/ui/icons/IconCheck.vue';

interface Props {
  name: string;
  quantity?: string;
  checked: boolean;
  category: Category;
}

const props = withDefaults(defineProps<Props>(), {
  quantity: '',
});

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

const dataChecked = computed((): string => (props.checked ? 'true' : 'false'));

const onActivate = (): void => {
  emit('toggle');
};

const onKey = (event: KeyboardEvent): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('toggle');
  }
};
</script>

<template>
  <div
    class="item"
    :data-checked="dataChecked"
    role="button"
    tabindex="0"
    :aria-pressed="props.checked"
    @click="onActivate"
    @keydown="onKey"
  >
    <span
      class="item__check"
      :data-state="props.checked ? 'checked' : 'unchecked'"
      aria-hidden="true"
    >
      <IconCheck v-if="props.checked" :size="14" />
    </span>
    <CategoryIcon :category="props.category" :size="18" />
    <span class="item__name">{{ props.name }}</span>
    <span v-if="props.quantity" class="item__qty">{{ props.quantity }}</span>
  </div>
</template>

<style scoped>
.item {
  cursor: pointer;
  user-select: none;
}
.item:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.item__check {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--ink-40);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 150ms ease, border-color 150ms ease;
  color: var(--offwhite);
}
.item__check[data-state='checked'] {
  background: var(--charcoal);
  border-color: var(--charcoal);
}

.item__name {
  flex: 1 1 auto;
  font-size: var(--text-base);
}

.item__qty {
  color: var(--muted-gray);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
