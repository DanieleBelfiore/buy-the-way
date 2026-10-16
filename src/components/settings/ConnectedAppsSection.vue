<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Unplug } from '@lucide/vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { useAuthStore } from '@/stores/auth';
import {
  revokeConnectedApp,
  subscribeConnectedApps,
  type ConnectedApp,
} from '@/services/connectedApps.service';

/**
 * Settings > Connected apps: AI assistants the user authorised over MCP.
 * Renders nothing until the user has at least one, so it stays invisible to
 * everyone outside the private beta (tasks/mcp-plan.md). Self-contained: it
 * subscribes to the user's grants itself and reports outcomes through
 * `notify` for the page toast.
 */

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const authStore = useAuthStore();

const apps = ref<ConnectedApp[]>([]);
const pending = ref<ConnectedApp | null>(null);
const revoking = ref(false);

let unsub: (() => void) | null = null;
const stop = (): void => {
  unsub?.();
  unsub = null;
};

watch(
  () => authStore.user?.uid,
  (uid) => {
    stop();
    apps.value = [];
    if (!uid) return;
    unsub = subscribeConnectedApps(
      uid,
      (next) => {
        apps.value = next;
      },
      (err) => {
        console.warn('[ConnectedAppsSection] grants subscription failed:', err);
        apps.value = [];
      },
    );
  },
  { immediate: true },
);
onUnmounted(stop);

const dateFormatter = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }),
);
const formatDate = (ms: number): string => dateFormatter.value.format(new Date(ms));
const nameOf = (app: ConnectedApp): string => app.clientName.trim() || t('connectedApps.unnamed');

const askDisconnect = (app: ConnectedApp): void => {
  pending.value = app;
};
const cancelDisconnect = (): void => {
  if (revoking.value) return;
  pending.value = null;
};

const confirmDisconnect = async (): Promise<void> => {
  const app = pending.value;
  if (!app || revoking.value) return;
  const client = nameOf(app);
  revoking.value = true;
  try {
    await revokeConnectedApp(app.grantId);
    emit('notify', t('connectedApps.done', { client }));
  } catch (err) {
    console.error('[ConnectedAppsSection] revoke failed:', err);
    emit('notify', t('connectedApps.failed', { client }));
  } finally {
    revoking.value = false;
    pending.value = null;
  }
};
</script>

<template>
  <section
    v-if="apps.length > 0"
    data-testid="connected-apps"
    class="px-5 pt-8"
  >
    <h2 class="text-sm font-semibold text-muted-gray mb-1">
      {{ t('connectedApps.title') }}
    </h2>
    <p class="text-sm text-muted-gray mb-2">{{ t('connectedApps.hint') }}</p>
    <ul class="bg-offwhite rounded-xl border border-cream-soft divide-y divide-cream-soft">
      <li
        v-for="app in apps"
        :key="app.grantId"
        data-testid="connected-app"
        class="px-4 py-3 flex items-center gap-3"
      >
        <div class="min-w-0 flex-1">
          <div class="text-charcoal font-medium break-words">{{ nameOf(app) }}</div>
          <div class="text-xs text-muted-gray whitespace-nowrap">
            {{ t('connectedApps.connectedOn', { date: formatDate(app.createdAt) }) }}
          </div>
          <div class="text-xs text-muted-gray whitespace-nowrap">
            {{ t('connectedApps.lastUsed', { date: formatDate(app.lastUsedAt) }) }}
          </div>
        </div>
        <button
          type="button"
          :data-testid="`disconnect-${app.grantId}`"
          :aria-label="t('connectedApps.disconnectAria', { client: nameOf(app) })"
          class="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-medium text-danger-ink
                 hover:bg-danger-ink/10 active:bg-danger-ink/20 transition-colors"
          @click="askDisconnect(app)"
        >
          <Unplug :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('connectedApps.disconnect') }}
        </button>
      </li>
    </ul>
  </section>

  <ConfirmModal
    v-if="pending"
    :open="pending !== null"
    :title="t('connectedApps.confirmTitle', { client: nameOf(pending) })"
    :message="t('connectedApps.confirmMessage', { client: nameOf(pending) })"
    :confirm-label="t('connectedApps.disconnect')"
    :cancel-label="t('connectedApps.confirmCancel')"
    destructive
    @confirm="confirmDisconnect"
    @cancel="cancelDisconnect"
  />
</template>
