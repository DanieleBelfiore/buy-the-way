<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check } from '@lucide/vue';
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

// A static picture of a shared list for the landing hero, drawn with the same
// row anatomy as ListItemRow so it reads as the real product. Decorative:
// the hero copy already says what it shows, so it is hidden from AT.

interface MockItem {
  key: string;
  icon: string;
  quantity?: string;
  checked?: boolean;
  fresh?: boolean;
}

interface MockGroup {
  category: Category;
  items: MockItem[];
}

const GROUPS: readonly MockGroup[] = [
  {
    category: 'fruit_vegetables',
    items: [
      { key: 'tomatoes', icon: '🍅', quantity: '500 g', checked: true },
      { key: 'lemons', icon: '🍋', quantity: '4' },
      { key: 'basil', icon: '🌿', fresh: true },
    ],
  },
  {
    category: 'dairy',
    items: [
      { key: 'mozzarella', icon: '🧀', quantity: '2' },
      { key: 'yogurt', icon: '🥛', checked: true },
    ],
  },
  {
    category: 'bakery',
    items: [{ key: 'bread', icon: '🍞' }],
  },
];

const isE2E = import.meta.env['VITE_E2E'] === 'true';

const { t } = useI18n();

const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
const bought = GROUPS.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);

// Row index across groups drives the entry stagger.
const rows = computed(() => {
  let i = 0;
  return GROUPS.map((g) => ({
    ...g,
    headerIndex: i++,
    items: g.items.map((item) => ({ ...item, index: i++ })),
  }));
});
</script>

<template>
  <div
    aria-hidden="true"
    class="list-mock relative mx-auto w-full max-w-[22rem] select-none lg:max-w-[24rem]"
    :class="{ 'list-mock--static': isE2E }"
  >
    <div
      class="rounded-[1.75rem] bg-offwhite shadow-lift ring-1 ring-charcoal/[0.06]
             lg:rotate-[1.5deg]"
    >
      <div class="flex items-center justify-between gap-3 px-5 pt-5">
        <p class="text-lg font-semibold tracking-tight">{{ t('home.mock.title') }}</p>
        <div class="flex -space-x-1.5">
          <span
            class="list-mock__avatar list-mock__avatar--a"
          >
            {{ t('home.mock.syncAuthor').charAt(0) }}
          </span>
          <span
            class="list-mock__avatar list-mock__avatar--b"
          >
            G
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3 px-5 pt-3 pb-2">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal/[0.07]">
          <div
            class="list-mock__progress h-full rounded-full bg-primary"
            :style="{ width: `${(bought / total) * 100}%` }"
          />
        </div>
        <span class="text-sm font-semibold tabular-nums">{{ bought }}/{{ total }}</span>
      </div>

      <div class="pb-3">
        <template v-for="group in rows" :key="group.category">
          <div
            class="list-mock__row flex items-center gap-2 px-5 pt-3 pb-1.5"
            :style="{ '--i': group.headerIndex }"
          >
            <span class="w-5 text-center text-base leading-none">
              {{ CATEGORIES[group.category].icon }}
            </span>
            <span class="text-sm font-bold tracking-tight">
              {{ t(CATEGORIES[group.category].labelKey) }}
            </span>
          </div>
          <div
            v-for="item in group.items"
            :key="item.key"
            class="list-mock__row flex min-h-10 items-center gap-3 px-5"
            :class="{ 'list-mock__row--fresh': item.fresh }"
            :style="{ '--i': item.index }"
          >
            <span
              :class="[
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                item.checked
                  ? 'border-primary bg-primary text-white'
                  : 'border-muted-gray/50',
              ]"
            >
              <Check v-if="item.checked" :size="12" :stroke-width="3" />
            </span>
            <span class="w-5 text-center text-base leading-none">{{ item.icon }}</span>
            <span
              :class="[
                'min-w-0 flex-1 truncate text-sm',
                item.checked ? 'text-muted-gray' : 'text-charcoal',
              ]"
            >
              <span :class="['font-medium', { 'line-through': item.checked }]">
                {{ t(`home.mock.items.${item.key}`) }}
              </span>
              <span v-if="item.quantity" class="text-charcoal/70 tabular-nums">
                ({{ item.quantity }})
              </span>
            </span>
          </div>
        </template>
      </div>
    </div>

    <div
      class="list-mock__toast absolute -bottom-6 -left-3 flex items-center gap-2.5 rounded-2xl
             bg-cream px-3.5 py-2.5 text-sm shadow-lift ring-1 ring-charcoal/[0.06]
             sm:-left-8 lg:-left-12"
    >
      <span class="relative flex h-2 w-2">
        <span class="list-mock__ping absolute inset-0 rounded-full bg-emerald-500/60" />
        <span class="relative h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>
        <span class="font-semibold">{{ t('home.mock.syncAuthor') }}</span>
        {{ t('home.mock.syncAction', { item: t('home.mock.items.basil') }) }}
      </span>
      <span class="text-muted-gray">{{ t('home.mock.syncTime') }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Squircle avatars tinted from category hues, so both themes follow tokens. */
.list-mock__avatar {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 0 0 2px var(--offwhite);
}
.list-mock__avatar--a {
  background: color-mix(in srgb, var(--cat-fruit) 22%, var(--offwhite));
  color: var(--cat-fruit);
}
.list-mock__avatar--b {
  background: color-mix(in srgb, var(--cat-dairy) 22%, var(--offwhite));
  color: var(--cat-dairy);
}

.list-mock__row {
  animation: mock-rise 560ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i) * 60ms + 150ms);
}

.list-mock__row--fresh {
  animation:
    mock-rise 560ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
    mock-fresh 2400ms ease-out both;
  animation-delay: 1250ms, 1250ms;
}

.list-mock__progress {
  transform-origin: left center;
  animation: mock-grow 900ms cubic-bezier(0.2, 0.8, 0.2, 1) 300ms both;
}

.list-mock__toast {
  animation: mock-toast 600ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 1250ms both;
}

.list-mock__ping {
  animation: mock-ping 1800ms cubic-bezier(0, 0, 0.2, 1) 1800ms 3;
}

@keyframes mock-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes mock-fresh {
  0%,
  30% {
    background-color: color-mix(in srgb, var(--favorite-gold-soft) 90%, transparent);
  }
  100% {
    background-color: transparent;
  }
}

@keyframes mock-grow {
  from {
    transform: scaleX(0);
  }
}

@keyframes mock-toast {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}

@keyframes mock-ping {
  75%,
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}

/* Static under reduced motion and in e2e (axe reads mid-fade colours). */
@media (prefers-reduced-motion: reduce) {
  .list-mock *,
  .list-mock *::before {
    animation: none !important;
  }
}

.list-mock--static * {
  animation: none !important;
}
</style>
