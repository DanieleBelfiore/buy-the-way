<script setup lang="ts">
import { AlertCircle } from '@lucide/vue';

withDefaults(
  defineProps<{
    message: string;
    variant?: 'error' | 'info' | 'success';
  }>(),
  { variant: 'error' },
);

const variantClasses: Record<'error' | 'info' | 'success', string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-green-50 text-green-700 border-green-200',
};
</script>

<template>
  <Transition name="alert-fade">
    <div
      v-if="message"
      role="alert"
      :class="[
        'inline-flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        variantClasses[variant],
      ]"
    >
      <AlertCircle :size="16" :stroke-width="2" aria-hidden="true" class="shrink-0 mt-0.5" />
      <span class="leading-snug">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .alert-fade-enter-active,
  .alert-fade-leave-active {
    transition: none;
  }
  .alert-fade-enter-from,
  .alert-fade-leave-to {
    transform: none;
  }
}
</style>
