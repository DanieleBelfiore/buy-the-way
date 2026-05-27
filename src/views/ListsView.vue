<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, onActivated, onDeactivated, onBeforeUpdate, onUpdated } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { Plus, X, Settings as SettingsIcon, BarChart3, Bell } from '@lucide/vue';
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue';
import OnboardingTour from '@/components/onboarding/OnboardingTour.vue';
import NotificationsPopover from '@/components/notifications/NotificationsPopover.vue';
import { useNotifications } from '@/composables/useNotifications';
import type { NotificationDoc } from '@/domain/types';
import ListCard from '@/components/list/ListCard.vue';
import { VueDraggable } from 'vue-draggable-plus';
import {
  reorderList,
  computeReorderedSortIndex,
  orderListsWithDefaultFirst,
} from '@/services/lists.service';
import type { List } from '@/domain/types';
import FAB from '@/components/ui/FAB.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import AlertMessage from '@/components/ui/AlertMessage.vue';
import Toast from '@/components/ui/Toast.vue';
import PwaInstallButton from '@/components/ui/PwaInstallButton.vue';
import { DuplicateListNameError } from '@/services/lists.service';
import { getUsersByUids } from '@/services/users.service';
import { useLogoMotion } from '@/composables/useLogoMotion';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import type { UserProfile } from '@/domain/types';

// Explicit component name so <KeepAlive include="ListsView"> matches.
defineOptions({ name: 'ListsView' });

const logoMotion = useLogoMotion();

const { t } = useI18n();
const router = useRouter();
const listsStore = useListsStore();
const authStore = useAuthStore();

const showCreateInput = ref(false);
const newListName = ref('');
const creating = ref(false);
const createError = ref<string | null>(null);

let unsubscribe: (() => void) | undefined;

const profileMap = ref<Map<string, UserProfile>>(new Map());

const allUids = computed(() => {
  const set = new Set<string>();
  for (const l of listsStore.lists) {
    for (const uid of l.collaboratorUids) set.add(uid);
  }
  return [...set];
});

const loadProfiles = async (uids: readonly string[]): Promise<void> => {
  const missing = uids.filter((u) => !profileMap.value.has(u));
  if (missing.length === 0) return;
  try {
    const profiles = await getUsersByUids(missing);
    const next = new Map(profileMap.value);
    for (const p of profiles) next.set(p.uid, p);
    profileMap.value = next;
  } catch (err) {
    console.warn('[ListsView] loadProfiles failed:', err);
  }
};

watch(allUids, (uids) => {
  if (uids.length > 0) void loadProfiles(uids);
});

const profilesFor = (uids: readonly string[]): UserProfile[] =>
  uids
    .map((u) => profileMap.value.get(u))
    .filter((p): p is UserProfile => Boolean(p));

const startSub = () => {
  if (!unsubscribe) {
    unsubscribe = listsStore.subscribe();
  }
};

const stopSub = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = undefined;
  }
};

onMounted(async () => {
  // Run profile + lists init concurrently - neither blocks the other.
  void authStore.ensureProfile();
  await listsStore.loadLastSeen();
  startSub();
});

// Re-mount the Lottie player every time we come back to the view.
// DotLottieVue measures its container once at mount; when the view is cached
// by <KeepAlive> the canvas keeps stale dimensions and resizes badly on
// re-entry (e.g. after deleting a list and returning to the empty state).
// Bumping this key forces a clean mount and a fresh layout calc.
const emptyLottieKey = ref(0);
onActivated(() => {
  emptyLottieKey.value += 1;
  startSub();
});

// Per-list seen tracking happens on ListDetailView mount. The lists overview
// itself no longer marks anything as seen, so the NEW badge persists until
// the user actually opens the specific list.
onDeactivated(() => {
  stopSub();
});

onUnmounted(() => {
  stopSub();
});

const openCreateInput = () => {
  showCreateInput.value = true;
  newListName.value = '';
};

const cancelCreate = () => {
  showCreateInput.value = false;
  newListName.value = '';
};

