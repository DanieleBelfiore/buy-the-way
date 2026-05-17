<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

const handleOnline = (): void => {
  online.value = true;
};
const handleOffline = (): void => {
  online.value = false;
};

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});
</script>

<template>
  <Transition name="banner">
    <div
      v-if="!online"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      class="fixed inset-x-0 top-0 z-[150] bg-charcoal px-4 py-2 text-center text-sm font-medium text-offwhite shadow-md"
    >
      {{ t('offline.banner') }}
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: transform 200ms ease, opacity 200ms ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
