<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2 } from '@lucide/vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const props = defineProps<{ count: number }>();
const emit = defineEmits<{ empty: [] }>();

const { t } = useI18n();
const modalOpen = ref(false);

const confirmMessage = computed(() =>
  t('emptyList.confirmMessage', { count: props.count }),
);

const onConfirm = (): void => {
  modalOpen.value = false;
  emit('empty');
};
</script>

<template>
  <template v-if="props.count > 0">
    <button
      data-testid="empty-list-button"
      type="button"
      :aria-label="t('emptyList.button')"
      class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full text-red-700 transition-colors"
      @click="modalOpen = true"
    >
      <Trash2 :size="20" :stroke-width="2.25" aria-hidden="true" />
    </button>

    <ConfirmModal
      :open="modalOpen"
      :title="t('emptyList.confirmTitle')"
      :message="confirmMessage"
      :confirm-label="t('emptyList.confirm')"
      :cancel-label="t('emptyList.cancel')"
      destructive
      @confirm="onConfirm"
      @cancel="modalOpen = false"
    />
  </template>
</template>
