<script setup lang="ts">
import { computed, ref, useId, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { Star, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';
import FavoritesPanel from '@/components/list/FavoritesPanel.vue';
import type { ListFavoriteState } from '@/domain/types';

const props = defineProps<{
  open: boolean;
  entries: ListFavoriteState[];
  topSlugs: Set<string>;
  presenceKeys?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  cancel: [];
  'add-from-shelf': [ListFavoriteState];
  'exclude-tile': [ListFavoriteState];
}>();

const { t } = useI18n();
const titleId = useId();

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
const dialogRef = ref<HTMLElement | null>(null);
useFocusTrap(openRef, dialogRef);

const count = computed(() => props.entries.length);
const empty = computed(() => count.value === 0);
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="favorites-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 flex w-full max-w-md max-h-[min(80dvh,640px)] flex-col rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="mb-3 shrink-0">
        <h2
          :id="titleId"
          data-testid="favorites-sheet-title"
          class="inline-flex items-center gap-1.5 text-base font-semibold text-charcoal"
        >
          <Star :size="16" :stroke-width="2" fill="currentColor" class="text-favorite-gold" aria-hidden="true" />
          <span>{{ t('shelf.title', count, { count }) }}</span>
        </h2>
        <p v-if="empty" class="mt-2 text-xs text-muted-gray">
          {{ t('shelf.empty') }}
        </p>
      </div>

      <div
        v-if="!empty"
        data-testid="favorites-sheet-scroll"
        class="min-h-0 flex-1 overflow-y-auto -mx-1 px-1"
      >
        <FavoritesPanel
          :entries="entries"
          :top-slugs="topSlugs"
          :presence-keys="presenceKeys"
          @add-from-shelf="(entry) => emit('add-from-shelf', entry)"
          @exclude-tile="(entry) => emit('exclude-tile', entry)"
        />
      </div>

      <div class="mt-4 shrink-0">
        <button
          type="button"
          data-testid="favorites-close"
          class="w-full inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
