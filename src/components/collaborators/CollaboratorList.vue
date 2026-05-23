<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LogOut, ShieldCheck, ShieldOff, X } from '@lucide/vue';
import type { UserProfile } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    members: readonly UserProfile[];
    ownerUid: string;
    /** Resolved admin set (falls back to [ownerUid] in the caller for legacy lists). */
    admins: readonly string[];
    selfUid: string;
    hideLeave?: boolean;
  }>(),
  { hideLeave: false },
);

const emit = defineEmits<{
  remove: [string];
  leave: [];
  promote: [string];
  demote: [string];
}>();

const { t } = useI18n();

const isSelfAdmin = computed(() => props.admins.includes(props.selfUid));
const isAdmin = (uid: string): boolean => props.admins.includes(uid);

const labelFor = (m: UserProfile): string =>
  m.displayName.trim().length > 0 ? m.displayName : m.email;

const initialFor = (m: UserProfile): string => {
  const source = m.displayName.trim() || m.email;
  return source.charAt(0).toUpperCase();
};

// Same hashing scheme used by ListCard so the same uid always maps to the
// same hue across views — visual consistency.
const colorFor = (uid: string): string => {
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
</script>

<template>
  <div class="space-y-2">
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="m in props.members"
        :key="m.uid"
        :data-testid="`collab-chip-${m.uid}`"
        class="inline-flex items-center gap-2 rounded-full bg-offwhite px-3 py-1.5 text-sm text-charcoal border border-cream-soft"
      >
        <span
          :data-testid="`collab-avatar-${m.uid}`"
          :class="[
            'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold overflow-hidden -ml-1',
            m.photoURL ? 'bg-offwhite' : colorFor(m.uid),
          ]"
        >
          <img
            v-if="m.photoURL"
            :src="m.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            loading="lazy"
            width="20"
            height="20"
            class="w-full h-full object-cover"
          />
          <template v-else>{{ initialFor(m) }}</template>
        </span>
        <span class="font-medium">{{ labelFor(m) }}</span>
        <span
          v-if="isAdmin(m.uid)"
          :data-testid="`admin-badge-${m.uid}`"
          class="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs text-charcoal"
        >
          {{ t('collaborators.admin') }}
        </span>

        <!-- Promote: visible to any admin, on any non-admin collaborator. -->
        <button
          v-if="isSelfAdmin && !isAdmin(m.uid)"
          type="button"
          :data-testid="`promote-${m.uid}`"
          :aria-label="`${t('collaborators.promote')} ${labelFor(m)}`"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
          @click="emit('promote', m.uid)"
        >
          <ShieldCheck :size="12" :stroke-width="2.25" aria-hidden="true" />
          {{ t('collaborators.promote') }}
        </button>

        <!-- Demote: visible to any admin, on any other admin (including the
             creator). Self-demote is permitted only when other admins remain;
             the service layer enforces the LastAdminError guard. -->
        <button
          v-if="isSelfAdmin && isAdmin(m.uid)"
          type="button"
          :data-testid="`demote-${m.uid}`"
          :aria-label="`${t('collaborators.demote')} ${labelFor(m)}`"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50 active:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950 dark:active:bg-amber-900"
          @click="emit('demote', m.uid)"
        >
          <ShieldOff :size="12" :stroke-width="2.25" aria-hidden="true" />
          {{ t('collaborators.demote') }}
        </button>

        <button
          v-if="isSelfAdmin && m.uid !== props.ownerUid && m.uid !== props.selfUid"
          type="button"
          :data-testid="`remove-${m.uid}`"
          :aria-label="`${t('collaborators.remove')} ${labelFor(m)}`"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950 dark:active:bg-red-900"
          @click="emit('remove', m.uid)"
        >
          <X :size="12" :stroke-width="2.25" aria-hidden="true" />
          {{ t('collaborators.remove') }}
        </button>
      </li>
    </ul>

    <button
      v-if="!isSelfAdmin && !props.hideLeave"
      type="button"
      data-testid="leave-list"
      class="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 active:bg-red-900 transition-colors"
      @click="emit('leave')"
    >
      <LogOut :size="16" :stroke-width="2" aria-hidden="true" />
      {{ t('collaborators.leave') }}
    </button>
  </div>
</template>
