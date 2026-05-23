<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { useListFavoritesStore } from '@/stores/listFavorites';
import {
  addCollaborator,
  cancelPendingInvite,
  removeCollaborator,
  leaveList,
  renameList,
  deleteList,
  setListShowFavorites,
  setListWallpaper,
  promoteAdmin,
  demoteAdmin,
  LastAdminError,
  type AddCollaboratorResult,
} from '@/services/lists.service';
import { sendInviteEmail } from '@/services/invites.service';
import { useSafeBack } from '@/composables/useSafeBack';
import Toast from '@/components/ui/Toast.vue';
import type { Locale } from '@/domain/types';
import WallpaperPicker from '@/components/list/WallpaperPicker.vue';
import type { Wallpaper } from '@/domain/wallpapers';
import { getUsersByUids } from '@/services/users.service';
import { ArrowLeft, Check, LogOut, Trash2 } from '@lucide/vue';
import AddCollaboratorForm from '@/components/collaborators/AddCollaboratorForm.vue';
import CollaboratorList from '@/components/collaborators/CollaboratorList.vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import type { ULID } from '@/domain/id';
import type { UserProfile } from '@/domain/types';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();
const authStore = useAuthStore();
const listFavoritesStore = useListFavoritesStore();

const listId = computed(() => route.params.id as ULID);
const list = computed(() => listsStore.lists.find((l) => l.id === listId.value));

const selfUid = computed(() => authStore.user?.uid ?? '');
// Legacy lists may not have an `admins` field; rules and the service layer
// both fall back to `[ownerUid]`. Mirror that here so UI gates behave the
// same way against un-migrated docs.
const adminUids = computed<readonly string[]>(
  () => list.value?.admins ?? (list.value ? [list.value.ownerUid] : []),
);
const isAdmin = computed(() => adminUids.value.includes(selfUid.value));

const nameDraft = ref('');
const renaming = ref(false);
const renameError = ref<string | null>(null);

const members = ref<UserProfile[]>([]);
const membersLoading = ref(false);

const deleteOpen = ref(false);
const actionError = ref<string | null>(null);

const showFavoritesValue = computed(() => list.value?.showFavorites !== false);
const togglingFavorites = ref(false);
const hasFavorites = computed(() => listFavoritesStore.rankedEntries.length > 0);

const handleToggleShowFavorites = async (next: boolean): Promise<void> => {
  if (!isAdmin.value) return;
  togglingFavorites.value = true;
  actionError.value = null;
  try {
    await setListShowFavorites(listId.value, next);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  } finally {
    togglingFavorites.value = false;
  }
};

const wallpaperValue = computed(() => list.value?.wallpaper);
const settingWallpaper = ref(false);

const handleSelectWallpaper = async (wallpaper: Wallpaper): Promise<void> => {
  if (!isAdmin.value) return;
  settingWallpaper.value = true;
  actionError.value = null;
  try {
    await setListWallpaper(listId.value, wallpaper);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  } finally {
    settingWallpaper.value = false;
  }
};

let listsUnsub: (() => void) | null = null;
let favoritesUnsub: (() => void) | null = null;

