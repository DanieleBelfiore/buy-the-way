<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    class="fixed bottom-6 right-6 w-14 h-14 bg-charcoal text-offwhite
           rounded-full shadow-lg
           flex items-center justify-center
           active:scale-90 transition-transform"
    :aria-label="t('list.new')"
    @click="emit('click')"
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
