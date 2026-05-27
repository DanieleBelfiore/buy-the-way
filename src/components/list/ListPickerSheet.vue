<script setup lang="ts">
import { useId, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowRightLeft, Copy, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import type { List } from '@/domain/types';
import type { ULID } from '@/domain/id';

const props = defineProps<{
  open: boolean;
  item: { name: string } | null;
  lists: readonly List[];
  busy?: boolean;
  errorMessage?: string | null;
}>();

const emit = defineEmits<{
  copy: [ULID];
  move: [ULID];
  cancel: [];
}>();

const { t } = useI18n();
const titleId = useId();

const onCopy = (id: ULID): void => emit('copy', id);
const onMove = (id: ULID): void => emit('move', id);

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="list-picker-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      class="relative z-10 w-full sm:max-w-md mx-5 rounded-2xl bg-cream p-5 shadow-xl max-h-[80vh] overflow-y-auto"
      @keydown.esc="emit('cancel')"
    >
      <div class="flex items-center justify-between mb-3">
        <h2 :id="titleId" class="inline-flex items-center gap-2 text-base font-semibold text-charcoal">
          <ArrowRightLeft :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.moveOrCopy') }}
        </h2>
        <button
          data-testid="list-picker-cancel"
          type="button"
          :aria-label="t('list.cancel')"
          class="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-gray"
          @click="emit('cancel')"
        >
          <X :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>

      <p v-if="props.item" class="text-xs text-muted-gray mb-3">{{ props.item.name }}</p>

      <div
        v-if="props.errorMessage"
        data-testid="list-picker-error"
        role="alert"
        class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
      >
        {{ props.errorMessage }}
      </div>

      <div
        v-if="props.lists.length === 0"
        data-testid="list-picker-empty"
        class="text-sm text-muted-gray py-6 text-center"
      >
        {{ t('item.noOtherLists') }}
      </div>

      <ul v-else class="space-y-2">
        <li
          v-for="l in props.lists"
          :key="l.id"
          :data-testid="`list-picker-row-${l.id}`"
          class="flex items-center gap-2 bg-offwhite border border-cream-soft rounded-xl px-3 py-2"
        >
          <span class="flex-1 text-sm font-medium text-charcoal truncate">{{ l.name }}</span>
          <button
            :data-testid="`list-picker-copy-${l.id}`"
            type="button"
            :disabled="props.busy"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream-soft text-charcoal text-xs font-medium hover:bg-cream-soft/80 disabled:opacity-40"
            @click="onCopy(l.id)"
          >
            <Copy :size="14" :stroke-width="2" aria-hidden="true" />
            {{ t('item.copy') }}
          </button>
          <button
            :data-testid="`list-picker-move-${l.id}`"
            type="button"
            :disabled="props.busy"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-40"
            @click="onMove(l.id)"
          >
            <ArrowRightLeft :size="14" :stroke-width="2" aria-hidden="true" />
            {{ t('item.move') }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
