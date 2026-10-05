<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Star, Mic, ClipboardList } from '@lucide/vue';

defineProps<{
  showFavorites: boolean;
}>();

const emit = defineEmits<{
  'open-favorites': [];
  'open-voice': [];
  'open-bulk': [];
}>();

const { t } = useI18n();
const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

let detachOutside: (() => void) | null = null;

const close = (): void => {
  open.value = false;
};

const toggle = (): void => {
  open.value = !open.value;
};

const runAction = (action: () => void): void => {
  close();
  action();
};

watch(open, (isOpen) => {
  detachOutside?.();
  detachOutside = null;
  if (!isOpen) return;
  const onPointerDown = (e: PointerEvent): void => {
    if (rootRef.value?.contains(e.target as Node)) return;
    close();
  };
  requestAnimationFrame(() => {
    document.addEventListener('pointerdown', onPointerDown);
    detachOutside = () => document.removeEventListener('pointerdown', onPointerDown);
  });
});

onUnmounted(() => detachOutside?.());
</script>

<template>
  <div ref="rootRef" class="relative shrink-0">
    <div
      v-if="open"
      data-testid="footer-actions-menu"
      class="absolute bottom-full right-0 mb-1 flex flex-col items-center gap-0.5"
      role="menu"
    >
      <button
        v-if="showFavorites"
        type="button"
        role="menuitem"
        :aria-label="t('shelf.openButton')"
        data-testid="open-favorites"
        class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-cream text-favorite-gold shadow-sm border border-cream-soft transition-colors"
        @click="runAction(() => emit('open-favorites'))"
      >
        <Star :size="20" :stroke-width="2.5" fill="none" aria-hidden="true" />
      </button>
      <button
        type="button"
        role="menuitem"
        :aria-label="t('item.bulkPaste')"
        data-testid="open-bulk-paste"
        class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-cream text-charcoal shadow-sm border border-cream-soft transition-colors"
        @click="runAction(() => emit('open-bulk'))"
      >
        <ClipboardList :size="20" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <button
        type="button"
        role="menuitem"
        :aria-label="t('item.voiceAdd')"
        data-testid="open-voice-add"
        class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-cream text-charcoal shadow-sm border border-cream-soft transition-colors"
        @click="runAction(() => emit('open-voice'))"
      >
        <Mic :size="20" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </div>

    <button
      type="button"
      data-testid="footer-actions-toggle"
      :aria-expanded="open"
      :aria-haspopup="true"
      :aria-label="open ? t('item.hideActions') : t('item.showActions')"
      class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal transition-colors"
      @click="toggle"
    >
      <Plus
        :size="22"
        :stroke-width="2.25"
        :class="['transition-transform duration-200', open ? 'rotate-45' : 'rotate-0']"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
