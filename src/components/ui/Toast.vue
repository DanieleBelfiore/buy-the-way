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
    actionLoading?: boolean;
    /**
     * When true, the auto-dismiss timer runs even if `actionLabel` is set.
     * Default false preserves the existing behavior of persistent action
     * toasts (e.g. the PWA update prompt).
     */
    autoDismissWithAction?: boolean;
  }>(),
  { durationMs: 2500, actionLoading: false, autoDismissWithAction: false },
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
    const autoDismiss = open && (!props.actionLabel || props.autoDismissWithAction);
    if (autoDismiss) {
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
        // Hug the content's natural width up to a viewport-capped maximum.
        // Critically: no `flex-1` / `min-w-0` on the message span. With
        // `w-fit`, a `flex-1` child with `basis: 0` would contribute zero
        // to the container's intrinsic width — the container would shrink
        // to icon+button width, then the flex-grow distributes 0px, and
        // the message wraps to a tiny vertical strip. Dropping flex-1
        // makes the container measure the message's natural single-line
        // width, so short/medium messages stay on one line and only
        // genuinely long ones wrap when the max-w cap kicks in.
        'w-fit max-w-[calc(100vw-0.5rem)]',
        'flex items-center gap-3',
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
      <span class="text-sm font-medium leading-snug">{{ props.message }}</span>
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
        <component
          v-if="props.actionIcon"
          :is="props.actionIcon"
          data-testid="toast-action-icon"
          :size="16"
          :stroke-width="2.5"
          :class="props.actionLoading ? 'animate-spin' : ''"
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
