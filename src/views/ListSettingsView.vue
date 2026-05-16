<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import {
  addCollaborator,
  removeCollaborator,
  leaveList,
  renameList,
  deleteList,
} from '@/services/lists.service';
import { getUsersByUids } from '@/services/users.service';
import AddCollaboratorForm from '@/components/collaborators/AddCollaboratorForm.vue';
import CollaboratorList from '@/components/collaborators/CollaboratorList.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import type { ULID } from '@/domain/id';
import type { UserProfile } from '@/domain/types';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();
const authStore = useAuthStore();

const listId = computed(() => route.params.id as ULID);
const list = computed(() => listsStore.lists.find((l) => l.id === listId.value));

const selfUid = computed(() => authStore.user?.uid ?? '');
const isOwner = computed(() => list.value?.ownerUid === selfUid.value);

const nameDraft = ref('');
const renaming = ref(false);
const renameError = ref<string | null>(null);

const members = ref<UserProfile[]>([]);
const membersLoading = ref(false);

const deleteOpen = ref(false);
const actionError = ref<string | null>(null);

let listsUnsub: (() => void) | null = null;

const loadMembers = async (uids: readonly string[]) => {
  membersLoading.value = true;
  try {
    members.value = await getUsersByUids(uids);
  } catch (err) {
    console.error('[ListSettingsView] loadMembers failed:', err);
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
};

watch(
  () => list.value?.collaboratorUids,
  (uids) => {
    if (uids) void loadMembers(uids);
  },
);

watch(
  () => list.value?.name,
  (n) => {
    if (n !== undefined && nameDraft.value === '') nameDraft.value = n;
  },
);

onMounted(() => {
  listsUnsub = listsStore.subscribe();
  if (list.value) {
    nameDraft.value = list.value.name;
    void loadMembers(list.value.collaboratorUids);
  }
});

onUnmounted(() => {
  listsUnsub?.();
});

const handleRename = async () => {
  if (!isOwner.value) return;
  const trimmed = nameDraft.value.trim();
  if (!trimmed || trimmed === list.value?.name) return;
  renaming.value = true;
  renameError.value = null;
  try {
    await renameList(listId.value, trimmed);
  } catch (err) {
    renameError.value = err instanceof Error ? err.message : String(err);
  } finally {
    renaming.value = false;
  }
};

const handleAddCollaborator = async (email: string): Promise<UserProfile> => {
  const profile = await addCollaborator(listId.value, email);
  await loadMembers([...(list.value?.collaboratorUids ?? []), profile.uid]);
  return profile;
};

const handleRemove = async (uid: string) => {
  actionError.value = null;
  try {
    await removeCollaborator(listId.value, uid);
    members.value = members.value.filter((m) => m.uid !== uid);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

const handleLeave = async () => {
  actionError.value = null;
  try {
    await leaveList(listId.value, selfUid.value);
    await router.push({ name: 'lists' });
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

const handleDelete = async () => {
  deleteOpen.value = false;
  actionError.value = null;
  try {
    await deleteList(listId.value);
    await router.push({ name: 'lists' });
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};
</script>

<template>
  <main class="min-h-screen bg-cream pb-24">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.back()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate">
        {{ t('listSettings.title') }}
      </h1>
    </header>

    <div v-if="!list" class="px-5 py-12 text-center">
      <p class="text-sm text-muted-gray">{{ t('error.listNotFound') }}</p>
    </div>

    <div v-else class="px-5 space-y-6">
      <section v-if="isOwner" data-testid="rename-section" class="space-y-2">
        <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium">
          {{ t('listSettings.rename') }}
        </label>
        <div class="flex gap-2">
          <input
            v-model="nameDraft"
            :placeholder="t('listSettings.renamePlaceholder')"
            :aria-label="t('listSettings.renamePlaceholder')"
            class="flex-1 px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            @keydown.enter="handleRename"
          />
          <button
            data-testid="rename-save"
            type="button"
            :disabled="renaming || !nameDraft.trim() || nameDraft.trim() === list.name"
            class="px-4 py-3 bg-charcoal text-offwhite text-sm font-medium rounded-xl disabled:opacity-40"
            @click="handleRename"
          >
            {{ t('listSettings.save') }}
          </button>
        </div>
        <p v-if="renameError" class="text-red-500 text-xs">{{ renameError }}</p>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs uppercase tracking-wide text-muted-gray font-medium">
          {{ t('listSettings.members') }}
        </h2>
        <CollaboratorList
          :members="members"
          :owner-uid="list.ownerUid"
          :self-uid="selfUid"
          @remove="handleRemove"
          @leave="handleLeave"
        />
        <AddCollaboratorForm v-if="isOwner" :submit-fn="handleAddCollaborator" />
        <p v-if="actionError" class="text-red-500 text-xs">{{ actionError }}</p>
      </section>

      <section
        v-if="isOwner"
        data-testid="delete-section"
        class="pt-4 border-t border-cream-soft"
      >
        <button
          data-testid="delete-list"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
          @click="deleteOpen = true"
        >
          {{ t('listSettings.deleteList') }}
        </button>
      </section>

      <ConfirmModal
        v-if="list"
        :open="deleteOpen"
        :title="t('listSettings.deleteConfirmTitle')"
        :message="t('listSettings.deleteConfirmMessage', { name: list.name })"
        :confirm-label="t('listSettings.confirmDelete')"
        :cancel-label="t('listSettings.cancel')"
        destructive
        @confirm="handleDelete"
        @cancel="deleteOpen = false"
      />
    </div>
  </main>
</template>