const loadMembers = async (uids: readonly string[]) => {
  membersLoading.value = true;
  try {
    members.value = await getUsersByUids(uids);
  } catch (err) {
    console.error('[ListSettingsView] loadMembers failed:', err);
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
};

watch(
  () => list.value?.collaboratorUids,
  (uids) => {
    if (uids) void loadMembers(uids);
  },
);

watch(
  () => list.value?.name,
  (n) => {
    if (n !== undefined && nameDraft.value === '') nameDraft.value = n;
  },
);

onMounted(() => {
  listsUnsub = listsStore.subscribe();
  if (listId.value) {
    favoritesUnsub = listFavoritesStore.subscribe(listId.value);
  }
  if (list.value) {
    nameDraft.value = list.value.name;
    void loadMembers(list.value.collaboratorUids);
  }
});

onUnmounted(() => {
  listsUnsub?.();
  favoritesUnsub?.();
});

const handleRename = async () => {
  if (!isAdmin.value) return;
  const trimmed = nameDraft.value.trim();
  if (!trimmed || trimmed === list.value?.name) return;
  renaming.value = true;
  renameError.value = null;
  try {
    await renameList(listId.value, trimmed);
  } catch (err) {
    renameError.value = err instanceof Error ? err.message : String(err);
  } finally {
    renaming.value = false;
  }
};

const handleAddCollaborator = async (email: string): Promise<AddCollaboratorResult> => {
  const result = await addCollaborator(listId.value, email);
  if (result.profile) {
    await loadMembers([...(list.value?.collaboratorUids ?? []), result.profile.uid]);
  }
  return result;
};

const pendingInviteEmails = computed<readonly string[]>(
  () => list.value?.pendingInviteEmails ?? [],
);

// Toast surface for the invite-email outcome (success or quiet failure).
const inviteToastOpen = ref(false);
const inviteToastMessage = ref('');
const showInviteToast = (message: string): void => {
  inviteToastMessage.value = message;
  inviteToastOpen.value = false;
  void Promise.resolve().then(() => {
    inviteToastOpen.value = true;
  });
};

const safeBack = useSafeBack();
const handleBack = (): void => safeBack({ name: 'list-detail', params: { id: listId.value } });

const onCollaboratorPending = async (email: string): Promise<void> => {
  // Fire-and-forget transactional email via the Netlify send-invite function.
  // The pending invite is already in Firestore — a delivery failure here just
  // means the invitee won't get the heads-up email; nothing else breaks.
  if (!list.value || !authStore.user) return;
  const inviterName =
    (authStore.user.displayName ?? '').trim() || authStore.user.email || '';
  try {
    await sendInviteEmail({
      email,
      listName: list.value.name,
      inviterName,
      locale: locale.value as Locale,
    });
    showInviteToast(t('collaborators.inviteEmailSent', { email }));
  } catch (err) {
    console.warn('[ListSettingsView] sendInviteEmail failed:', err);
    showInviteToast(t('collaborators.inviteEmailFailed', { email }));
  }
};

const handleCancelPending = async (email: string): Promise<void> => {
  actionError.value = null;
  try {
    await cancelPendingInvite(listId.value, email);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

const handleRemove = async (uid: string) => {
  actionError.value = null;
  try {
    await removeCollaborator(listId.value, uid);
    members.value = members.value.filter((m) => m.uid !== uid);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

// Promote / demote flow: a tap on the chip button stages the candidate uid
// in a ref that opens a ConfirmModal. Confirm hits the service; cancel just
// clears the candidate.
const promoteCandidate = ref<string | null>(null);
const demoteCandidate = ref<string | null>(null);

const memberLabel = (uid: string | null): string => {
  if (!uid) return '';
  const m = members.value.find((x) => x.uid === uid);
  if (!m) return uid;
  return m.displayName.trim() || m.email || uid;
};

const onPromoteRequest = (uid: string): void => {
  promoteCandidate.value = uid;
};

const onDemoteRequest = (uid: string): void => {
  demoteCandidate.value = uid;
};

const confirmPromote = async (): Promise<void> => {
  const target = promoteCandidate.value;
  promoteCandidate.value = null;
  if (!target) return;
  actionError.value = null;
  try {
    await promoteAdmin(listId.value, target);
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

const confirmDemote = async (): Promise<void> => {
  const target = demoteCandidate.value;
  demoteCandidate.value = null;
  if (!target) return;
  actionError.value = null;
  try {
    await demoteAdmin(listId.value, target);
  } catch (err) {
    if (err instanceof LastAdminError) {
      actionError.value = t('collaborators.lastAdminError');
    } else {
      actionError.value = err instanceof Error ? err.message : String(err);
    }
  }
};

// Clear the default-list pref if it points to the list we're about to walk
// away from. Errors are non-fatal — the lazy cleanup in ListsView will retry.
const clearDefaultIfMatches = async (): Promise<void> => {
  if (authStore.profile?.defaultListId === listId.value) {
    try {
      await authStore.setDefaultListId(null);
    } catch (err) {
      console.warn('[ListSettingsView] clearDefaultIfMatches failed:', err);
    }
  }
};

const handleLeave = async () => {
  actionError.value = null;
  try {
    await leaveList(listId.value, selfUid.value);
    await clearDefaultIfMatches();
    await router.push({ name: 'lists' });
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};

const handleDelete = async () => {
  deleteOpen.value = false;
  actionError.value = null;
  try {
    await deleteList(listId.value);
    await clearDefaultIfMatches();
    await router.push({ name: 'lists' });
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : String(err);
  }
};
</script>

<template>
  <main
    class="min-h-dvh bg-cream flex flex-col"
    style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));"
  >
    <header class="px-5 pt-6 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="handleBack"
      >
        <ArrowLeft :size="22" :stroke-width="2.5" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate">
        {{ t('listSettings.title') }}
      </h1>
    </header>

    <div v-if="!list" class="px-5 py-12 text-center">
      <p class="text-sm text-muted-gray">{{ t('error.listNotFound') }}</p>
    </div>

    <div v-else class="px-5 flex-1 flex flex-col gap-6">
      <section v-if="isAdmin" data-testid="rename-section" class="space-y-2">
        <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium">
          {{ t('listSettings.rename') }}
        </label>
        <div class="flex gap-2">
          <input
            v-model="nameDraft"
            :placeholder="t('listSettings.renamePlaceholder')"
            :aria-label="t('listSettings.renamePlaceholder')"
            class="flex-1 px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            @keydown.enter="handleRename"
          />
          <button
            data-testid="rename-save"
            type="button"
            :disabled="renaming || !nameDraft.trim() || nameDraft.trim() === list.name"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover active:bg-primary-active disabled:opacity-40 min-w-[110px]"
            @click="handleRename"
          >
            <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
            {{ t('listSettings.save') }}
          </button>
        </div>
        <p v-if="renameError" class="text-red-500 text-xs">{{ renameError }}</p>
      </section>

      <section v-if="isAdmin" data-testid="wallpaper-section" class="space-y-2">
        <label class="block text-xs uppercase tracking-wide text-muted-gray font-medium">
          {{ t('listSettings.wallpaper') }}
        </label>
        <WallpaperPicker
          :current="wallpaperValue"
          :busy="settingWallpaper"
          @select="handleSelectWallpaper"
        />
      </section>

      <section v-if="isAdmin && hasFavorites" data-testid="show-favorites-section" class="space-y-2">
        <label class="flex items-start justify-between gap-3 cursor-pointer select-none">
          <span class="flex-1">
            <span class="block text-sm font-medium text-charcoal">{{ t('listSettings.showFavorites') }}</span>
            <span class="block text-xs text-muted-gray">{{ t('listSettings.showFavoritesHint') }}</span>
          </span>
          <button
            data-testid="show-favorites-toggle"
            type="button"
            role="switch"
            :aria-checked="showFavoritesValue"
            :disabled="togglingFavorites"
            :class="[
              showFavoritesValue ? 'bg-primary' : 'bg-gray-200',
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 mt-1'
            ]"
            @click="handleToggleShowFavorites(!showFavoritesValue)"
          >
            <span
              aria-hidden="true"
              :class="[
                showFavoritesValue ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
              ]"
            />
          </button>
        </label>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs uppercase tracking-wide text-muted-gray font-medium">
          {{ t('listSettings.members') }}
        </h2>
        <CollaboratorList
          :members="members"
          :owner-uid="list.ownerUid"
          :admins="adminUids"
          :self-uid="selfUid"
          hide-leave
          @remove="handleRemove"
          @leave="handleLeave"
          @promote="onPromoteRequest"
          @demote="onDemoteRequest"
        />
        <AddCollaboratorForm
          v-if="isAdmin"
          :submit-fn="handleAddCollaborator"
          @pending="onCollaboratorPending"
        />

        <!-- Pending email invites (queued until invitee signs up). Only the
             owner sees these and can revoke a queued invite. -->
        <ul
          v-if="isAdmin && pendingInviteEmails.length > 0"
          data-testid="pending-invites"
          class="flex flex-wrap gap-2"
        >
          <li
            v-for="pe in pendingInviteEmails"
            :key="pe"
            :data-testid="`pending-${pe}`"
            class="inline-flex items-center gap-2 rounded-full bg-cream-soft px-3 py-1.5 text-sm text-muted-gray border border-cream-soft"
          >
            <span class="font-medium">{{ pe }}</span>
            <span class="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {{ t('collaborators.pendingBadge') }}
            </span>
            <button
              type="button"
              :data-testid="`cancel-pending-${pe}`"
              :aria-label="`${t('collaborators.remove')} ${pe}`"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950 dark:active:bg-red-900"
              @click="handleCancelPending(pe)"
            >
              ×
            </button>
          </li>
        </ul>
        <p v-if="actionError" class="text-red-500 text-xs">{{ actionError }}</p>
      </section>

      <div class="mt-auto pt-4 border-t border-cream-soft">
        <button
          v-if="!isAdmin"
          data-testid="leave-list-bottom"
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-800 active:bg-red-900 transition-colors"
          @click="handleLeave"
        >
          <LogOut :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('listSettings.leaveList') }}
        </button>
        <button
          v-if="isAdmin"
          data-testid="delete-list"
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-800 active:bg-red-900 transition-colors"
          @click="deleteOpen = true"
        >
          <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('listSettings.deleteList') }}
        </button>
      </div>

      <ConfirmModal
        v-if="list"
        :open="deleteOpen"
        :title="t('listSettings.deleteConfirmTitle')"
        :message="t('listSettings.deleteConfirmMessage', { name: list.name })"
        :confirm-label="t('listSettings.confirmDelete')"
        :cancel-label="t('listSettings.cancel')"
        destructive
        @confirm="handleDelete"
        @cancel="deleteOpen = false"
      />

      <ConfirmModal
        v-if="promoteCandidate"
        :open="promoteCandidate !== null"
        :title="t('collaborators.promoteConfirmTitle')"
        :message="t('collaborators.promoteConfirmMessage', { name: memberLabel(promoteCandidate) })"
        :confirm-label="t('collaborators.promote')"
        :cancel-label="t('listSettings.cancel')"
        @confirm="confirmPromote"
        @cancel="promoteCandidate = null"
      />

      <ConfirmModal
        v-if="demoteCandidate"
        :open="demoteCandidate !== null"
        :title="t('collaborators.demoteConfirmTitle')"
        :message="t('collaborators.demoteConfirmMessage', { name: memberLabel(demoteCandidate) })"
        :confirm-label="t('collaborators.demote')"
        :cancel-label="t('listSettings.cancel')"
        destructive
        @confirm="confirmDemote"
        @cancel="demoteCandidate = null"
      />

      <Toast
        :open="inviteToastOpen"
        :message="inviteToastMessage"
        :duration-ms="4000"
        @close="inviteToastOpen = false"
      />
    </div>
  </main>
</template>