const submitCreate = async () => {
  const name = newListName.value.trim();
  if (!name) return;
  creating.value = true;
  createError.value = null;
  try {
    await listsStore.createList(name);
    showCreateInput.value = false;
    newListName.value = '';
  } catch (err) {
    if (err instanceof DuplicateListNameError) {
      createError.value = t('list.duplicateName');
    } else {
      createError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    creating.value = false;
  }
};

const openList = (id: string) => {
  router.push({ name: 'list-detail', params: { id } });
};

const defaultListId = computed(() => authStore.profile?.defaultListId ?? null);

// Onboarding tour: shown once per account on first /lists mount.
// Gate strictly on `onboardingSeen === false` (NOT `!onboardingSeen`) so the
// overlay only appears after the profile has actually loaded - otherwise we'd
// flash the tour at users who've already dismissed it during the brief window
// where `authStore.profile` is still `null`.
// In E2E runs we suppress the tour entirely: the bridge signs the user in
// fresh each test, so without this gate every spec would have to dismiss the
// overlay before interacting with the FAB.
const isE2E = import.meta.env['VITE_E2E'] === 'true';
const showOnboarding = computed(
  () => !isE2E && authStore.profile !== null && authStore.profile.onboardingSeen !== true,
);

const dismissOnboarding = async (): Promise<void> => {
  try {
    await authStore.markOnboardingSeen();
  } catch (err) {
    console.warn('[ListsView] markOnboardingSeen failed:', err);
  }
};

// S4.2: in-app notifications. The popover opens a snapshot of the current
// inbox and immediately batch-deletes everything it shows (consume()). The
// snapshot stays in `notificationsView` so the rows remain visible until
// the user dismisses the popover; the live `count` drops to zero in the
// same Firestore tick so the badge clears.
const notifications = useNotifications();
const notificationsOpen = ref(false);
const notificationsView = ref<NotificationDoc[]>([]);

const openNotifications = async (): Promise<void> => {
  if (notificationsOpen.value) return;
  notificationsOpen.value = true;
  try {
    notificationsView.value = await notifications.consume();
  } catch (err) {
    console.warn('[ListsView] consume notifications failed:', err);
  }
};

const closeNotifications = (): void => {
  notificationsOpen.value = false;
  notificationsView.value = [];
};

const handleNotificationOpenList = (listId: string): void => {
  closeNotifications();
  router.push({ name: 'list-detail', params: { id: listId } });
};

// Pinned (default) list stays first in the overview regardless of sortIndex.
const orderedLists = computed(() =>
  orderListsWithDefaultFirst(listsStore.lists, defaultListId.value),
);

// Local mirror kept in sync with Firestore except during drag. On drop we
// apply the new order optimistically so Vue does not snap the list back to
// the stale store order while waiting for the snapshot (that snap reads as
// a brief flash).
const localLists = ref<List[]>([]);
const isDraggingList = ref(false);

watch(
  orderedLists,
  (lists) => {
    if (isDraggingList.value) return;
    localLists.value = lists;
  },
  { immediate: true },
);

// S3.4: drag-and-drop reorder. We bind the draggable to a LOCAL clone of the
// lists array so the user can drag without waiting on the firestore round
// trip; on drop, we compute the moved row's new sortIndex from its
// neighbours (midpoint heuristic) and persist it. The realtime snapshot
// catches up moments later and re-sorts identically.
const draggableLists = computed<List[]>({
  get: () => localLists.value,
  set: () => {
    // The Sortable lib mutates an internal copy; we ignore writes here and
    // act only on the @end event so we can compute the exact sortIndex
    // delta and persist it.
  },
});

interface SortableEvent {
  oldIndex?: number;
  newIndex?: number;
}

interface SortableMoveEvent {
  relatedContext?: { index: number; element: List };
  draggedContext?: { index: number; element: List };
}

/** Block dragging the pinned list or inserting another list above it. */
const canMoveList = (evt: SortableMoveEvent): boolean => {
  const defId = defaultListId.value;
  if (!defId) return true;
  const dragged = evt.draggedContext?.element;
  if (dragged?.id === defId) return false;
  if (evt.relatedContext?.index === 0) return false;
  return true;
};

const onReorder = async (e: SortableEvent): Promise<void> => {
  const { oldIndex, newIndex } = e;
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
  const arr = orderedLists.value;
  const moved = arr[oldIndex];
  if (!moved) return;

  const defId = defaultListId.value;
  if (defId && (moved.id === defId || newIndex === 0)) return;

  const post = [...arr];
  post.splice(oldIndex, 1);
  post.splice(newIndex, 0, moved);
  const target = computeReorderedSortIndex(post, newIndex);

  try {
    await reorderList(moved.id, target);
  } catch (err) {
    console.warn('[ListsView] reorderList failed:', err);
  }
};

const pinListToTop = async (listId: string): Promise<void> => {
  const ordered = orderListsWithDefaultFirst(listsStore.lists, listId);
  const target = computeReorderedSortIndex(ordered, 0);
  try {
    await reorderList(listId, target);
  } catch (err) {
    console.warn('[ListsView] pin reorder failed:', err);
  }
};

const LIST_REORDER_MS = 600;
const LIST_REORDER_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const draggableContainerRef = ref<{ $el: HTMLElement } | null>(null);
let flipAfterPin = false;
let flipFirstRects: Map<string, DOMRect> | null = null;

watch(defaultListId, (next, prev) => {
  if (next !== prev) flipAfterPin = true;
});

const captureListCardRects = (container: HTMLElement): Map<string, DOMRect> => {
  const map = new Map<string, DOMRect>();
  for (const el of container.querySelectorAll('[data-list-id]')) {
    const id = (el as HTMLElement).dataset.listId;
    if (id) map.set(id, el.getBoundingClientRect());
  }
  return map;
};

const playListReorderFlip = (container: HTMLElement, first: Map<string, DOMRect>): void => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  for (const el of container.querySelectorAll('[data-list-id]')) {
    const card = el as HTMLElement;
    const id = card.dataset.listId;
    if (!id) continue;
    const prev = first.get(id);
    if (!prev) continue;

    const next = card.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    card.style.transform = `translate(${dx}px, ${dy}px)`;
    card.style.transition = 'transform 0s';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = `transform ${LIST_REORDER_MS}ms ${LIST_REORDER_EASING}`;
        card.style.transform = '';
        const cleanup = (): void => {
          card.style.transition = '';
          card.removeEventListener('transitionend', cleanup);
        };
        card.addEventListener('transitionend', cleanup);
      });
    });
  }
};

