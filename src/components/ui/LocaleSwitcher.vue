<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/i18n';
import type { Locale } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    /** `compact`: flag chips (login). `segmented`: full-width radios like theme. */
    variant?: 'compact' | 'segmented';
  }>(),
  { variant: 'compact' },
);

const { t, locale } = useI18n();

const current = computed<Locale>(() => locale.value as Locale);

const choose = (next: Locale): void => {
  if (next === current.value) return;
  setLocale(next);
};

const segmentedBtnClass = (active: boolean): string =>
  [
    'flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-colors',
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-offwhite text-charcoal border-cream-soft',
  ].join(' ');
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="t('settings.language')"
    data-testid="locale-switcher"
    :class="props.variant === 'segmented' ? 'flex gap-2 w-full' : 'inline-flex items-center gap-1'"
  >
    <button
      type="button"
      role="radio"
      :aria-checked="current === 'it'"
      :aria-label="t('settings.language') + ': ' + t('settings.languageIt')"
      data-testid="locale-switcher-it"
      :class="
        props.variant === 'segmented'
          ? segmentedBtnClass(current === 'it')
          : [
              'inline-flex items-center justify-center w-11 h-11 rounded-full text-xl leading-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40',
              current === 'it'
                ? 'scale-110 opacity-100'
                : 'opacity-60 hover:opacity-100 active:opacity-100',
            ]
      "
      @click="choose('it')"
    >
      <span aria-hidden="true" class="text-base leading-none">🇮🇹</span>
      <span v-if="props.variant === 'segmented'">{{ t('settings.languageIt') }}</span>
    </button>
    <button
      type="button"
      role="radio"
      :aria-checked="current === 'en'"
      :aria-label="t('settings.language') + ': ' + t('settings.languageEn')"
      data-testid="locale-switcher-en"
      :class="
        props.variant === 'segmented'
          ? segmentedBtnClass(current === 'en')
          : [
              'inline-flex items-center justify-center w-11 h-11 rounded-full text-xl leading-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40',
              current === 'en'
                ? 'scale-110 opacity-100'
                : 'opacity-60 hover:opacity-100 active:opacity-100',
            ]
      "
      @click="choose('en')"
    >
      <span aria-hidden="true" class="text-base leading-none">🇬🇧</span>
      <span v-if="props.variant === 'segmented'">{{ t('settings.languageEn') }}</span>
    </button>
  </div>
</template>
