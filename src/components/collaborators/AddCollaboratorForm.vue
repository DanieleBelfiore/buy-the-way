<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserPlus } from '@lucide/vue';
import AlertMessage from '@/components/ui/AlertMessage.vue';
import type { AddCollaboratorResult } from '@/services/lists.service';
import { FindUserError } from '@/services/users.service';
import type { UserProfile } from '@/domain/types';

const props = defineProps<{
  submitFn: (email: string) => Promise<AddCollaboratorResult>;
}>();

const emit = defineEmits<{
  added: [UserProfile];
  /** Fired when the invited email isn't registered yet — host can show a share-the-app prompt. */
  pending: [string];
}>();

const { t } = useI18n();

const email = ref('');
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const canSubmit = computed(() => email.value.trim().length > 0 && !submitting.value);

const onInput = () => {
  if (errorMessage.value) errorMessage.value = null;
};

const onSubmit = async () => {
  const trimmed = email.value.trim();
  if (!trimmed || submitting.value) return;
  submitting.value = true;
  errorMessage.value = null;
  try {
    const result = await props.submitFn(trimmed);
    if (result.pending) {
      emit('pending', result.email);
    } else if (result.profile) {
      emit('added', result.profile);
    }
    email.value = '';
  } catch (err) {
    if (err instanceof FindUserError && (err.code === 'transport' || err.code === 'http')) {
      errorMessage.value = t('collaborators.lookupFailed');
    } else {
      errorMessage.value = err instanceof Error ? err.message : String(err);
    }
    console.error('[AddCollaboratorForm] submit failed:', err);
  } finally {
    submitting.value = false;
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
        class="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl
               hover:bg-primary-hover active:bg-primary-active disabled:opacity-40 min-w-[110px]"
      >
        <UserPlus :size="16" :stroke-width="2" aria-hidden="true" />
        {{ t('collaborators.submit') }}
      </button>
    </div>
    <AlertMessage
      v-if="errorMessage"
      data-testid="add-collaborator-error"
      :message="errorMessage"
    />
  </form>
</template>
