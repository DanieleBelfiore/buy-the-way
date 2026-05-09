<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useOnline } from '@/composables/useOnline';

const { isOnline } = useOnline();
const { t } = useI18n();
</script>

<template>
  <div
    v-if="!isOnline"
    class="banner-offline"
    role="status"
    aria-live="polite"
  >
    {{ t('list.offlineBanner') }}
  </div>
</template>
