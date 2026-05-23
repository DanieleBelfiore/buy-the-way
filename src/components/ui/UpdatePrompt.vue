<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw } from '@lucide/vue';
import { useSW } from '@/pwa/registerSW';
import Toast from '@/components/ui/Toast.vue';

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
  <Toast
    :open="needRefresh"
    :message="t('pwa.updateAvailable')"
    :action-label="t('pwa.reload')"
    :action-icon="RefreshCw"
    :action-loading="reloading"
    @action="onReload"
  />
</template>
