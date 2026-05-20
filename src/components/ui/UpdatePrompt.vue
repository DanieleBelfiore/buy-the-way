<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RefreshCw } from '@lucide/vue';
import { useSW } from '@/pwa/registerSW';
import Toast from '@/components/ui/Toast.vue';

const { t } = useI18n();
const { needRefresh, updateServiceWorker } = useSW();

const onReload = async (): Promise<void> => {
  await updateServiceWorker(true);
};
</script>

<template>
  <Toast
    :open="needRefresh"
    :message="t('pwa.updateAvailable')"
    :action-label="t('pwa.reload')"
    :action-icon="RefreshCw"
    @action="onReload"
  />
</template>
