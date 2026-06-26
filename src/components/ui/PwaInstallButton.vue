<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download } from '@lucide/vue';
import { useInstallPrompt } from '@/pwa/installPrompt';
import Toast from '@/components/ui/Toast.vue';

const { t } = useI18n();
const { showInstallButton, canInstall, showIOSHint, promptInstall } = useInstallPrompt();

const iosHintOpen = ref(false);

const onInstall = async (): Promise<void> => {
  if (canInstall.value) {
    await promptInstall();
    return;
  }
  if (showIOSHint.value) {
    iosHintOpen.value = true;
  }
};
</script>

<template>
  <template v-if="showInstallButton">
    <button
      type="button"
      data-testid="pwa-install-button"
      :aria-label="t('pwa.installButton')"
      class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal transition-colors"
      @click="onInstall"
    >
      <Download :size="18" :stroke-width="2.25" aria-hidden="true" />
    </button>

    <Toast
      v-if="iosHintOpen"
      :open="true"
      :message="t('pwa.iosInstallHint')"
      :duration-ms="12000"
      @close="iosHintOpen = false"
    />
  </template>
</template>
