<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Download, LogOut, MessageSquare, Moon, Share2, Sun, Trash2 } from '@lucide/vue';
import { getAuth } from 'firebase/auth';
import { useAuthStore } from '@/stores/auth';
import { downloadUserDataExport } from '@/services/export.service';
import { useThemeStore, type ThemeMode } from '@/stores/theme';
import { useShareApp } from '@/composables/useShareApp';
import { useSafeBack } from '@/composables/useSafeBack';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import FeedbackModal from '@/components/ui/FeedbackModal.vue';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue';
import Toast from '@/components/ui/Toast.vue';
import { RequiresRecentLoginError, PartialDeletionError } from '@/services/auth.service';
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { t } = useI18n();
const signingOut = ref(false);
const deletingAccount = ref(false);
const deleteConfirmOpen = ref(false);
const reauthNeeded = ref(false);
const deleteError = ref<string | null>(null);
// Unified toast surface - both "link copied" (share fallback) and "feedback
// received" funnel through the same Toast instance so they're styled the same
// (Info icon, content-hugging width) and never clash with each other.
const toastOpen = ref(false);
const toastMessage = ref('');
const showToast = (message: string): void => {
  toastMessage.value = message;
  toastOpen.value = false;
  void Promise.resolve().then(() => {
    toastOpen.value = true;
  });
};
const feedbackOpen = ref(false);

const user = computed(() => authStore.user);

const currentTheme = computed<ThemeMode>(() => themeStore.mode);
const handleSetTheme = (next: ThemeMode): void => {
  themeStore.setMode(next);
};

const { shareApp } = useShareApp();
const safeBack = useSafeBack();
const handleBack = (): void => safeBack({ name: 'lists' });
const handleShare = async (): Promise<void> => {
  const res = await shareApp();
  if (res.copied) showToast(t('settings.shareCopied'));
};

const openFeedback = (): void => {
  feedbackOpen.value = true;
};
const closeFeedback = (): void => {
  feedbackOpen.value = false;
};
const onFeedbackSubmitted = (): void => {
  showToast(t('settings.feedbackThanks'));
};

// S2.2: GDPR data export. Aggregates everything the user owns into a JSON
// blob and triggers a browser download. Errors surface as a toast - the
// service call itself never throws partial results.
const exporting = ref(false);
const handleExportData = async (): Promise<void> => {
  if (!authStore.user || exporting.value) return;
  exporting.value = true;
  try {
    const filename = await downloadUserDataExport(authStore.user.uid);
    showToast(t('settings.exportDoneToast', { filename }));
  } catch (err) {
    console.error('[SettingsView] data export failed:', err);
    showToast(t('settings.exportFailedToast'));
  } finally {
    exporting.value = false;
  }
};

const handleSignOut = async () => {
  signingOut.value = true;
  try {
    await authStore.signOut();
    router.push({ name: 'login' });
  } finally {
    signingOut.value = false;
  }
};

const openDeleteConfirm = () => {
  deleteError.value = null;
  reauthNeeded.value = false;
  deleteConfirmOpen.value = true;
};

const cancelDelete = () => {
  if (deletingAccount.value) return;
  deleteConfirmOpen.value = false;
  reauthNeeded.value = false;
  deleteError.value = null;
};

// Threshold matching Firebase's "recent login" window. The SDK requires a
// re-auth within ~5 minutes for destructive operations like `User.delete()`.
// We're conservative (4 minutes) to leave headroom for the cascade-delete to
// run before the token grows stale mid-flight.
const RECENT_LOGIN_WINDOW_MS = 4 * 60 * 1000;

const sessionIsFresh = (): boolean => {
  // Firebase exposes `auth.currentUser.metadata.lastSignInTime` as an ISO
  // string. Treat parsing failure as "not fresh" so we always reauth on
  // doubt rather than risk a mid-cascade requires-recent-login error.
  try {
    const iso = getAuth().currentUser?.metadata?.lastSignInTime;
    if (!iso) return false;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < RECENT_LOGIN_WINDOW_MS;
  } catch {
    return false;
  }
};

