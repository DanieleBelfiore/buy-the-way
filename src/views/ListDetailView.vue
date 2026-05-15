<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useListsStore } from '@/stores/lists';

const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();

const list = computed(() =>
  listsStore.lists.find((l) => l.id === route.params.id),
);
</script>

<template>
  <main class="min-h-screen bg-cream">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.back()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate">
        {{ list?.name ?? '…' }}
      </h1>
    </header>
  </main>
</template>
