<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import { TOOLTIP_SURFACE_CLASS } from '@/components/ui/tooltip-surface';

const props = defineProps<{
  label: string;
}>();

const VIEWPORT_PAD = 12;
const GAP = 8;

const tooltipId = useId();
const rootRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const open = ref(false);
const tooltipStyle = ref<{ top: string; left: string; transform: string }>({
  top: '0px',
  left: '0px',
  transform: 'translate(-50%, -100%)',
});

const updatePosition = (): void => {
  const trigger = rootRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const tooltip = tooltipRef.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.min(256, vw - VIEWPORT_PAD * 2);
  const ttW = tooltip?.offsetWidth ?? maxWidth;
  const ttH = tooltip?.offsetHeight ?? 32;

  let left = rect.left + rect.width / 2;
  let top = rect.top - GAP;
  let transform = 'translate(-50%, -100%)';

  if (top - ttH < VIEWPORT_PAD) {
    top = rect.bottom + GAP;
    transform = 'translate(-50%, 0)';
  }

  left = Math.max(VIEWPORT_PAD + ttW / 2, Math.min(left, vw - VIEWPORT_PAD - ttW / 2));
  if (transform === 'translate(-50%, -100%)') {
    top = Math.max(VIEWPORT_PAD + ttH, Math.min(top, vh - VIEWPORT_PAD));
  } else {
    top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD - ttH));
  }

  tooltipStyle.value = { left: `${left}px`, top: `${top}px`, transform };
};

const show = async (): Promise<void> => {
  await nextTick();
  updatePosition();
  await nextTick();
  updatePosition();
};

const onEnter = (): void => {
  open.value = true;
  void show();
};

const onLeave = (e: FocusEvent | MouseEvent): void => {
  const root = rootRef.value;
  const related = 'relatedTarget' in e ? (e.relatedTarget as Node | null) : null;
  if (root && related && root.contains(related)) return;
  open.value = false;
};

const onScrollOrResize = (): void => {
  if (!open.value) return;
  updatePosition();
};

watch(open, (visible) => {
  if (visible) void show();
});

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
});
</script>

<template>
  <span
    ref="rootRef"
    class="relative inline-flex shrink-0"
    data-testid="icon-tooltip"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="icon-tooltip">
        <span
          v-if="open"
          :id="tooltipId"
          ref="tooltipRef"
          role="tooltip"
          data-testid="icon-tooltip-label"
          :style="tooltipStyle"
          :class="[TOOLTIP_SURFACE_CLASS, 'whitespace-nowrap']"
        >
          {{ props.label }}
        </span>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.icon-tooltip-enter-active,
.icon-tooltip-leave-active {
  transition: opacity 150ms ease;
}
.icon-tooltip-enter-from,
.icon-tooltip-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .icon-tooltip-enter-active,
  .icon-tooltip-leave-active {
    transition: none;
  }
}
</style>