const runDelete = async () => {
  if (!authStore.user) return;
  const uid = authStore.user.uid;
  deletingAccount.value = true;
  deleteError.value = null;
  try {
    // C1: reauth BEFORE wiping any data. The previous flow deleted
    // Firestore data first, then discovered "requires-recent-login" only at
    // the final auth.currentUser.delete() step - leaving the account
    // orphaned with no data if the user didn't reauth+retry.
    if (!sessionIsFresh()) {
      reauthNeeded.value = true;
      return;
    }
    await authStore.deleteAccount(uid);
    deleteConfirmOpen.value = false;
    router.push({ name: 'login' });
  } catch (err) {
    if (err instanceof RequiresRecentLoginError) {
      // Defence in depth: even with the pre-flight check above, Firebase may
      // still raise this if the session aged out mid-call.
      reauthNeeded.value = true;
    } else if (err instanceof PartialDeletionError) {
      deleteError.value = t('settings.deleteAccountPartial');
    } else {
      deleteError.value = t('settings.deleteAccountError');
    }
  } finally {
    deletingAccount.value = false;
  }
};

const reauthAndRetry = async () => {
  if (!authStore.user) return;
  deletingAccount.value = true;
  deleteError.value = null;
  try {
    await authStore.reauthenticate();
    reauthNeeded.value = false;
    await runDelete();
  } catch {
    deleteError.value = t('settings.deleteAccountError');
  } finally {
    deletingAccount.value = false;
  }
};
</script>

