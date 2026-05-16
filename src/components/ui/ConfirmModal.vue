<script setup lang="ts">
import { computed, useId } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
  }>(),
  { destructive: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const titleId = useId();

const confirmClasses = computed(() =>
  props.destructive
    ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
    : 'bg-charcoal text-offwhite hover:bg-black active:bg-black',
);
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-[100] flex items-center justify-center">
    <div
      data-testid="confirm-modal-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <h2 :id="titleId" class="text-lg font-semibold text-charcoal">{{ props.title }}</h2>
      <p class="mt-2 text-sm text-muted-gray">{{ props.message }}</p>
      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          data-testid="confirm-modal-cancel"
          type="button"
          class="rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          {{ props.cancelLabel }}
        </button>
        <button
          data-testid="confirm-modal-confirm"
          type="button"
          :class="[
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            confirmClasses,
          ]"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
