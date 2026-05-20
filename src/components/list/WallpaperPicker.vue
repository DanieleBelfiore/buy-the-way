<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { WALLPAPERS, wallpaperUrl, type Wallpaper } from '@/domain/wallpapers';

const props = defineProps<{
  current?: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  select: [Wallpaper];
}>();

const { t } = useI18n();

const onSelect = (w: Wallpaper): void => {
  if (props.busy) return;
  if (props.current === w) return;
  emit('select', w);
};
</script>

<template>
  <div
    data-testid="wallpaper-picker"
    class="flex flex-wrap gap-2 pb-2"
  >
    <button
      v-for="w in WALLPAPERS"
      :key="w"
      type="button"
      :data-testid="`wallpaper-option-${w}`"
      :aria-label="t('listSettings.wallpaperOptionAria', { name: w })"
      :aria-pressed="current === w"
      :disabled="busy"
      :class="[
        'relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors',
        current === w ? 'border-charcoal' : 'border-cream-soft hover:border-charcoal/40',
        busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      ]"
      @click="onSelect(w)"
    >
      <img
        :src="wallpaperUrl(w)"
        :alt="''"
        loading="lazy"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <span
        v-if="current === w"
        aria-hidden="true"
        class="absolute inset-0 ring-2 ring-offwhite ring-inset"
      />
    </button>
  </div>
</template>
