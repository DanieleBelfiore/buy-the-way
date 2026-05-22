<script setup lang="ts">
import { ref, watch, type Component } from 'vue';
import { Info } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    message: string;
    open: boolean;
    durationMs?: number;
    actionLabel?: string;
    actionIcon?: Component;
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
        // Hug the content's intrinsic width; only wrap when the message
        // would otherwise overflow the viewport (minus a 1rem gutter).
        'w-fit max-w-[calc(100vw-2rem)]',
        'flex items-center justify-between gap-3',
        'text-white shadow-xl bg-primary',
        props.actionLabel
          ? 'rounded-2xl px-4 py-3'
          : 'rounded-full px-4 py-2',
      ]"
    >
      <Info
        :size="18"
        :stroke-width="2.25"
        class="shrink-0"
        aria-hidden="true"
      />
      <!-- No flex-1 / min-w-0 on the simple variant: we want the toast to
           hug the message width (single line if it fits) and only wrap when
           max-w-[calc(100vw-2rem)] caps the container. With actionLabel the
           button needs the span to grow, so we keep flex behaviour there. -->
      <span
        :class="[
          'text-sm font-medium leading-snug',
          props.actionLabel ? 'min-w-0 flex-1' : '',
        ]"
      >{{ props.message }}</span>
      <button
        v-if="props.actionLabel"
        type="button"
        data-testid="toast-action"
        class="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-offwhite px-4 py-2 text-sm font-semibold text-primary hover:opacity-90 active:opacity-80 transition-opacity"
        @click="onAction"
      >
        <component
          v-if="props.actionIcon"
          :is="props.actionIcon"
          :size="16"
          :stroke-width="2.5"
          aria-hidden="true"
        />
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
