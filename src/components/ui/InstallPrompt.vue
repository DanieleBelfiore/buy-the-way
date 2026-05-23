<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download } from '@lucide/vue';
import { useInstallPrompt } from '@/pwa/installPrompt';
import Toast from '@/components/ui/Toast.vue';

const { t } = useI18n();
const {
  canInstall,
  showIOSHint,
  isInstalled,
  isMobile,
  dismissed,
  promptInstall,
  dismiss,
} = useInstallPrompt();

const showChromiumPrompt = computed(
  () => isMobile.value && !isInstalled.value && !dismissed.value && canInstall.value,
);
const showIOSPrompt = computed(
  () => isMobile.value && !isInstalled.value && !dismissed.value && showIOSHint.value,
);

const onInstall = async (): Promise<void> => {
  const outcome = await promptInstall();
  if (outcome !== 'unavailable') dismiss();
};

const onClose = (): void => {
  dismiss();
};
</script>

<template>
  <Toast
    v-if="showChromiumPrompt"
    :open="true"
    :message="t('pwa.installMessage')"
    :action-label="t('pwa.install')"
    :action-icon="Download"
    :duration-ms="10000"
    auto-dismiss-with-action
    @action="onInstall"
    @close="onClose"
  />
  <Toast
    v-else-if="showIOSPrompt"
    :open="true"
    :message="t('pwa.iosInstallHint')"
    :duration-ms="10000"
    @close="onClose"
  />
</template>
