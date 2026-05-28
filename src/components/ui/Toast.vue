<script setup lang="ts">
import { ref, watch, type Component } from 'vue';
import { Info, X } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    message: string;
    open: boolean;
    durationMs?: number;
    actionLabel?: string;
    actionIcon?: Component;
    actionLoading?: boolean;
    /** Accessible label for the dismiss (X) control. */
    dismissLabel?: string;
    /**
     * Show an X control that dismisses immediately (emits `close`).
     */
    dismissible?: boolean;
    /**
     * Swipe left or right on the toast to dismiss early (emits `close`).
     */
    swipeable?: boolean;
    /**
     * When true, the auto-dismiss timer runs even if `actionLabel` is set.
     * Default false preserves the existing behavior of persistent action
     * toasts (e.g. the PWA update prompt).
     */
    autoDismissWithAction?: boolean;
  }>(),
  {
    durationMs: 2500,
    actionLoading: false,
    dismissible: false,
    swipeable: false,
    autoDismissWithAction: false,
    dismissLabel: 'Dismiss',
  },
);

const emit = defineEmits<{ close: []; action: [] }>();

const visible = ref(props.open);
const progressKey = ref(0);
const showProgress = ref(false);
const dragOffsetX = ref(0);
let timer: ReturnType<typeof setTimeout> | null = null;

const SWIPE_DISMISS_PX = 56;
let swipeActive = false;
let swipeStartX = 0;

const clear = (): void => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

const dismiss = (): void => {
  clear();
  dragOffsetX.value = 0;
  visible.value = false;
  emit('close');
};

const shouldAutoDismiss = (): boolean =>
  props.open && (!props.actionLabel || props.autoDismissWithAction);

const armTimer = (): void => {
  clear();
  visible.value = props.open;
  dragOffsetX.value = 0;
  const autoDismiss = shouldAutoDismiss();
  showProgress.value = autoDismiss;
  if (!autoDismiss) return;
  progressKey.value += 1;
  timer = setTimeout(dismiss, props.durationMs);
};

watch(
  () => [props.open, props.message, props.durationMs, props.autoDismissWithAction, props.actionLabel] as const,
  armTimer,
  { immediate: true },
);

const onAction = (): void => {
  if (props.actionLoading) return;
  emit('action');
};

const onDismissClick = (): void => {
  dismiss();
};

const onSwipeStart = (e: PointerEvent): void => {
  if (!props.swipeable || props.actionLoading) return;
  swipeActive = true;
  swipeStartX = e.clientX;
  dragOffsetX.value = 0;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* jsdom / older browsers */
  }
};

const onSwipeMove = (e: PointerEvent): void => {
  if (!swipeActive) return;
  dragOffsetX.value = e.clientX - swipeStartX;
};

const onSwipeEnd = (): void => {
  if (!swipeActive) return;
  swipeActive = false;
  if (Math.abs(dragOffsetX.value) >= SWIPE_DISMISS_PX) {
    dismiss();
    return;
  }
  dragOffsetX.value = 0;
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
        'w-[min(calc(100vw-2rem),28rem)]',
        'flex gap-3 touch-none select-none',
        props.actionLabel ? 'flex-col' : 'items-center',
        'text-white shadow-xl bg-primary',
        props.actionLabel
          ? 'rounded-2xl px-4 py-3'
          : 'rounded-full px-4 py-2',
        'overflow-hidden',
        props.swipeable ? 'cursor-grab active:cursor-grabbing' : '',
      ]"
      :style="dragOffsetX !== 0 ? { transform: `translate(calc(-50% + ${dragOffsetX}px), 0)` } : undefined"
      @pointerdown="onSwipeStart"
      @pointermove="onSwipeMove"
      @pointerup="onSwipeEnd"
      @pointercancel="onSwipeEnd"
    >
      <div class="flex items-start gap-3 w-full">
        <Info
          :size="18"
          :stroke-width="2.25"
          class="shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <span class="font-medium leading-snug flex-1 min-w-0 break-words text-[clamp(11px,3.5vw,14px)]">
          {{ props.message }}
        </span>
        <button
          v-if="props.dismissible"
          type="button"
          data-testid="toast-dismiss"
          :aria-label="props.dismissLabel"
          class="shrink-0 inline-flex items-center justify-center w-8 h-8 -mr-1 -mt-0.5 rounded-full text-white/90 hover:bg-white/15 active:bg-white/25 transition-colors"
          @click.stop="onDismissClick"
          @pointerdown.stop
        >
          <X :size="16" :stroke-width="2.5" aria-hidden="true" />
        </button>
      </div>
      <button
        v-if="props.actionLabel"
        type="button"
        data-testid="toast-action"
        :disabled="props.actionLoading || undefined"
        :aria-busy="props.actionLoading ? 'true' : undefined"
        :class="[
          'self-center shrink-0 inline-flex items-center gap-1.5 rounded-full bg-offwhite px-4 py-2 text-sm font-semibold text-primary transition-opacity',
          props.actionLoading
            ? 'opacity-80 cursor-wait'
            : 'hover:opacity-90 active:opacity-80',
        ]"
        @click="onAction"
        @pointerdown.stop
      >
        <span
          v-if="props.actionIcon"
          data-testid="toast-action-icon-wrapper"
          :class="['inline-flex shrink-0', props.actionLoading ? 'animate-spin' : '']"
        >
          <component
            :is="props.actionIcon"
            data-testid="toast-action-icon"
            :size="16"
            :stroke-width="2.5"
            aria-hidden="true"
          />
        </span>
        {{ props.actionLabel }}
      </button>
      <div
        v-if="showProgress"
        :key="progressKey"
        data-testid="toast-progress"
        class="toast__progress"
        :style="{ animationDuration: props.durationMs + 'ms' }"
      />
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
.toast__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: inherit;
  transform-origin: left;
  animation: toast-shrink linear forwards;
}
@keyframes toast-shrink {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .toast__progress {
    animation: none;
  }
}
</style>
