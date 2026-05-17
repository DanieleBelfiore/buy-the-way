<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    message: string;
    open: boolean;
    durationMs?: number;
  }>(),
  { durationMs: 2500 },
);

const emit = defineEmits<{ close: [] }>();

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
    if (open) {
      timer = setTimeout(() => {
        visible.value = false;
        emit('close');
      }, props.durationMs);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      role="status"
      aria-live="polite"
      data-testid="toast"
      class="fixed left-1/2 bottom-24 z-[200] -translate-x-1/2 rounded-full bg-charcoal px-4 py-2 text-sm font-medium text-offwhite shadow-lg"
    >
      {{ props.message }}
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
