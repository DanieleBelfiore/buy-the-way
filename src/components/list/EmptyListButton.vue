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
      class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-offwhite hover:bg-red-700 active:bg-red-800 transition-colors"
      @click="modalOpen = true"
    >
      <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
      <span>{{ t('emptyList.button') }}</span>
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
