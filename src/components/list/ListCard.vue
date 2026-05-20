<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { wallpaperUrl } from '@/domain/wallpapers';
import type { List, UserProfile } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    list: List;
    isNew?: boolean;
    members?: readonly UserProfile[];
  }>(),
  { isNew: false, members: () => [] },
);
const emit = defineEmits<{ (e: 'open', id: string): void }>();
const { t, locale } = useI18n();

const itemCount = computed(() => props.list.itemCount ?? 0);
const itemCountLabel = computed(() => t('list.itemCount', itemCount.value, { n: itemCount.value }));

const initialFor = (m: UserProfile): string => {
  const source = m.displayName.trim() || m.email;
  return source.charAt(0).toUpperCase();
};

const colorFor = (uid: string): string => {
  const palette = [
    'bg-rose-200 text-rose-900',
    'bg-amber-200 text-amber-900',
    'bg-emerald-200 text-emerald-900',
    'bg-sky-200 text-sky-900',
    'bg-violet-200 text-violet-900',
    'bg-pink-200 text-pink-900',
    'bg-lime-200 text-lime-900',
    'bg-cyan-200 text-cyan-900',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
};

const MAX_AVATARS = 3;
const visibleMembers = computed(() => props.members.slice(0, MAX_AVATARS));
const overflowCount = computed(() => Math.max(0, props.members.length - MAX_AVATARS));

const hasWallpaper = computed(() => Boolean(props.list.wallpaper));

const cardStyle = computed(() =>
  props.list.wallpaper
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('${wallpaperUrl(props.list.wallpaper)}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {},
);

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
  <button
    data-testid="list-card"
    :class="[
      'w-full text-left px-4 py-3 rounded-2xl border flex items-center gap-3',
      hasWallpaper
        ? 'text-offwhite border-transparent shadow-sm'
        : 'bg-offwhite text-charcoal border-cream-soft',
    ]"
    :style="cardStyle"
    :aria-label="props.list.name"
    @click="emit('open', props.list.id)"
  >
    <!-- Avatar cluster -->
    <div v-if="visibleMembers.length > 0" class="flex -space-x-1.5 shrink-0">
      <span
        v-for="m in visibleMembers"
        :key="m.uid"
        :title="m.displayName || m.email"
        :data-testid="`avatar-${m.uid}`"
        :class="[
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border border-offwhite overflow-hidden',
          m.photoURL ? 'bg-offwhite text-charcoal' : colorFor(m.uid),
        ]"
      >
        <img
          v-if="m.photoURL"
          :src="m.photoURL"
          :alt="''"
          referrerpolicy="no-referrer"
          loading="lazy"
          width="28"
          height="28"
          class="w-full h-full object-cover"
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
        <span :class="['font-medium truncate', hasWallpaper ? 'text-offwhite' : 'text-charcoal']">{{ props.list.name }}</span>
        <span
          v-if="props.isNew"
          data-testid="new-badge"
          class="shrink-0 rounded-full bg-charcoal text-offwhite px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        >
          {{ t('badge.new') }}
        </span>
      </div>
      <div :class="['flex items-center gap-1.5 text-xs mt-0.5', hasWallpaper ? 'text-offwhite/85' : 'text-muted-gray']">
        <span v-if="itemCount > 0" data-testid="item-count">{{ itemCountLabel }}</span>
        <span v-if="itemCount > 0" aria-hidden="true">·</span>
        <span data-testid="updated-at">{{ updatedLabel }}</span>
      </div>
    </div>

    <svg
      :class="['shrink-0', hasWallpaper ? 'text-offwhite' : 'text-muted-gray']"
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
  </button>
</template>
