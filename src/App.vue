<script setup lang="ts">
import OfflineBanner from '@/components/ui/OfflineBanner.vue';
import UpdatePrompt from '@/components/ui/UpdatePrompt.vue';
</script>

<template>
  <OfflineBanner />
  <router-view v-slot="{ Component }">
    <Transition name="view-fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </router-view>
  <UpdatePrompt />
</template>

<style>
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.view-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.view-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .view-fade-enter-active,
  .view-fade-leave-active {
    transition: none;
  }
  .view-fade-enter-from,
  .view-fade-leave-to {
    transform: none;
  }
}
</style>
