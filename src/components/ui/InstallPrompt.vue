<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download } from '@lucide/vue';
import { useInstallPrompt } from '@/pwa/installPrompt';
import Toast from '@/components/ui/Toast.vue';

const { t } = useI18n();
const { canInstall, showIOSHint, isInstalled, dismissed, promptInstall, dismiss } =
  useInstallPrompt();

const showChromiumPrompt = computed(
  () => !isInstalled.value && !dismissed.value && canInstall.value,
);
const showIOSPrompt = computed(
  () => !isInstalled.value && !dismissed.value && showIOSHint.value,
);

const onInstall = async (): Promise<void> => {
  const outcome = await promptInstall();
  // Both 'accepted' and 'dismissed' should clear the toast — the user has
  // made a choice and 'beforeinstallprompt' will not refire in this session.
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
    @action="onInstall"
    @close="onClose"
  />
  <Toast
    v-else-if="showIOSPrompt"
    :open="true"
    :message="t('pwa.iosInstallHint')"
    :duration-ms="8000"
    @close="onClose"
  />
</template>