onBeforeUpdate(() => {
  if (!flipAfterPin || isDraggingList.value) return;
  const container = draggableContainerRef.value?.$el;
  if (!container) return;
  flipFirstRects = captureListCardRects(container);
});

onUpdated(() => {
  const container = draggableContainerRef.value?.$el;
  if (flipAfterPin && !isDraggingList.value && flipFirstRects && container) {
    playListReorderFlip(container, flipFirstRects);
  }
  flipFirstRects = null;
  flipAfterPin = false;
});

const onDragStart = (): void => {
  isDraggingList.value = true;
};

const onDragEnd = async (e: SortableEvent): Promise<void> => {
  const { oldIndex, newIndex } = e;
  if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
    const arr = [...localLists.value];
    const moved = arr[oldIndex];
    if (moved) {
      arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      localLists.value = arr;
    }
  }
  isDraggingList.value = false;
  await onReorder(e);
};

// Explainer toast - fires when the star toggles so the user understands what
// "default list" means the first time they tap it (and on every subsequent
// flip for symmetry / discoverability).
const toastOpen = ref(false);
const toastMessage = ref('');

const showDefaultToast = (message: string): void => {
  toastMessage.value = message;
  // Force the Toast watcher to re-run even when message is identical: closing
  // first guarantees the open→true transition restarts the auto-close timer.
  toastOpen.value = false;
  void Promise.resolve().then(() => {
    toastOpen.value = true;
  });
};