<template>
  <main class="fixed inset-0 bg-cream flex flex-col overflow-hidden">
    <div class="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-y-contain">
    <header class="px-5 pt-6 pb-4 flex items-center gap-3">
      <button
        class="flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
        :aria-label="t('common.back')"
        @click="handleBack"
      >
        <ArrowLeft :size="22" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">
        {{ t('settings.title') }}
      </h1>
    </header>

    <section
      v-if="user"
      data-testid="account-section"
      class="px-5 pt-6"
    >
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.account') }}
      </h2>
      <div class="bg-offwhite rounded-xl border border-cream-soft px-4 py-3 flex items-center gap-3">
        <span
          data-testid="account-avatar"
          aria-hidden="true"
          class="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-cream-soft text-charcoal text-sm font-semibold"
        >
          <img
            v-if="user.photoURL"
            :src="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            loading="lazy"
            width="40"
            height="40"
            class="w-full h-full object-cover"
          />
          <template v-else>{{ (user.displayName || user.email || '?').charAt(0).toUpperCase() }}</template>
        </span>
        <div class="min-w-0 flex-1">
          <div
            v-if="user.displayName"
            class="text-charcoal font-medium truncate"
          >
            {{ user.displayName }}
          </div>
          <div class="text-sm text-muted-gray truncate">
            {{ user.email }}
          </div>
        </div>
      </div>
    </section>

    <section class="px-5 pt-8">
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.theme') }}
      </h2>
      <div
        role="radiogroup"
        :aria-label="t('settings.theme')"
        class="flex gap-2"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="currentTheme === 'light'"
          data-testid="theme-light"
          :class="[
            'flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-colors',
            currentTheme === 'light'
              ? 'bg-primary text-white border-primary'
              : 'bg-offwhite text-charcoal border-cream-soft',
          ]"
          @click="handleSetTheme('light')"
        >
          <Sun :size="16" :stroke-width="2" aria-hidden="true" />
          <span>{{ t('settings.themeLight') }}</span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="currentTheme === 'dark'"
          data-testid="theme-dark"
          :class="[
            'flex-1 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-colors',
            currentTheme === 'dark'
              ? 'bg-primary text-white border-primary'
              : 'bg-offwhite text-charcoal border-cream-soft',
          ]"
          @click="handleSetTheme('dark')"
        >
          <Moon :size="16" :stroke-width="2" aria-hidden="true" />
          <span>{{ t('settings.themeDark') }}</span>
        </button>
      </div>
    </section>

    <section class="px-5 pt-8">
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.language') }}
      </h2>
      <LocaleSwitcher variant="segmented" />
    </section>

    <div
      data-testid="settings-page-footer"
      class="mt-auto shrink-0 w-full pt-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-3"
    >
    <section class="px-5">
      <div class="flex flex-row gap-2">
        <button
          type="button"
          data-testid="share-btn"
          class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-3 bg-primary text-white font-medium rounded-xl
                 hover:bg-primary/90 active:bg-primary/80 transition-colors"
          @click="handleShare"
        >
          <Share2 :size="18" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          <span class="truncate text-[clamp(0.75rem,3.2vw,0.9rem)]">{{ t('settings.share') }}</span>
        </button>
        <button
          type="button"
          data-testid="feedback-btn"
          class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-3 bg-offwhite text-charcoal font-medium border border-cream-soft rounded-xl
                 hover:bg-black/5 active:bg-black/10 transition-colors"
          @click="openFeedback"
        >
          <MessageSquare :size="18" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          <span class="truncate text-[clamp(0.75rem,3.2vw,0.9rem)]">{{ t('settings.feedback') }}</span>
        </button>
      </div>
    </section>

    <section class="px-5">
        <button
          v-if="user"
          type="button"
          data-testid="export-data-btn"
          :disabled="exporting"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-offwhite text-charcoal font-medium border border-cream-soft rounded-xl
                 hover:bg-black/5 active:bg-black/10 transition-colors disabled:opacity-40"
          @click="handleExportData"
        >
          <Download :size="18" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          <span class="truncate text-[clamp(0.75rem,3.2vw,0.9rem)]">
            {{ exporting ? t('settings.exportRunning') : t('settings.exportData') }}
          </span>
        </button>
    </section>

    <section class="px-5 flex flex-row gap-3">
        <button
          v-if="user"
          :disabled="deletingAccount"
          data-testid="delete-account-btn"
          class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-3 bg-red-800 text-white font-medium rounded-xl
                 hover:bg-red-900 active:bg-red-950 transition-colors disabled:opacity-40"
          @click="openDeleteConfirm"
        >
          <Trash2 :size="16" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          <span class="truncate text-[clamp(0.75rem,3.2vw,0.9rem)]">{{ t('settings.deleteAccount') }}</span>
        </button>

        <button
          :disabled="signingOut"
          data-testid="sign-out-btn"
          class="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-3 bg-red-700 text-white font-medium rounded-xl
                 hover:bg-red-800 active:bg-red-900 transition-colors disabled:opacity-40"
          @click="handleSignOut"
        >
          <LogOut :size="16" :stroke-width="2" class="shrink-0" aria-hidden="true" />
          <span class="truncate text-[clamp(0.75rem,3.2vw,0.9rem)]">{{ signingOut ? t('auth.signingIn') : t('settings.signOut') }}</span>
        </button>
    </section>

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
    </div>
    </div>

    <FeedbackModal
      :open="feedbackOpen"
      @close="closeFeedback"
      @submitted="onFeedbackSubmitted"
    />

    <ConfirmModal
      v-if="deleteConfirmOpen && !reauthNeeded"
      :open="deleteConfirmOpen"
      :title="t('settings.deleteAccountConfirmTitle')"
      :message="deleteError ?? t('settings.deleteAccountConfirmMessage')"
      :confirm-label="t('settings.deleteAccountConfirm')"
      :cancel-label="t('settings.deleteAccountCancel')"
      destructive
      @confirm="runDelete"
      @cancel="cancelDelete"
    />

    <ConfirmModal
      v-if="deleteConfirmOpen && reauthNeeded"
      :open="deleteConfirmOpen"
      :title="t('settings.deleteAccountConfirmTitle')"
      :message="deleteError ?? t('settings.deleteAccountReauth')"
      :confirm-label="t('settings.deleteAccountReauthBtn')"
      :cancel-label="t('settings.deleteAccountCancel')"
      destructive
      @confirm="reauthAndRetry"
      @cancel="cancelDelete"
    />

    <Toast
      :open="toastOpen"
      :message="toastMessage"
      :duration-ms="3500"
      @close="toastOpen = false"
    />
  </main>
</template>
