<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { Plus, X, Settings as SettingsIcon, BarChart3 } from '@lucide/vue';
import ListCard from '@/components/list/ListCard.vue';
import FAB from '@/components/ui/FAB.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import AlertMessage from '@/components/ui/AlertMessage.vue';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import pkg from '../../package.json';

const APP_VERSION = pkg.version;
import { DuplicateListNameError } from '@/services/lists.service';
import { getUsersByUids } from '@/services/users.service';
import { useLogoMotion } from '@/composables/useLogoMotion';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import type { UserProfile } from '@/domain/types';

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
  await listsStore.loadLastSeen();
  unsubscribe = listsStore.subscribe();
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
</script>

<template>
  <main class="min-h-screen bg-cream flex flex-col">
    <!-- Top bar with stats + settings buttons (split 50/50 full width). -->
    <header class="px-5 pt-12 pb-2 flex items-center gap-2">
      <button
        :aria-label="t('stats.title')"
        data-testid="open-stats"
        class="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
        @click="router.push({ name: 'stats' })"
      >
        <BarChart3 :size="20" :stroke-width="2" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t('stats.openButton') }}</span>
      </button>
      <button
        :aria-label="t('settings.title')"
        class="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
        @click="router.push({ name: 'settings' })"
      >
        <SettingsIcon :size="20" :stroke-width="2" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t('settings.title') }}</span>
      </button>
    </header>

    <!-- Hero brand block -->
    <section class="px-5 pt-2 pb-6 text-center">
      <picture>
        <source srcset="/branding/logo-540.avif" type="image/avif" />
        <img
          v-motion="logoMotion"
          src="/branding/logo-original.png"
          :alt="t('app.name')"
          data-testid="lists-logo"
          width="540"
          height="399"
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
      <div class="flex gap-2">
        <input
          v-model="newListName"
          :aria-label="t('list.newPlaceholder')"
          :placeholder="t('list.newPlaceholder')"
          class="flex-1 px-4 py-3 bg-offwhite border border-cream-soft rounded-xl
                 text-sm text-charcoal placeholder-muted-gray
                 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          autofocus
          @keydown.enter="submitCreate"
          @keydown.escape="cancelCreate"
        />
        <button
          :disabled="creating || !newListName.trim()"
          class="inline-flex items-center gap-1.5 px-4 py-3 bg-primary text-offwhite text-sm font-medium rounded-xl
                 hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="submitCreate"
        >
          <Plus :size="16" :stroke-width="2.5" aria-hidden="true" />
          {{ t('list.create') }}
        </button>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-3 text-muted-gray text-sm"
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
            :members="profilesFor(list.collaboratorUids)"
            @open="openList"
          />
        </TransitionGroup>
      </Transition>
    </section>

    <!-- FAB -->
    <FAB v-if="!showCreateInput" @click="openCreateInput" />

    <div class="mt-auto pb-3">
      <LegalFooter dense />
      <p
        data-testid="made-by"
        class="px-5 text-center text-xs text-muted-gray"
      >
        {{ t('app.madeByPrefix') }}<a
          href="https://www.linkedin.com/in/danielebelfiore/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
        >Daniele Belfiore</a>{{ t('app.madeBySuffix') }}
      </p>
      <footer
        data-testid="app-version"
        class="px-5 text-center text-xs text-muted-gray"
      >
        v{{ APP_VERSION }}
      </footer>
    </div>
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
