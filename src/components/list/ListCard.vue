<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Star } from '@lucide/vue';
import { wallpaperUrl } from '@/domain/wallpapers';
import { useThemeStore } from '@/stores/theme';
import type { List, UserProfile } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    list: List;
    isDefault?: boolean;
    members?: readonly UserProfile[];
  }>(),
  { isDefault: false, members: () => [] },
);
const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'toggle-default', id: string): void;
}>();
const { t, locale } = useI18n();

const handleStarClick = (ev: MouseEvent): void => {
  // Tapping the star must not also open the list.
  ev.stopPropagation();
  emit('toggle-default', props.list.id);
};

const itemCount = computed(() => props.list.itemCount ?? 0);
const itemCountLabel = computed(() => t('list.itemCount', itemCount.value, { n: itemCount.value }));

const initialFor = (m: UserProfile): string => {
  const source = m.displayName.trim() || m.email;
  return source.charAt(0).toUpperCase();
};

const colorFor = (uid: string): string => {
  // Light: pastel chip with dark ink. Dark: deep chip with pastel ink - both
  // hit WCAG AA contrast (4.5:1) for the single initial letter inside.
  const palette = [
    'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
    'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
    'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
    'bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
    'bg-pink-200 text-pink-900 dark:bg-pink-900 dark:text-pink-100',
    'bg-lime-200 text-lime-900 dark:bg-lime-900 dark:text-lime-100',
    'bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
};

const MAX_AVATARS = 3;
const visibleMembers = computed(() => props.members.slice(0, MAX_AVATARS));
const overflowCount = computed(() => Math.max(0, props.members.length - MAX_AVATARS));

const hasWallpaper = computed(() => Boolean(props.list.wallpaper));

const themeStore = useThemeStore();

const cardStyle = computed(() => {
  if (!props.list.wallpaper) return {};
  // Dark theme: darker overlay so the wallpaper recedes and text stays
  // readable against the surrounding dark surfaces.
  const overlay = themeStore.resolved === 'dark' ? '0.6' : '0.45';
  return {
    backgroundImage: `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url('${wallpaperUrl(props.list.wallpaper)}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
});

const dateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year:
        new Date(props.list.updatedAt).getFullYear() === new Date().getFullYear()
          ? undefined
          : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
);
const updatedLabel = computed(() => dateFormatter.value.format(new Date(props.list.updatedAt)));
</script>

<template>
  <div
    data-testid="list-card"
    role="button"
    tabindex="0"
    :class="[
      'w-full text-left px-4 py-3 rounded-2xl border flex items-center gap-3 cursor-pointer',
      hasWallpaper
        ? 'text-white border-transparent shadow-sm'
        : 'bg-offwhite text-charcoal border-cream-soft',
    ]"
    :style="cardStyle"
    :aria-label="props.list.name"
    @click="emit('open', props.list.id)"
    @keydown.enter.prevent="emit('open', props.list.id)"
    @keydown.space.prevent="emit('open', props.list.id)"
  >
    <!-- Avatar cluster: profile photos use CSS background (not <img>) so a
         long-press on mobile does not offer "Save image" and clash with the
         list reorder drag gesture. -->
    <div
      v-if="visibleMembers.length > 0"
      class="flex -space-x-1.5 shrink-0"
      @contextmenu.prevent
    >
      <span
        v-for="m in visibleMembers"
        :key="m.uid"
        :title="m.displayName || m.email"
        :data-testid="`avatar-${m.uid}`"
        :class="[
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border border-offwhite overflow-hidden select-none [-webkit-touch-callout:none]',
          m.photoURL ? 'bg-offwhite text-charcoal' : colorFor(m.uid),
        ]"
      >
        <span
          v-if="m.photoURL"
          :data-testid="`avatar-photo-${m.uid}`"
          class="block h-full w-full bg-cover bg-center pointer-events-none"
          :style="{ backgroundImage: `url('${m.photoURL}')` }"
          aria-hidden="true"
        />
        <template v-else>{{ initialFor(m) }}</template>
      </span>
      <span
        v-if="overflowCount > 0"
        :title="String(overflowCount)"
        class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold bg-cream-soft text-charcoal border border-offwhite"
      >
        +{{ overflowCount }}
      </span>
    </div>

    <!-- Title + meta -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 min-w-0">
        <span :class="['font-medium truncate', hasWallpaper ? 'text-white' : 'text-charcoal']">{{ props.list.name }}</span>
      </div>
      <div :class="['flex items-center gap-1.5 text-xs mt-0.5', hasWallpaper ? 'text-white/85' : 'text-muted-gray']">
        <span v-if="itemCount > 0" data-testid="item-count">{{ itemCountLabel }}</span>
        <span v-if="itemCount > 0" aria-hidden="true">·</span>
        <span data-testid="updated-at">{{ updatedLabel }}</span>
      </div>
    </div>

    <button
      type="button"
      :data-testid="`star-${props.list.id}`"
      :aria-pressed="props.isDefault"
      :aria-label="props.isDefault ? t('list.unsetDefault') : t('list.setDefault')"
      :title="props.isDefault ? t('list.unsetDefault') : t('list.setDefault')"
      :class="[
        'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors',
        hasWallpaper
          ? 'hover:bg-white/15 active:bg-white/25'
          : 'hover:bg-black/5 active:bg-black/10',
      ]"
      @click="handleStarClick"
    >
      <Star
        :size="18"
        :stroke-width="2"
        :class="
          props.isDefault
            ? 'text-amber-400'
            : hasWallpaper
              ? 'text-white/80'
              : 'text-muted-gray'
        "
        :fill="props.isDefault ? 'currentColor' : 'none'"
        aria-hidden="true"
      />
    </button>

    <svg
      :class="['shrink-0', hasWallpaper ? 'text-white' : 'text-muted-gray']"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</template>
