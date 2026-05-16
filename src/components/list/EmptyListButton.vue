<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const props = defineProps<{ count: number }>();
const emit = defineEmits<{ empty: [] }>();

const { t } = useI18n();
const modalOpen = ref(false);

const confirmMessage = computed(() =>
  t('emptyList.confirmMessage', { count: props.count }),
);

const onConfirm = () => {
  modalOpen.value = false;
  emit('empty');
};
</script>

<template>
  <div v-if="props.count > 0" class="px-5 py-3">
    <button
      data-testid="empty-list-button"
      type="button"
      :aria-label="t('emptyList.button')"
      class="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
      @click="modalOpen = true"
    >
      <span>{{ t('emptyList.button') }}</span>
      <span class="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        {{ props.count }}
      </span>
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
  </div>
</template>
