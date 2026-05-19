<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, LogOut, Trash2 } from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import { setLocale } from '@/i18n';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import { RequiresRecentLoginError } from '@/services/auth.service';
import type { Locale } from '@/domain/types';
import pkg from '../../package.json';

const APP_VERSION = pkg.version;

const router = useRouter();
const authStore = useAuthStore();
const { t, locale } = useI18n();
const signingOut = ref(false);
const deletingAccount = ref(false);
const deleteConfirmOpen = ref(false);
const reauthNeeded = ref(false);
const deleteError = ref<string | null>(null);

const currentLocale = computed<Locale>(() => locale.value as Locale);
const user = computed(() => authStore.user);

const handleSetLocale = (next: Locale) => {
  setLocale(next);
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

const runDelete = async () => {
  if (!authStore.user) return;
  const uid = authStore.user.uid;
  deletingAccount.value = true;
  deleteError.value = null;
  try {
    await authStore.deleteAccount(uid);
    deleteConfirmOpen.value = false;
    router.push({ name: 'login' });
  } catch (err) {
    if (err instanceof RequiresRecentLoginError) {
      reauthNeeded.value = true;
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
  <main class="min-h-screen bg-cream flex flex-col">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        :aria-label="t('settings.title')"
        @click="router.back()"
      >
        <ArrowLeft :size="22" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">
        {{ t('settings.title') }}
      </h1>
    </header>

    <section class="px-5 pt-6">
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.language') }}
      </h2>
      <div
        role="radiogroup"
        :aria-label="t('settings.language')"
        class="flex gap-2"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="currentLocale === 'it'"
          data-testid="locale-it"
          :class="[
            'flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium border transition-colors',
            currentLocale === 'it'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-charcoal border-cream-soft',
          ]"
          @click="handleSetLocale('it')"
        >
          <span aria-hidden="true" class="text-lg leading-none">🇮🇹</span>
          <span>Italiano</span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="currentLocale === 'en'"
          data-testid="locale-en"
          :class="[
            'flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium border transition-colors',
            currentLocale === 'en'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-charcoal border-cream-soft',
          ]"
          @click="handleSetLocale('en')"
        >
          <span aria-hidden="true" class="text-lg leading-none">🇬🇧</span>
          <span>English</span>
        </button>
      </div>
    </section>

    <section
      v-if="user"
      data-testid="account-section"
      class="px-5 pt-8"
    >
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.account') }}
      </h2>
      <div class="bg-white rounded-xl border border-cream-soft px-4 py-3">
        <div
          v-if="user.displayName"
          class="text-charcoal font-medium"
        >
          {{ user.displayName }}
        </div>
        <div class="text-sm text-muted-gray">
          {{ user.email }}
        </div>
      </div>
    </section>

    <div class="mt-auto">
      <section class="px-5 pt-8 flex flex-row gap-3">
        <button
          v-if="user"
          :disabled="deletingAccount"
          data-testid="delete-account-btn"
          class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-700 text-offwhite font-medium rounded-xl
                 hover:bg-red-800 active:bg-red-900 transition-colors disabled:opacity-40"
          @click="openDeleteConfirm"
        >
          <Trash2 :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('settings.deleteAccount') }}
        </button>

        <button
          :disabled="signingOut"
          data-testid="sign-out-btn"
          class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-offwhite font-medium rounded-xl
                 hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-40"
          @click="handleSignOut"
        >
          <LogOut :size="16" :stroke-width="2" aria-hidden="true" />
          {{ signingOut ? t('auth.signingIn') : t('settings.signOut') }}
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
      <footer
        data-testid="app-version"
        class="px-5 pb-6 text-center text-xs text-muted-gray"
      >
        v{{ APP_VERSION }}
      </footer>
    </div>

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
  </main>
</template>
