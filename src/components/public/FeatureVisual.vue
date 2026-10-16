<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, RefreshCw, WifiOff, Clock } from '@lucide/vue';

// Small product vignettes for the landing feature rows. Decorative: the row
// heading and body carry the meaning, so the whole visual is hidden from AT.

const props = defineProps<{ kind: 'sync' | 'offline' | 'ai' }>();

const { t, tm } = useI18n();

const aiItems = computed<string[]>(() => {
  const raw = tm('home.features.ai.items') as unknown;
  return Array.isArray(raw) ? (raw as string[]) : [];
});
</script>

<template>
  <div
    aria-hidden="true"
    class="relative flex min-h-[18rem] select-none items-center justify-center overflow-hidden
           rounded-[2rem] bg-cream-soft px-4 py-10 sm:min-h-[20rem] sm:px-6"
  >
    <!-- Two phones, same list, same tick. -->
    <div v-if="props.kind === 'sync'" class="flex items-center gap-2 sm:gap-5">
      <div
        v-for="(device, idx) in [t('home.features.sync.deviceA'), t('home.features.sync.deviceB')]"
        :key="idx"
        :class="[
          'w-[8.5rem] rounded-2xl bg-offwhite p-3.5 shadow-lift ring-1 ring-charcoal/[0.06] sm:w-44 lg:w-52',
          idx === 0 ? '-rotate-3' : 'rotate-2',
        ]"
      >
        <p class="pb-2.5 text-xs text-muted-gray">{{ device }}</p>
        <div class="flex items-center gap-2.5 py-1.5">
          <span
            class="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-white"
          >
            <Check :size="11" :stroke-width="3" />
          </span>
          <span class="text-sm font-medium text-muted-gray line-through">
            {{ t('home.features.sync.item') }}
          </span>
        </div>
        <div class="flex items-center gap-2.5 py-1.5">
          <span class="h-4.5 w-4.5 rounded-full border border-muted-gray/50" />
          <span class="text-sm font-medium">{{ t('home.features.sync.other') }}</span>
        </div>
      </div>
      <span
        class="absolute left-1/2 top-1/2 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2
               items-center justify-center rounded-full bg-primary text-white shadow-lift"
      >
        <RefreshCw :size="18" :stroke-width="2.25" />
      </span>
    </div>

    <!-- A list that keeps working with no network. -->
    <div
      v-else-if="props.kind === 'offline'"
      class="w-full max-w-[17rem] overflow-hidden lg:max-w-[20rem] rounded-2xl bg-offwhite shadow-lift
             ring-1 ring-charcoal/[0.06]"
    >
      <div class="flex items-center gap-2 bg-charcoal px-3.5 py-2 text-xs font-medium text-cream">
        <WifiOff :size="14" :stroke-width="2.25" />
        <span class="truncate">{{ t('home.features.offline.banner') }}</span>
      </div>
      <div class="px-3.5 py-2.5">
        <div class="flex items-center gap-2.5 py-1.5">
          <span
            class="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-white"
          >
            <Check :size="11" :stroke-width="3" />
          </span>
          <span class="text-sm font-medium text-muted-gray line-through">
            {{ t('home.mock.items.bread') }}
          </span>
        </div>
        <div class="flex items-center gap-2.5 py-1.5">
          <span class="h-4.5 w-4.5 rounded-full border border-muted-gray/50" />
          <span class="text-sm font-medium">{{ t('home.mock.items.mozzarella') }}</span>
        </div>
        <div class="flex items-center gap-2.5 py-1.5">
          <span class="h-4.5 w-4.5 rounded-full border border-muted-gray/50" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium">
            {{ t('home.mock.items.lemons') }}
          </span>
          <span class="inline-flex shrink-0 items-center gap-1 text-xs text-muted-gray">
            <Clock :size="12" :stroke-width="2.25" />
            {{ t('home.features.offline.pending') }}
          </span>
        </div>
      </div>
    </div>

    <!-- A request to the assistant, answered with list items. -->
    <div v-else class="flex w-full max-w-[19rem] flex-col gap-3 lg:max-w-[22rem]">
      <p
        class="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm
               leading-snug text-white shadow-lift"
      >
        {{ t('home.features.ai.prompt') }}
      </p>
      <div class="rounded-2xl rounded-bl-md bg-offwhite p-4 shadow-lift ring-1 ring-charcoal/[0.06]">
        <p class="pb-3 text-sm font-medium">{{ t('home.features.ai.reply') }}</p>
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="item in aiItems"
            :key="item"
            class="rounded-lg bg-cream-soft px-2.5 py-1 text-xs font-medium"
          >
            {{ item }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
