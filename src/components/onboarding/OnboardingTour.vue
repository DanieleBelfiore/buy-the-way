<script setup lang="ts">
import { ref, computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { ListChecks, Sparkles, ShoppingCart, X, ChevronRight, ChevronLeft } from '@lucide/vue';

/**
 * First-run onboarding tour. Renders a 3-step modal overlay.
 *
 * Lifecycle is owned by the parent (ListsView): the parent decides whether
 * to render it (based on `authStore.profile?.onboardingSeen`) and listens
 * to the `done` event to persist the seen flag.
 */
const emit = defineEmits<{
  done: [];
}>();

const { t } = useI18n();
const titleId = useId();

interface Step {
  key: 'step1' | 'step2' | 'step3';
  icon: typeof ListChecks;
}

const STEPS: Step[] = [
  { key: 'step1', icon: ListChecks },
  { key: 'step2', icon: Sparkles },
  { key: 'step3', icon: ShoppingCart },
];

const index = ref(0);
const current = computed(() => STEPS[index.value]!);
const isFirst = computed(() => index.value === 0);
const isLast = computed(() => index.value === STEPS.length - 1);

const next = (): void => {
  if (isLast.value) {
    emit('done');
    return;
  }
  index.value += 1;
};

const back = (): void => {
  if (isFirst.value) return;
  index.value -= 1;
};

const skip = (): void => emit('done');
</script>

<template>
  <div
    data-testid="onboarding-tour"
    class="fixed inset-0 z-[200] flex items-center justify-center"
  >
    <div
      data-testid="onboarding-backdrop"
      class="absolute inset-0 bg-black/60"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl"
      @keydown.esc="skip"
    >
      <!-- Skip top-right -->
      <button
        type="button"
        data-testid="onboarding-skip"
        :aria-label="t('onboarding.skip')"
        class="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-gray"
        @click="skip"
      >
        <X :size="18" :stroke-width="2" aria-hidden="true" />
      </button>

      <!-- Step icon -->
      <div class="mx-auto mb-4 mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <component
          :is="current.icon"
          :size="32"
          :stroke-width="1.75"
          class="text-primary"
          aria-hidden="true"
        />
      </div>

      <!-- Step copy -->
      <h2
        :id="titleId"
        data-testid="onboarding-title"
        class="text-center text-lg font-semibold text-charcoal"
      >
        {{ t(`onboarding.${current.key}.title`) }}
      </h2>
      <p
        data-testid="onboarding-body"
        class="mt-2 text-center text-sm text-muted-gray"
      >
        {{ t(`onboarding.${current.key}.body`) }}
      </p>

      <!-- Step dots -->
      <div class="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
        <span
          v-for="(_, i) in STEPS"
          :key="i"
          :class="[
            'h-2 rounded-full transition-all',
            i === index ? 'w-6 bg-primary' : 'w-2 bg-charcoal/20',
          ]"
        />
      </div>

      <!-- Controls -->
      <div class="mt-5 flex flex-row items-center gap-2">
        <button
          v-if="!isFirst"
          type="button"
          data-testid="onboarding-back"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="back"
        >
          <ChevronLeft :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('onboarding.back') }}
        </button>
        <button
          type="button"
          data-testid="onboarding-next"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active"
          @click="next"
        >
          {{ isLast ? t('onboarding.done') : t('onboarding.next') }}
          <ChevronRight v-if="!isLast" :size="16" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
