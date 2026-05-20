<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    message: string;
    open: boolean;
    durationMs?: number;
    actionLabel?: string;
  }>(),
  { durationMs: 2500 },
);

const emit = defineEmits<{ close: []; action: [] }>();

const visible = ref(props.open);
let timer: ReturnType<typeof setTimeout> | null = null;

const clear = (): void => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

watch(
  () => props.open,
  (open) => {
    clear();
    visible.value = open;
    if (open && !props.actionLabel) {
      timer = setTimeout(() => {
        visible.value = false;
        emit('close');
      }, props.durationMs);
    }
  },
  { immediate: true },
);

const onAction = (): void => {
  emit('action');
};
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      role="status"
      aria-live="polite"
      data-testid="toast"
      :class="[
        'fixed left-1/2 bottom-24 z-[200] -translate-x-1/2',
        'w-[calc(100vw-2rem)] max-w-md',
        'flex items-center justify-between gap-3',
        'bg-charcoal text-offwhite shadow-xl',
        props.actionLabel
          ? 'rounded-2xl px-4 py-3'
          : 'rounded-full px-4 py-2',
      ]"
    >
      <span class="text-sm font-medium leading-snug min-w-0 flex-1">{{ props.message }}</span>
      <button
        v-if="props.actionLabel"
        type="button"
        data-testid="toast-action"
        class="shrink-0 rounded-full bg-offwhite px-4 py-2 text-sm font-semibold text-charcoal hover:opacity-90 active:opacity-80 transition-opacity"
        @click="onAction"
      >
        {{ props.actionLabel }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
