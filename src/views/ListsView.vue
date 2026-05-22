<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { Plus, X, Settings as SettingsIcon, BarChart3 } from '@lucide/vue';
import ListCard from '@/components/list/ListCard.vue';
import FAB from '@/components/ui/FAB.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import AlertMessage from '@/components/ui/AlertMessage.vue';
import Toast from '@/components/ui/Toast.vue';
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

onMounted(async () => {
  // Run profile + lists init concurrently — neither blocks the other.
  void authStore.ensureProfile();
  await listsStore.loadLastSeen();
  unsubscribe = listsStore.subscribe();
});

// Re-mount the Lottie player every time we come back to the view.
// DotLottieVue measures its container once at mount; when the view is cached
// by <KeepAlive> the canvas keeps stale dimensions and resizes badly on
// re-entry (e.g. after deleting a list and returning to the empty state).
// Bumping this key forces a clean mount and a fresh layout calc.
const emptyLottieKey = ref(0);
onActivated(() => {
  emptyLottieKey.value += 1;
});

// Kept alive across navigations: fire markSeen when user leaves the view
// (mirrors the old onUnmounted behaviour) without tearing down the subscription.
onDeactivated(() => {
  void listsStore.markSeen();
});

onUnmounted(() => {
  unsubscribe?.();
  void listsStore.markSeen();
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

// Explainer toast — fires when the star toggles so the user understands what
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
    // Wait until the Firestore subscription has delivered at least once —
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
  <main class="min-h-screen min-h-dvh bg-cream flex flex-col">
    <!-- Top bar with stats + settings buttons (split 50/50 full width). -->
    <header class="px-5 pt-12 pb-2 flex items-center gap-2">
      <button
        :aria-label="t('stats.title')"
        data-testid="open-stats"
        class="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-muted-gray dark:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
        @click="router.push({ name: 'stats' })"
      >
        <BarChart3 :size="20" :stroke-width="2" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t('stats.openButton') }}</span>
      </button>
      <button
        :aria-label="t('settings.title')"
        class="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-muted-gray dark:text-white hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15"
        @click="router.push({ name: 'settings' })"
      >
        <SettingsIcon :size="20" :stroke-width="2" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t('settings.title') }}</span>
      </button>
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
          :disabled="creating || !newListName.trim()"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-primary text-white text-sm font-medium rounded-xl
                 hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="submitCreate"
        >
          <Plus :size="16" :stroke-width="2.5" aria-hidden="true" />
          {{ t('list.create') }}
        </button>
        <button
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 text-muted-gray text-sm rounded-xl hover:bg-black/5"
          @click="cancelCreate"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
      </div>
    </div>

    <!-- List of cards -->
    <section class="px-5 pb-24">
      <Transition name="state-fade" mode="out-in">
        <div v-if="listsStore.loading" key="loading" class="space-y-3">
          <SkeletonCard v-for="i in 3" :key="i" height-class="h-14" />
        </div>

        <div v-else-if="listsStore.error" key="error" class="pt-8 flex justify-center">
          <AlertMessage :message="listsStore.error" />
        </div>

        <div
          v-else-if="listsStore.lists.length === 0"
          key="empty"
          class="text-center pt-16 space-y-3"
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

        <TransitionGroup v-else key="cards" name="list-card" tag="div" class="space-y-3">
          <ListCard
            v-for="list in listsStore.lists"
            :key="list.id"
            :list="list"
            :is-new="authStore.user ? listsStore.isNewForUser(list, authStore.user.uid) : false"
            :is-default="defaultListId === list.id"
            :members="profilesFor(list.collaboratorUids)"
            @open="openList"
            @toggle-default="handleToggleDefault"
          />
        </TransitionGroup>
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
  transition: transform 220ms ease;
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
