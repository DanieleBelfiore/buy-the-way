<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pin } from '@lucide/vue';
import ItemCountWithUrgent from '@/components/list/ItemCountWithUrgent.vue';
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

const handlePinClick = (ev: MouseEvent): void => {
  // Tapping the pin must not also open the list.
  ev.stopPropagation();
  emit('toggle-default', props.list.id);
};

const itemCount = computed(() => props.list.itemCount ?? 0);
const urgentCount = computed(() => props.list.urgentCount ?? 0);

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
  const overlay = themeStore.resolved === 'dark' ? '0.68' : '0.58';
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

const pinButtonClass = computed(() => {
  const base =
    'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full';
  if (props.isDefault) {
    return hasWallpaper.value ? `${base} text-white` : `${base} text-primary`;
  }
  if (hasWallpaper.value) return `${base} text-white/80`;
  return `${base} text-muted-gray`;
});
</script>

<template>
  <div
    data-testid="list-card"
    :data-list-id="props.list.id"
    role="button"
    tabindex="0"
    :class="[
      'group w-full text-left px-4 py-3 rounded-2xl border flex items-center gap-3 cursor-pointer',
      'transition-[box-shadow,border-color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
      hasWallpaper
        ? 'text-white border-transparent shadow-sm hover:shadow-md'
        : 'bg-offwhite text-charcoal border-cream-soft hover:border-charcoal/15 hover:shadow-sm',
      props.isDefault
        ? (hasWallpaper ? 'ring-1 ring-white/40' : 'ring-1 ring-primary/30')
        : '',
      { 'list-card-no-drag': props.isDefault },
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
        <span
          :class="[
            'text-lg font-medium truncate',
            hasWallpaper ? 'text-white wallpaper-overlay-text' : 'text-charcoal',
          ]"
        >{{ props.list.name }}</span>
      </div>
      <div
        :class="[
          'text-xs mt-0.5 flex flex-col gap-0.5',
          hasWallpaper
            ? 'text-white wallpaper-overlay-text'
            : 'text-muted-gray',
        ]"
      >
        <ItemCountWithUrgent
          v-if="itemCount > 0"
          :count="itemCount"
          :urgent-count="urgentCount"
          :muted="hasWallpaper"
        />
        <span data-testid="updated-at">{{ updatedLabel }}</span>
      </div>
    </div>

    <button
      type="button"
      :data-testid="`pin-${props.list.id}`"
      :aria-pressed="props.isDefault"
      :aria-label="props.isDefault ? t('list.unsetDefault') : t('list.setDefault')"
      :class="pinButtonClass"
      @click="handlePinClick"
    >
      <Pin
        :size="18"
        :stroke-width="2"
        :class="['text-inherit', props.isDefault ? 'rotate-[30deg]' : 'rotate-0']"
        :fill="props.isDefault ? 'currentColor' : 'none'"
        aria-hidden="true"
      />
    </button>

    <svg
      :class="[
        'shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0',
        hasWallpaper ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]' : 'text-muted-gray',
      ]"
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
