<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Avatar from '@/components/ui/Avatar.vue';

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const handleLogout = async (): Promise<void> => {
  auth.signOut();
  await router.push('/login');
};
</script>

<template>
  <div
    class="settings-view"
    data-view="SettingsView"
  >
    <header class="settings-view__header appbar">
      <h1 class="settings-view__title">
        {{ t('settings.account') }}
      </h1>
    </header>

    <section
      class="settings-view__section"
      aria-labelledby="account-heading"
    >
      <div class="settings-view__account">
        <Avatar
          :name="auth.currentUser?.displayName ?? '?'"
          tone="dark"
        />
        <div class="settings-view__account-info">
          <p class="settings-view__name">
            {{ auth.currentUser?.displayName }}
          </p>
          <p class="settings-view__email label">
            {{ auth.currentUser?.email }}
          </p>
        </div>
      </div>
    </section>

    <section
      class="settings-view__section"
      aria-labelledby="language-heading"
    >
      <h2
        id="language-heading"
        class="settings-view__section-title"
      >
        {{ t('settings.language') }}
      </h2>
      <div class="settings-view__lang-row">
        <button
          type="button"
          class="btn"
          :class="locale === 'it' ? 'btn--dark' : 'btn--ghost'"
          data-testid="lang-it"
          @click="locale = 'it'"
        >
          Italiano
        </button>
        <button
          type="button"
          class="btn"
          :class="locale === 'en' ? 'btn--dark' : 'btn--ghost'"
          data-testid="lang-en"
          @click="locale = 'en'"
        >
          English
        </button>
      </div>
    </section>

    <section class="settings-view__section">
      <ul class="settings-view__links">
        <li>
          <router-link
            to="/trash"
            class="settings-view__link"
          >
            {{ t('settings.trash') }}
          </router-link>
        </li>
      </ul>
    </section>

    <section class="settings-view__section">
      <button
        type="button"
        class="btn btn--ghost btn--full"
        data-testid="logout-btn"
        @click="handleLogout"
      >
        {{ t('settings.logout') }}
      </button>
    </section>

    <footer class="settings-view__footer label">
      {{ t('settings.version') }} 1.0.0
    </footer>
  </div>
</template>

<style scoped>
.settings-view {
  min-height: 100dvh;
  background: var(--cream);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-view__header {
  margin-bottom: var(--space-4);
}

.settings-view__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.settings-view__section {
  background: var(--offwhite);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.settings-view__section-title {
  margin: 0 0 var(--space-3);
  font-weight: 600;
}

.settings-view__account {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.settings-view__account-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.settings-view__name {
  font-weight: 600;
  color: var(--charcoal);
  margin: 0;
}

.settings-view__email {
  margin: 0;
  color: var(--ink-40);
}

.settings-view__lang-row {
  display: flex;
  gap: var(--space-2);
}

.settings-view__links {
  list-style: none;
  margin: 0;
  padding: 0;
}

.settings-view__link {
  display: block;
  padding: var(--space-2) 0;
  color: var(--charcoal);
  text-decoration: none;
  font-weight: 500;
}

.settings-view__footer {
  text-align: center;
  color: var(--ink-40);
  padding: var(--space-4) 0;
  margin-top: auto;
}
</style>
