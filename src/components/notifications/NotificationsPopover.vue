<script setup lang="ts">
import { computed, useId, toRef, watch } from 'vue';
import { useI18n, Translation as I18nT } from 'vue-i18n';
import { Bell, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import type { NotificationDoc } from '@/domain/types';

/**
 * S4.2: in-app notifications popover.
 *
 * The parent owns `open` + the "render then clear" lifecycle:
 *   - On open the parent snapshots `items` (consumed via the composable's
 *     `consume()` which batch-deletes after returning the snapshot) so the
 *     popover keeps displaying the rows even after Firestore removes them.
 *   - On close the parent flips `open` back to false and the snapshot is
 *     discarded by the parent.
 */
const props = defineProps<{
  open: boolean;
  items: readonly NotificationDoc[];
}>();

const emit = defineEmits<{
  close: [];
  'open-list': [listId: string];
}>();

const { t, locale } = useI18n();
const titleId = useId();

const formatTimestamp = (ms: number): string => {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
};

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('close'));

const empty = computed(() => props.items.length === 0);

/**
 * Choose the i18n key for a notification row.
 *  - collaborator-added: personal "you've been invited" template (the
 *    server only sends this to the invitee).
 *  - collaborator-joined: "Carol joined your list" template (the server
 *    fans this out to every other collaborator when the invitee first
 *    opens the list - detection happens client-side via lastSeenListMap).
 *  - item-modified: falls back to the no-item template when the server
 *    couldn't resolve a name (e.g. the item was deleted between the edit
 *    and the notification fan-out).
 */
const bodyKey = (n: NotificationDoc): string => {
  if (n.kind === 'collaborator-added') {
    return 'notifications.body.invitedToList';
  }
  if (n.kind === 'collaborator-joined') {
    return 'notifications.body.joinedYourList';
  }
  return n.itemName
    ? 'notifications.body.itemModifiedWith'
    : 'notifications.body.itemModifiedWithout';
};

const handleRowClick = (n: NotificationDoc): void => {
  emit('open-list', n.listId);
};

// Auto-focus the dialog when it opens so screen-readers announce the title
// and ESC works without a pre-click. Re-runs on every open transition.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    void Promise.resolve().then(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="notifications-dialog"]');
      el?.focus();
    });
  },
);
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[120] flex items-start justify-center px-5 pt-20"
    data-testid="notifications-popover"
  >
    <div
      data-testid="notifications-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('close')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      data-testid="notifications-dialog"
      class="relative z-10 w-fit min-w-[18rem] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-cream shadow-xl overflow-hidden"
      @keydown.esc="emit('close')"
    >
      <header class="flex items-center justify-between px-4 py-3 border-b border-cream-soft">
        <h2
          :id="titleId"
          class="inline-flex items-center gap-2 text-base font-semibold text-charcoal"
        >
          <Bell :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('notifications.title') }}
        </h2>
        <button
          type="button"
          data-testid="notifications-close"
          :aria-label="t('notifications.close')"
          class="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
          @click="emit('close')"
        >
          <X :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>

      <div
        v-if="empty"
        data-testid="notifications-empty"
        class="px-4 py-8 text-center text-sm text-muted-gray"
      >
        {{ t('notifications.empty') }}
      </div>

      <ul
        v-else
        data-testid="notifications-list"
        class="max-h-[60vh] overflow-y-auto divide-y divide-cream-soft"
      >
        <li
          v-for="n in props.items"
          :key="n.id"
          data-testid="notification-row"
        >
          <button
            type="button"
            class="w-full text-left px-4 py-3 flex items-start hover:bg-black/5 active:bg-black/10 !cursor-default"
            @click="handleRowClick(n)"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-charcoal truncate">
                {{ n.listName }}
              </span>
              <span class="block text-sm text-muted-gray whitespace-nowrap">
                <I18nT
                  v-if="n.kind === 'collaborator-added'"
                  :keypath="bodyKey(n)"
                  :locale="n.locale"
                  scope="global"
                  tag="span"
                >
                  <template #sender>
                    <strong class="text-charcoal font-semibold">{{ n.senderName }}</strong>
                  </template>
                  <template #list>
                    <strong class="text-charcoal font-semibold">{{ n.listName }}</strong>
                  </template>
                </I18nT>
                <I18nT
                  v-else-if="n.kind === 'collaborator-joined'"
                  :keypath="bodyKey(n)"
                  :locale="n.locale"
                  scope="global"
                  tag="span"
                >
                  <template #user>
                    <strong class="text-charcoal font-semibold">{{ n.senderName }}</strong>
                  </template>
                  <template #list>
                    <strong class="text-charcoal font-semibold">{{ n.listName }}</strong>
                  </template>
                </I18nT>
                <I18nT
                  v-else
                  :keypath="bodyKey(n)"
                  :locale="n.locale"
                  scope="global"
                  tag="span"
                >
                  <template #sender>
                    <strong class="text-charcoal font-semibold">{{ n.senderName }}</strong>
                  </template>
                  <template #item>
                    <strong class="text-charcoal font-semibold">{{ n.itemName }}</strong>
                  </template>
                </I18nT>
              </span>
              <span class="block mt-0.5 text-[10px] leading-tight text-muted-gray">
                {{ formatTimestamp(n.createdAt) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
