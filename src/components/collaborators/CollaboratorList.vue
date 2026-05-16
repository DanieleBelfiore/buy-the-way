<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { UserProfile } from '@/domain/types';

const props = defineProps<{
  members: readonly UserProfile[];
  ownerUid: string;
  selfUid: string;
}>();

const emit = defineEmits<{
  remove: [string];
  leave: [];
}>();

const { t } = useI18n();

const isOwner = computed(() => props.selfUid === props.ownerUid);

const labelFor = (m: UserProfile): string =>
  m.displayName.trim().length > 0 ? m.displayName : m.email;
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
        <span class="font-medium">{{ labelFor(m) }}</span>
        <span
          v-if="m.uid === props.ownerUid"
          class="rounded-full bg-charcoal/10 px-2 py-0.5 text-xs text-charcoal"
        >
          {{ t('collaborators.owner') }}
        </span>
        <button
          v-if="isOwner && m.uid !== props.ownerUid"
          type="button"
          :data-testid="`remove-${m.uid}`"
          :aria-label="`${t('collaborators.remove')} ${labelFor(m)}`"
          class="rounded-full px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 active:bg-red-100"
          @click="emit('remove', m.uid)"
        >
          {{ t('collaborators.remove') }}
        </button>
      </li>
    </ul>

    <button
      v-if="!isOwner"
      type="button"
      data-testid="leave-list"
      class="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
      @click="emit('leave')"
    >
      {{ t('collaborators.leave') }}
    </button>
  </div>
</template>
