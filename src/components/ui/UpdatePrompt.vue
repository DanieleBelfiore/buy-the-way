<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw } from '@lucide/vue';
import { useSW } from '@/pwa/registerSW';

const { t } = useI18n();
const { needRefresh, updateServiceWorker } = useSW();

const reloading = ref(false);

const onReload = async (): Promise<void> => {
  if (reloading.value) return;
  reloading.value = true;
  try {
    await updateServiceWorker(true);
  } finally {
    reloading.value = false;
  }
};
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-0 z-[250] flex items-center justify-center px-5"
    data-testid="update-required-overlay"
  >
    <div
      class="absolute inset-0 bg-black/50"
      aria-hidden="true"
    />
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      aria-describedby="update-required-message"
      data-testid="update-required-dialog"
      class="relative z-10 w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl"
    >
      <h2
        id="update-required-title"
        class="text-lg font-semibold text-charcoal"
      >
        {{ t('pwa.updateRequiredTitle') }}
      </h2>
      <p
        id="update-required-message"
        class="mt-2 text-sm text-muted-gray break-words"
      >
        {{ t('pwa.updateRequiredMessage') }}
      </p>
      <button
        type="button"
        data-testid="update-required-reload"
        :disabled="reloading"
        :aria-busy="reloading ? 'true' : undefined"
        class="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-80 disabled:cursor-wait hover:bg-primary/90 active:bg-primary/80"
        @click="onReload"
      >
        <RefreshCw
          :size="18"
          :stroke-width="2"
          :class="reloading ? 'animate-spin' : ''"
          aria-hidden="true"
        />
        {{ t('pwa.reload') }}
      </button>
    </div>
  </div>
</template>