// Star-toggle: pressing on the currently default list clears it; any other
// list becomes the new default (replacing the previous one).
const handleToggleDefault = async (id: string): Promise<void> => {
  const wasDefault = defaultListId.value === id;
  const next = wasDefault ? null : id;
  try {
    await authStore.setDefaultListId(next);
    if (next) await pinListToTop(next);
    showDefaultToast(
      wasDefault ? t('list.defaultClearedToast') : t('list.defaultSetToast'),
    );
  } catch (err) {
    console.warn('[ListsView] setDefaultListId failed:', err);
  }
};

// Lazy cleanup: once the lists subscription has delivered data and the
// profile is loaded, drop a stale defaultListId that no longer points to a
// list the user can access (deleted, or revoked-by-owner, etc.).
// Gating on `!loading` avoids clearing during the initial empty-state window.
watch(
  [
    () => listsStore.initialized,
    () => listsStore.lists,
    () => authStore.profile,
  ],
  ([initialized, lists, profile]) => {
    // Wait until the Firestore subscription has delivered at least once -
    // otherwise `lists=[]` at first paint would look like "default deleted"
    // and we'd wipe the pref the user just set.
    if (!initialized) return;
    const def = profile?.defaultListId;
    if (!def) return;
    const stillExists = lists.some((l) => l.id === def);
    if (!stillExists) {
      void authStore.setDefaultListId(null).catch((err) => {
        console.warn('[ListsView] auto-clear stale defaultListId failed:', err);
      });
    }
  },
  { immediate: true },
);

</script>

