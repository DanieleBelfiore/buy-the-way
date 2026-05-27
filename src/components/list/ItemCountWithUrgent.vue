<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Flame } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    count: number;
    urgentCount?: number;
    /** Lighter text on wallpaper cards. */
    muted?: boolean;
  }>(),
  { urgentCount: 0, muted: false },
);

const { t } = useI18n();

const showUrgent = computed(() => props.urgentCount > 0);

const urgentWord = computed(() =>
  props.urgentCount === 1
    ? t('list.urgentInlineWordOne')
    : t('list.urgentInlineWordMany'),
);

const urgentAria = computed(() =>
  props.urgentCount === 1
    ? t('list.urgentInlineOne')
    : t('list.urgentInlineMany', { u: props.urgentCount }),
);

const textClass = computed(() =>
  props.muted ? 'text-white' : 'text-muted-gray',
);

const emphasisClass = computed(() =>
  props.muted
    ? 'font-semibold text-white tabular-nums'
    : 'font-semibold text-charcoal tabular-nums',
);

const iconClass = computed(() =>
  props.muted ? 'text-white' : 'text-charcoal',
);
</script>

<template>
  <span
    data-testid="item-count"
    class="inline leading-normal"
    :class="textClass"
  >
    {{ t('listSettings.stats.items') }}:
    <span :class="emphasisClass">{{ count }}</span>

    <template v-if="showUrgent">
      &#32;-&#32;<span
        data-testid="urgent-inline"
        class="inline whitespace-nowrap"
        :aria-label="urgentAria"
      ><span
        class="inline-grid h-[1em] w-[0.75em] shrink-0 place-items-center align-middle relative -top-px mr-0.5"
        aria-hidden="true"
      ><Flame
        :size="12"
        :stroke-width="2.5"
        :class="iconClass"
        class="block"
      /></span><span :class="emphasisClass">{{ urgentCount }}</span> {{ urgentWord }}</span>
    </template>
  </span>
</template>
