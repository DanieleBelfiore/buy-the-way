<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, ListX } from '@lucide/vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import DualChoiceModal from '@/components/ui/DualChoiceModal.vue';

export type EmptyListScope = 'all' | 'checked';

const props = defineProps<{ count: number; boughtCount: number }>();
const emit = defineEmits<{ empty: [scope: EmptyListScope] }>();

const { t } = useI18n();
const choiceModalOpen = ref(false);
const completionModalOpen = ref(false);

const allBought = computed(
  () => props.count > 0 && props.boughtCount === props.count,
);

const onButtonClick = (): void => {
  if (allBought.value) {
    completionModalOpen.value = true;
    return;
  }
  choiceModalOpen.value = true;
};

const onChooseAll = (): void => {
  choiceModalOpen.value = false;
  emit('empty', 'all');
};

const onChooseBought = (): void => {
  if (props.boughtCount === 0) return;
  choiceModalOpen.value = false;
  emit('empty', 'checked');
};

const onCompletionConfirm = (): void => {
  completionModalOpen.value = false;
  emit('empty', 'all');
};
</script>

<template>
  <template v-if="props.count > 0">
    <button
      data-testid="empty-list-button"
      type="button"
      :aria-label="t('emptyList.button')"
      class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full text-red-700 transition-colors"
      @click="onButtonClick"
    >
      <ListX :size="20" :stroke-width="2.25" aria-hidden="true" />
    </button>

    <DualChoiceModal
      :open="choiceModalOpen"
      :title="t('emptyList.confirmTitle')"
      :message="t('emptyList.confirmMessage')"
      :left-label="t('emptyList.confirmAll')"
      :right-label="t('emptyList.confirmBought')"
      :left-icon="ListX"
      :right-icon="Check"
      :right-disabled="props.boughtCount === 0"
      @left="onChooseAll"
      @right="onChooseBought"
      @cancel="choiceModalOpen = false"
    />

    <ConfirmModal
      :open="completionModalOpen"
      :title="t('list.completionEmptyTitle')"
      :message="t('list.completionEmptyMessage')"
      :confirm-label="t('list.completionEmptyConfirm')"
      :cancel-label="t('list.completionEmptyCancel')"
      destructive
      @confirm="onCompletionConfirm"
      @cancel="completionModalOpen = false"
    />
  </template>
</template>
