<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserNotFoundError } from '@/services/lists.service';
import type { UserProfile } from '@/domain/types';

const props = defineProps<{
  submitFn: (email: string) => Promise<UserProfile>;
}>();

const emit = defineEmits<{ added: [UserProfile] }>();

const { t } = useI18n();

const email = ref('');
const pending = ref(false);
const errorMessage = ref<string | null>(null);

const canSubmit = computed(() => email.value.trim().length > 0 && !pending.value);

const onInput = () => {
  if (errorMessage.value) errorMessage.value = null;
};

const onSubmit = async () => {
  const trimmed = email.value.trim();
  if (!trimmed || pending.value) return;
  pending.value = true;
  errorMessage.value = null;
  try {
    const profile = await props.submitFn(trimmed);
    emit('added', profile);
    email.value = '';
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      errorMessage.value = t('collaborators.notFound');
    } else {
      errorMessage.value = err instanceof Error ? err.message : String(err);
      console.error('[AddCollaboratorForm] submit failed:', err);
    }
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <form class="space-y-2" @submit.prevent="onSubmit">
    <div class="flex gap-2">
      <input
        v-model="email"
        type="email"
        autocomplete="email"
        spellcheck="false"
        :aria-label="t('collaborators.addPlaceholder')"
        :placeholder="t('collaborators.addPlaceholder')"
        class="flex-1 px-4 py-3 bg-offwhite border border-cream-soft rounded-xl
               text-sm text-charcoal placeholder-muted-gray
               focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        @input="onInput"
      />
      <button
        type="submit"
        :disabled="!canSubmit"
        class="px-4 py-3 bg-charcoal text-offwhite text-sm font-medium rounded-xl
               disabled:opacity-40"
      >
        {{ t('collaborators.submit') }}
      </button>
    </div>
    <p
      v-if="errorMessage"
      data-testid="add-collaborator-error"
      class="text-red-500 text-xs"
    >
      {{ errorMessage }}
    </p>
  </form>
</template>
