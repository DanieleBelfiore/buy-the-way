<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/i18n';
import type { Locale } from '@/domain/types';

const { t, locale } = useI18n();

const current = computed<Locale>(() => locale.value as Locale);

const choose = (next: Locale): void => {
  if (next === current.value) return;
  setLocale(next);
};
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="t('settings.language')"
    data-testid="locale-switcher"
    class="inline-flex items-center gap-1"
  >
    <button
      type="button"
      role="radio"
      :aria-checked="current === 'it'"
      :aria-label="t('settings.language') + ': Italiano'"
      data-testid="locale-switcher-it"
      :class="[
        'inline-flex items-center justify-center w-9 h-9 rounded-full text-xl leading-none transition-all',
        current === 'it'
          ? 'ring-2 ring-primary scale-110'
          : 'opacity-60 hover:opacity-100 active:opacity-100',
      ]"
      @click="choose('it')"
    >
      <span aria-hidden="true">🇮🇹</span>
    </button>
    <button
      type="button"
      role="radio"
      :aria-checked="current === 'en'"
      :aria-label="t('settings.language') + ': English'"
      data-testid="locale-switcher-en"
      :class="[
        'inline-flex items-center justify-center w-9 h-9 rounded-full text-xl leading-none transition-all',
        current === 'en'
          ? 'ring-2 ring-primary scale-110'
          : 'opacity-60 hover:opacity-100 active:opacity-100',
      ]"
      @click="choose('en')"
    >
      <span aria-hidden="true">🇬🇧</span>
    </button>
  </div>
</template>
