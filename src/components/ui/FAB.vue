<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Plus } from '@lucide/vue';

const { t } = useI18n();
const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    class="fixed bottom-6 right-6 w-14 h-14 bg-primary text-offwhite
           rounded-full shadow-lg hover:bg-primary-hover active:bg-primary-active
           flex items-center justify-center
           active:scale-90 transition-transform"
    :aria-label="t('list.new')"
    @click="emit('click')"
  >
    <Plus :size="24" :stroke-width="2" aria-hidden="true" />
  </button>
</template>
