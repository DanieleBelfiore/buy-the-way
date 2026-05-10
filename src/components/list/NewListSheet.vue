<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'submit', name: string): void;
  (e: 'cancel'): void;
}>();

const name = ref('');

const handleSubmit = (): void => {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
  name.value = '';
};
</script>

<template>
  <div
    class="new-list-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="t('home.fab')"
  >
    <div
      class="new-list-sheet__backdrop"
      @click="emit('cancel')"
    />
    <div class="new-list-sheet__panel">
      <h2 class="new-list-sheet__title">
        {{ t('home.fab') }}
      </h2>
      <Input
        v-model="name"
        data-testid="new-list-input"
        :placeholder="t('home.fab')"
        @keydown.enter="handleSubmit"
        @keydown.escape="emit('cancel')"
      />
      <div class="new-list-sheet__actions">
        <Button
          variant="ghost"
          @click="emit('cancel')"
        >
          Annulla
        </Button>
        <Button
          variant="dark"
          :disabled="!name.trim()"
          @click="handleSubmit"
        >
          Crea
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-list-sheet {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
}

.new-list-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(28, 28, 28, 0.4);
}

.new-list-sheet__panel {
  position: relative;
  width: 100%;
  background: var(--cream);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-6) var(--space-5) var(--space-10);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.new-list-sheet__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.new-list-sheet__actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}
</style>
