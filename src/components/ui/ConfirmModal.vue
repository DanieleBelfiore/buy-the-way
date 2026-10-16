<script setup lang="ts">
import { computed, ref, useId, toRef } from 'vue';
import { Check, Trash2, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
    /**
     * Cancel is the recommended choice (e.g. "keep suggesting"): it becomes
     * the primary blue button and moves to the end, where the main action
     * usually sits. Moved in the DOM, not with CSS, so tab order matches.
     */
    preferCancel?: boolean;
  }>(),
  { destructive: false, preferCancel: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const titleId = useId();

const confirmClasses = computed(() =>
  props.destructive
    ? 'bg-danger text-white hover:bg-danger-hover active:bg-danger-active'
    : 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
);

const cancelClasses = computed(() =>
  props.preferCancel
    ? 'font-medium bg-primary text-white hover:bg-primary-hover active:bg-primary-active transition active:scale-[0.98] motion-reduce:active:scale-100'
    : 'text-charcoal hover:bg-black/5 active:bg-black/10',
);

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
const dialogRef = ref<HTMLElement | null>(null);
useFocusTrap(openRef, dialogRef);
</script>

<template>
  <div v-if="props.open" class="fixed inset-0 z-modal flex items-center justify-center">
    <div
      data-testid="confirm-modal-backdrop"
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
      <!-- flex-wrap: when both labels do not fit side by side (long Italian
           labels at 375 px), the last button drops to its own full-width row
           instead of overflowing the dialog. -->
      <div class="mt-5 flex flex-row flex-wrap items-center gap-2 w-full">
        <button
          v-if="!props.preferCancel"
          data-testid="confirm-modal-cancel"
          type="button"
          :class="['flex-1 basis-auto whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm', cancelClasses]"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ props.cancelLabel }}
        </button>
        <button
          data-testid="confirm-modal-confirm"
          type="button"
          :class="[
            'flex-1 basis-auto whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition active:scale-[0.98] motion-reduce:active:scale-100',
            confirmClasses,
          ]"
          @click="emit('confirm')"
        >
          <component
            :is="props.destructive ? Trash2 : Check"
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
          {{ props.confirmLabel }}
        </button>
        <button
          v-if="props.preferCancel"
          data-testid="confirm-modal-cancel"
          type="button"
          :class="['flex-1 basis-auto whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm', cancelClasses]"
          @click="emit('cancel')"
        >
          <!-- Check, not X: on a filled blue button an X reads as "close /
               no", while here cancel is the recommended "yes, keep it". -->
          <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ props.cancelLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