<template>
  <main class="flex-1 w-full bg-cream flex flex-col relative">
    <!-- Top bar: icon actions grouped top-right. -->
    <header class="px-5 pt-6 pb-2 flex items-center justify-end gap-1">
      <PwaInstallButton />
      <button
        :aria-label="t('stats.title')"
        data-testid="open-stats"
        class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal dark:text-white transition-colors"
        @click="router.push({ name: 'stats' })"
      >
        <BarChart3 :size="18" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="t('notifications.title')"
        data-testid="open-notifications"
        class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal dark:text-white transition-colors"
        @click="openNotifications"
      >
        <span class="relative inline-flex shrink-0 !overflow-visible">
          <Bell :size="18" :stroke-width="2.25" aria-hidden="true" />
          <span
            v-if="notifications.count.value > 0"
            data-testid="notifications-badge"
            :aria-label="t('notifications.badgeAria')"
            class="block absolute -top-1 -left-1 w-2 h-2 rounded-full bg-primary shrink-0"
          />
        </span>
      </button>
      <button
        :aria-label="t('settings.title')"
        data-testid="open-settings"
        class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal dark:text-white transition-colors"
        @click="router.push({ name: 'settings' })"
      >
        <SettingsIcon :size="18" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <LocaleSwitcher class="shrink-0 ml-1" />
    </header>

    <!-- Hero brand block -->
    <section class="px-5 pt-2 pb-6 text-center">
      <picture>
        <!-- Use the original-res asset for every density so the browser
             always downscales (crisp) instead of upscaling the 540px variant
             on retina/3x displays. -->
        <source srcset="/branding/logo-original.avif" type="image/avif" />
        <img
          v-motion="logoMotion"
          src="/branding/logo-original.png"
          :alt="t('app.name')"
          data-testid="lists-logo"
          width="1316"
          height="974"
          fetchpriority="high"
          decoding="async"
          class="mx-auto h-50 w-auto select-none"
          draggable="false"
        />
      </picture>
    </section>

    <!-- Create input (inline, appears when FAB tapped) -->
    <div v-if="showCreateInput" class="px-5 mb-4 space-y-2">
      <AlertMessage v-if="createError" :message="createError" />
      <input
        v-model="newListName"
        :aria-label="t('list.newPlaceholder')"
        :placeholder="t('list.newPlaceholder')"
        class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl
               text-sm text-charcoal placeholder-muted-gray
               focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        autofocus
        @keydown.enter="submitCreate"
        @keydown.escape="cancelCreate"
      />
      <div class="flex gap-2">
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 text-muted-gray text-sm rounded-xl hover:bg-black/5"
          @click="cancelCreate"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
        <button
          :disabled="creating || !newListName.trim()"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl
                 hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="submitCreate"
        >
          <Plus :size="16" :stroke-width="2.5" aria-hidden="true" />
          {{ t('list.create') }}
        </button>
      </div>
    </div>

    <!-- List of cards -->
    <section class="px-5 pb-24">
      <Transition name="state-fade" mode="out-in">
        <!-- Treat the pre-subscription window (mount → first Firestore
             snapshot) as "loading" too: without the `!initialized` guard the
             template falls through to the empty-state branch on hard refresh
             because `loading` flips to true only after `await loadLastSeen()`
             resolves, leaving a frame where lists=[] + loading=false. -->
        <div
          v-if="listsStore.loading || !listsStore.initialized"
          key="loading"
          class="space-y-3"
        >
          <SkeletonCard v-for="i in 3" :key="i" height-class="h-14" />
        </div>

        <div v-else-if="listsStore.error" key="error" class="pt-8 flex justify-center">
          <AlertMessage :message="listsStore.error" />
        </div>

        <div
          v-else-if="listsStore.lists.length === 0"
          key="empty"
          class="text-center pt-8 space-y-3"
        >
          <DotLottieVue
            :key="`empty-lottie-${emptyLottieKey}`"
            data-testid="lists-empty-lottie"
            aria-hidden="true"
            class="mx-auto h-40 w-40"
            src="/animations/empty.lottie"
            :autoplay="true"
            :loop="true"
          />
          <p class="text-charcoal font-medium">{{ t('list.noLists') }}</p>
          <p class="text-sm text-muted-gray">{{ t('list.noListsHint') }}</p>
        </div>

        <VueDraggable
          v-else
          ref="draggableContainerRef"
          v-model="draggableLists"
          key="cards"
          tag="div"
          class="space-y-3"
          :animation="LIST_REORDER_MS"
          easing="ease-out"
          :delay="300"
          :delay-on-touch-only="true"
          :touch-start-threshold="5"
          :disabled="draggableLists.length <= 1"
          filter=".list-card-no-drag"
          :move="canMoveList"
          ghost-class="list-card-ghost"
          @start="onDragStart"
          @end="onDragEnd"
        >
          <ListCard
            v-for="list in draggableLists"
            :key="list.id"
            :list="list"
            :is-default="defaultListId === list.id"
            :members="profilesFor(list.collaboratorUids)"
            @open="openList"
            @toggle-default="handleToggleDefault"
          />
        </VueDraggable>
      </Transition>
    </section>

    <!-- FAB -->
    <FAB v-if="!showCreateInput" @click="openCreateInput" />

    <Toast
      :open="toastOpen"
      :message="toastMessage"
      :duration-ms="3500"
      @close="toastOpen = false"
    />

    <OnboardingTour v-if="showOnboarding" @done="dismissOnboarding" />

    <NotificationsPopover
      :open="notificationsOpen"
      :items="notificationsView"
      @close="closeNotifications"
      @open-list="handleNotificationOpenList"
    />
  </main>
</template>

<style scoped>
.list-card-enter-active,
.list-card-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.list-card-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
.list-card-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
.list-card-move {
  transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
.state-fade-enter-active,
.state-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.state-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.state-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
/* S3.4: while a card is being dragged, the original slot keeps its shape but
   fades to a low-contrast placeholder so the user sees where it will land. */
.list-card-ghost {
  opacity: 0.4;
  transform: scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .list-card-enter-active,
  .list-card-leave-active,
  .list-card-move,
  .state-fade-enter-active,
  .state-fade-leave-active {
    transition: none;
  }
  .list-card-enter-from,
  .list-card-leave-to,
  .state-fade-enter-from,
  .state-fade-leave-to {
    transform: none;
  }
}
</style>
