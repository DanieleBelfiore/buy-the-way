<script setup lang="ts">
import { ref, useId, toRef, type Component } from 'vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    leftLabel: string;
    rightLabel: string;
    leftIcon: Component;
    rightIcon: Component;
    rightDisabled?: boolean;
  }>(),
  { rightDisabled: false },
);

const emit = defineEmits<{ left: []; right: []; cancel: [] }>();

const titleId = useId();

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
const dialogRef = ref<HTMLElement | null>(null);
useFocusTrap(openRef, dialogRef);
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-[120] flex items-center justify-center">
    <div
      data-testid="dual-choice-modal-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <h2 :id="titleId" class="text-lg font-semibold text-charcoal">{{ props.title }}</h2>
      <p class="mt-2 text-sm text-muted-gray whitespace-pre-line">{{ props.message }}</p>
      <div class="mt-5 flex flex-row items-center gap-2 w-full">
        <button
          data-testid="dual-choice-modal-left"
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('left')"
        >
          <component
            :is="props.leftIcon"
            :size="16"
            :stroke-width="2"
            aria-hidden="true"
          />
          {{ props.leftLabel }}
        </button>
        <button
          data-testid="dual-choice-modal-right"
          type="button"
          :disabled="props.rightDisabled"
          :class="[
            'flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            props.rightDisabled
              ? 'bg-primary/40 text-white cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
          ]"
          @click="emit('right')"
        >
          <component
            :is="props.rightIcon"
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
          {{ props.rightLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
