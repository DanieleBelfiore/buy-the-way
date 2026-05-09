<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import type { ULID } from '@/domain/id';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const lists = useListsStore();
const auth = useAuthStore();

const listId = route.params.id as ULID;
const list = computed(() => lists.getById(listId));
const isOwner = computed(() => list.value?.ownerUid === auth.currentUser?.uid);

const nameInput = ref(list.value?.name ?? '');

const handleRename = (): void => {
  const trimmed = nameInput.value.trim();
  if (trimmed && trimmed !== list.value?.name) {
    lists.rename(listId, trimmed);
  }
};

const handleArchive = async (): Promise<void> => {
  lists.softDelete(listId);
  await router.push('/');
};

const handleLeave = async (): Promise<void> => {
  if (auth.currentUser) {
    lists.leave(listId, auth.currentUser.uid);
    await router.push('/');
  }
};
</script>

<template>
  <div class="list-settings" data-view="ListSettingsView">
    <header class="list-settings__header appbar">
      <button class="iconbtn" @click="router.back()">←</button>
      <h1 class="list-settings__title">{{ t('listSettings.rename') }}</h1>
    </header>

    <div class="list-settings__body">
      <section v-if="isOwner" class="list-settings__section">
        <Input
          v-model="nameInput"
          data-testid="rename-input"
          @blur="handleRename"
          @keydown.enter="handleRename"
        />
      </section>

      <section v-else class="list-settings__section">
        <p class="list-settings__name">{{ list?.name }}</p>
      </section>

      <section class="list-settings__actions">
        <Button
          v-if="isOwner"
          variant="ghost"
          data-testid="archive-btn"
          @click="handleArchive"
        >
          {{ t('listSettings.archive') }}
        </Button>

        <Button
          v-if="!isOwner"
          variant="ghost"
          data-testid="leave-btn"
          @click="handleLeave"
        >
          {{ t('listSettings.leave') }}
        </Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.list-settings {
  min-height: 100dvh;
  background: var(--cream);
  padding: var(--space-4) var(--space-5) var(--space-20);
}

.list-settings__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.list-settings__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.list-settings__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.list-settings__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.list-settings__name {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.list-settings__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
