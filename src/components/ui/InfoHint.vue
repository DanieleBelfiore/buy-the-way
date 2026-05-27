<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import { TOOLTIP_SURFACE_CLASS } from '@/components/ui/tooltip-surface';

const props = defineProps<{
  message: string;
  testId?: string;
}>();

const VIEWPORT_PAD = 12;
const GAP = 8;

const tooltipId = useId();
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const hoverOpen = ref(false);
const pinnedOpen = ref(false);
const tooltipStyle = ref<{ top: string; left: string; transform: string }>({
  top: '0px',
  left: '0px',
  transform: 'translateY(-50%)',
});

const visible = computed(() => hoverOpen.value || pinnedOpen.value);

const updatePosition = (): void => {
  const trigger = triggerRef.value;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const tooltip = tooltipRef.value;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.min(256, vw - VIEWPORT_PAD * 2);
  const ttW = tooltip?.offsetWidth ?? maxWidth;
  const ttH = tooltip?.offsetHeight ?? 40;

  const spaceRight = vw - VIEWPORT_PAD - rect.right - GAP;
  const spaceLeft = rect.left - GAP - VIEWPORT_PAD;

  let left: number;
  let transform: string;

  // Prefer opening to the right of the icon; flip left only when necessary.
  if (spaceRight >= ttW || spaceRight >= spaceLeft) {
    left = rect.right + GAP;
    transform = 'translateY(-50%)';
    if (left + ttW > vw - VIEWPORT_PAD) {
      left = vw - VIEWPORT_PAD - ttW;
    }
    left = Math.max(VIEWPORT_PAD, left);
  } else {
    left = rect.left - GAP;
    transform = 'translate(-100%, -50%)';
    if (left - ttW < VIEWPORT_PAD) {
      left = VIEWPORT_PAD + ttW;
    }
  }

  let top = rect.top + rect.height / 2;
  top = Math.max(VIEWPORT_PAD + ttH / 2, Math.min(top, vh - VIEWPORT_PAD - ttH / 2));

  tooltipStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    transform,
  };
};

const show = async (): Promise<void> => {
  await nextTick();
  updatePosition();
  await nextTick();
  updatePosition();
};

const onEnter = (): void => {
  hoverOpen.value = true;
  void show();
};

const onLeave = (): void => {
  hoverOpen.value = false;
};

const onToggle = (e: MouseEvent): void => {
  e.stopPropagation();
  e.preventDefault();
  pinnedOpen.value = !pinnedOpen.value;
  if (pinnedOpen.value) void show();
};

const onDocPointerDown = (e: PointerEvent): void => {
  if (!pinnedOpen.value) return;
  const root = rootRef.value;
  if (root && !root.contains(e.target as Node)) pinnedOpen.value = false;
};

const onScrollOrResize = (): void => {
  if (!visible.value) return;
  updatePosition();
};

watch(visible, (open) => {
  if (open) void show();
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
});
</script>

<template>
  <span
    ref="rootRef"
    class="relative inline-flex shrink-0 items-center"
    :data-testid="props.testId"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <button
      ref="triggerRef"
      type="button"
      class="inline-flex items-center justify-center rounded-full p-0.5 cursor-help text-inherit"
      :aria-label="props.message"
      :aria-describedby="visible ? tooltipId : undefined"
      data-testid="info-hint-trigger"
      @click="onToggle"
      @pointerdown.stop
    >
      <slot />
    </button>

    <Teleport to="body">
      <span
        v-if="visible"
        :id="tooltipId"
        ref="tooltipRef"
        role="tooltip"
        data-testid="info-hint-tooltip"
        :style="tooltipStyle"
        :class="[TOOLTIP_SURFACE_CLASS, 'text-left']"
      >
        {{ props.message }}
      </span>
    </Teleport>
  </span>
</template>
