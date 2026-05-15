import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createList as serviceCreateList, subscribeUserLists } from '@/services/lists.service';
import { useAuthStore } from '@/stores/auth';
import type { List } from '@/domain/types';

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const subscribe = (): (() => void) => {
    const auth = useAuthStore();
    loading.value = true;
    return subscribeUserLists(
      auth.user!.uid,
      (incoming) => {
        lists.value = incoming;
        loading.value = false;
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
  };

  const createList = async (name: string): Promise<string> => {
    const auth = useAuthStore();
    if (!auth.user) throw new Error('Not authenticated');
    return serviceCreateList(name, auth.user.uid);
  };

  return { lists, loading, error, subscribe, createList };
});
