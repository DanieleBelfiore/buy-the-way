<script setup lang="ts">
import { ref, watch, type Component } from 'vue';
import { Info, Loader2 } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    message: string;
    open: boolean;
    durationMs?: number;
    actionLabel?: string;
    actionIcon?: Component;
    actionLoading?: boolean;
  }>(),
  { durationMs: 2500, actionLoading: false },
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
  if (props.actionLoading) return;
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
        // would otherwise overflow the viewport. Half-rem gutter on each
        // side keeps the toast off the screen edge without sacrificing the
        // single-line layout for medium-length messages on narrow phones.
        'w-fit max-w-[calc(100vw-1rem)]',
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
        :disabled="props.actionLoading || undefined"
        :aria-busy="props.actionLoading ? 'true' : undefined"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-offwhite px-4 py-2 text-sm font-semibold text-primary transition-opacity',
          props.actionLoading
            ? 'opacity-80 cursor-wait'
            : 'hover:opacity-90 active:opacity-80',
        ]"
        @click="onAction"
      >
        <Loader2
          v-if="props.actionLoading"
          data-testid="toast-action-spinner"
          :size="16"
          :stroke-width="2.5"
          class="animate-spin"
          aria-hidden="true"
        />
        <component
          v-else-if="props.actionIcon"
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
