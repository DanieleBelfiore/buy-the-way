<script setup lang="ts">
import { computed } from 'vue';
import CategoryHeader from './CategoryHeader.vue';
import ListItemRow from './ListItemRow.vue';
import type { Category, Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const props = withDefaults(
  defineProps<{
    category: Category;
    items: Item[];
    collapsed?: boolean;
    canMoveCopy?: boolean;
    pinnedNames?: ReadonlySet<string>;
  }>(),
  { collapsed: false, canMoveCopy: true, pinnedNames: () => new Set<string>() },
);
const emit = defineEmits<{
  'toggle-checked': [id: ULID, checked: boolean];
  'remove-item': [id: ULID];
  'toggle-collapse': [category: Category];
  'long-press': [item: Item];
  'request-priority': [item: Item];
  'move-copy': [item: Item];
  'toggle-pinned': [item: Item];
}>();

const bought = computed(() => props.items.filter((i) => i.checked).length);
const total = computed(() => props.items.length);

const beforeEnter = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = '0px';
  node.style.opacity = '0';
};
const onEnter = (el: Element, done: () => void): void => {
  const node = el as HTMLElement;
  requestAnimationFrame(() => {
    node.style.height = `${node.scrollHeight}px`;
    node.style.opacity = '1';
  });
  node.addEventListener('transitionend', done, { once: true });
};
const afterEnter = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = '';
  node.style.opacity = '';
};
const beforeLeave = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = `${node.scrollHeight}px`;
  node.style.opacity = '1';
};
const onLeave = (el: Element, done: () => void): void => {
  const node = el as HTMLElement;
  requestAnimationFrame(() => {
    node.style.height = '0px';
    node.style.opacity = '0';
  });
  node.addEventListener('transitionend', done, { once: true });
};
</script>

<template>
  <section>
    <CategoryHeader
      :category="props.category"
      :bought="bought"
      :total="total"
      :collapsed="props.collapsed"
      interactive
      @toggle="emit('toggle-collapse', props.category)"
    />
    <Transition
      name="cat-collapse"
      @before-enter="beforeEnter"
      @enter="onEnter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="onLeave"
    >
      <TransitionGroup v-if="!props.collapsed" name="item-row" tag="div" class="cat-collapse-inner">
        <ListItemRow
          v-for="item in props.items"
          :key="item.id"
          :item="item"
          :can-move-copy="props.canMoveCopy"
          :pinned="props.pinnedNames.has(item.name)"
          @toggle-checked="(val) => emit('toggle-checked', item.id, val)"
          @remove="emit('remove-item', item.id)"
          @long-press="(it) => emit('long-press', it)"
          @request-priority="(it) => emit('request-priority', it)"
          @move-copy="(it) => emit('move-copy', it)"
          @toggle-pinned="(it) => emit('toggle-pinned', it)"
        />
      </TransitionGroup>
    </Transition>
  </section>
</template>

<style scoped>
.cat-collapse-inner {
  overflow: hidden;
  transition: height 240ms ease, opacity 200ms ease;
}
.item-row-enter-active,
.item-row-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.item-row-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}
.item-row-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
.item-row-leave-from,
.item-row-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.item-row-move {
  transition: transform 200ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .cat-collapse-inner,
  .item-row-enter-active,
  .item-row-leave-active,
  .item-row-move {
    transition: none;
  }
  .item-row-enter-from,
  .item-row-leave-to {
    transform: none;
  }
}
</style>
