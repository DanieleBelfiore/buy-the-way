<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import { useReducedMotion } from '@/composables/useReducedMotion';

const props = defineProps<{
  triggerKey: number;
}>();

const reduced = useReducedMotion();
const visible = ref(false);
const playKey = ref(0);

let _timer: ReturnType<typeof setTimeout> | null = null;
const FALLBACK_MS = 3500;

const close = (): void => {
  visible.value = false;
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
};

const onComplete = (): void => {
  close();
};

watch(
  () => props.triggerKey,
  (next, prev) => {
    if (next <= 0 || next === prev) return;
    if (reduced.value) return;
    playKey.value += 1;
    visible.value = true;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => {
      visible.value = false;
      _timer = null;
    }, FALLBACK_MS);
  },
);

onUnmounted(() => {
  if (_timer) clearTimeout(_timer);
});
</script>

<template>
  <div
    v-if="visible"
    data-testid="celebration-overlay"
    aria-hidden="true"
    class="celebration-overlay"
  >
    <DotLottieVue
      :key="playKey"
      data-testid="celebration-lottie"
      class="celebration-lottie"
      src="/animations/success.lottie"
      :autoplay="true"
      :loop="false"
      @complete="onComplete"
    />
  </div>
</template>

<style scoped>
.celebration-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.celebration-lottie {
  width: min(80vw, 360px);
  height: auto;
  aspect-ratio: 1 / 1;
}

@media (prefers-reduced-motion: reduce) {
  .celebration-overlay { display: none; }
}
</style>
