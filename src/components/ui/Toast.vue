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
      class="fixed left-1/2 bottom-24 z-[200] -translate-x-1/2 flex items-center gap-3 rounded-full bg-charcoal px-4 py-2 text-sm font-medium text-offwhite shadow-lg"
    >
      <span>{{ props.message }}</span>
      <button
        v-if="props.actionLabel"
        type="button"
        data-testid="toast-action"
        class="rounded-full bg-offwhite px-3 py-1 text-xs font-semibold text-charcoal hover:opacity-90"
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
