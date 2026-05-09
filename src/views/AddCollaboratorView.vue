<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useListsStore } from '@/stores/lists';
import type { ULID } from '@/domain/id';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const lists = useListsStore();

const listId = route.params.id as ULID;

interface FakeUser {
  email: string;
  uid: string;
  displayName: string;
}

const FAKE_DIRECTORY: FakeUser[] = [
  { email: 'alice@example.com', uid: 'uid-alice', displayName: 'Alice' },
  { email: 'bruno@example.com', uid: 'uid-bruno', displayName: 'Bruno' },
];

type LookupState = 'idle' | 'found' | 'not-found';

const emailInput = ref('');
const state = ref<LookupState>('idle');
const foundUser = ref<FakeUser | null>(null);

const handleLookup = (): void => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return;
  const match = FAKE_DIRECTORY.find((u) => u.email === email) ?? null;
  foundUser.value = match;
  state.value = match ? 'found' : 'not-found';
};

const handleAdd = async (): Promise<void> => {
  if (!foundUser.value) return;
  lists.addCollaborator(listId, foundUser.value.uid);
  await router.push('/');
};
</script>

<template>
  <div class="add-collab" data-view="AddCollaboratorView">
    <header class="add-collab__header appbar">
      <button class="iconbtn" @click="router.back()">←</button>
      <h1 class="add-collab__title">{{ t('addCollab.title') }}</h1>
    </header>

    <div class="add-collab__body">
      <Input
        v-model="emailInput"
        data-testid="email-input"
        :placeholder="t('addCollab.emailPlaceholder')"
        type="email"
        @keydown.enter="handleLookup"
      />

      <p class="add-collab__hint label">lookupHint: {{ t('addCollab.lookupHint') }}</p>

      <div v-if="state === 'found' && foundUser" class="add-collab__found-card" data-testid="found-card">
        <p class="add-collab__found-name">{{ foundUser.displayName }}</p>
        <p class="add-collab__found-email label">{{ foundUser.email }}</p>
      </div>

      <div v-if="state === 'not-found'" class="add-collab__not-found-card" data-testid="not-found-card">
        <p>{{ t('addCollab.notFound') }}</p>
      </div>

      <Button
        variant="dark"
        full
        data-testid="add-btn"
        :disabled="state !== 'found'"
        @click="handleAdd"
      >
        {{ t('addCollab.addBtn') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.add-collab {
  min-height: 100dvh;
  background: var(--cream);
  padding: var(--space-4) var(--space-5) var(--space-20);
}

.add-collab__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.add-collab__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.add-collab__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.add-collab__hint {
  color: var(--ink-40);
  margin: 0;
}

.add-collab__found-card {
  background: var(--offwhite);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.add-collab__found-name {
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.add-collab__found-email {
  color: var(--ink-40);
  margin: 0;
}

.add-collab__not-found-card {
  background: var(--charcoal);
  color: var(--cream);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.add-collab__not-found-card p {
  margin: 0;
}
</style>
