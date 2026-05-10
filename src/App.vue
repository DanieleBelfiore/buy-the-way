<script setup lang="ts">
import { watch } from 'vue';
import Toast from '@/components/ui/Toast.vue';
import { useAuthStore } from '@/stores/auth';
import { useListsStore } from '@/stores/lists';
import { useCatalogStore } from '@/stores/catalog';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

if (!USE_FIXTURES) {
  const auth = useAuthStore();
  const lists = useListsStore();
  const catalog = useCatalogStore();

  let unsubLists: (() => void) | null = null;
  let unsubCatalog: (() => void) | null = null;

  watch(
    () => auth.currentUser,
    (user) => {
      unsubLists?.();
      unsubCatalog?.();
      unsubLists = null;
      unsubCatalog = null;
      if (user) {
        unsubLists = lists.subscribe(user.uid);
        unsubCatalog = catalog.subscribe(user.uid);
      }
    },
    { immediate: true },
  );
}
</script>

<template>
  <router-view />
  <Toast />
</template>
