<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Check, X } from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import { useDocumentHead } from '@/composables/useDocumentHead';
import {
  callOAuthAuthorize,
  navigateToClient,
  pickOAuthParams,
  type OAuthAction,
  type OAuthAuthorizeResult,
} from '@/services/oauth.service';

/**
 * MCP consent screen: the OAuth `authorization_endpoint`. An MCP client
 * (Claude, ...) sends the user here; the route guard has already made sure
 * they are signed in (and brings them back here after /login). Everything is
 * validated server-side by the `oauth-authorize` function: this view shows
 * the request, sends the decision and follows the redirect it gets back.
 *
 * Self-contained for direct URL access: all it needs is the query string and
 * the signed-in user, both available on a hard refresh.
 */

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

useDocumentHead({
  titleKey: 'seo.oauthAuthorize.title',
  descriptionKey: 'seo.oauthAuthorize.description',
});

type ViewState = 'loading' | 'consent' | 'unavailable' | 'invalid' | 'error';

const state = ref<ViewState>('loading');
const clientName = ref('');
const redirectHost = ref('');
const exitUrl = ref('');
const deciding = ref(false);
const params = pickOAuthParams(route.query);

const apply = (action: OAuthAction, result: OAuthAuthorizeResult): void => {
  if (result.status === 'redirect') {
    // Leave the app only after an explicit decision. A redirect answer to
    // the initial describe would be an open redirect (RFC 9700 4.11.2).
    if (action === 'describe') {
      state.value = 'error';
      return;
    }
    navigateToClient(result.redirectTo);
    return;
  }
  if (result.status === 'unavailable') {
    exitUrl.value = result.redirectTo;
    state.value = 'unavailable';
    return;
  }
  if (result.status === 'invalid') {
    state.value = 'invalid';
    return;
  }
  clientName.value = result.clientName;
  redirectHost.value = result.redirectHost;
  state.value = 'consent';
};

const run = async (action: OAuthAction): Promise<void> => {
  try {
    apply(action, await callOAuthAuthorize(action, params));
  } catch (err) {
    console.error('[OAuthAuthorizeView] request failed:', err);
    state.value = 'error';
  }
};

const loadRequest = async (): Promise<void> => {
  state.value = 'loading';
  await run('describe');
};

const decide = async (action: 'approve' | 'deny'): Promise<void> => {
  if (deciding.value) return;
  deciding.value = true;
  await run(action);
  deciding.value = false;
};

onMounted(loadRequest);
</script>

<template>
  <main class="min-h-dvh bg-cream flex items-center justify-center px-5 py-10">
    <div class="w-full max-w-sm rounded-2xl bg-offwhite p-6 shadow-xl">
      <p v-if="state === 'loading'" data-testid="oauth-loading" class="text-center text-base font-semibold text-charcoal">
        {{ t('oauthAuthorize.loading') }}
      </p>

      <div v-else-if="state === 'consent'" data-testid="oauth-consent" class="space-y-5">
        <div class="space-y-2">
          <h1 class="text-xl font-semibold text-charcoal">
            {{ t('oauthAuthorize.title', { client: clientName }) }}
          </h1>
          <p class="text-sm text-muted-gray">{{ t('oauthAuthorize.intro', { client: clientName }) }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-semibold text-charcoal">{{ t('oauthAuthorize.canTitle') }}</p>
          <ul class="space-y-1.5 text-sm text-charcoal">
            <li v-for="key in ['canRead', 'canEdit', 'canLists']" :key="key" class="flex gap-2">
              <Check class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{{ t(`oauthAuthorize.${key}`) }}</span>
            </li>
          </ul>
          <p class="pt-1 text-sm font-semibold text-charcoal">{{ t('oauthAuthorize.cannotTitle') }}</p>
          <p class="flex gap-2 text-sm text-charcoal">
            <X class="mt-0.5 size-4 shrink-0 text-muted-gray" aria-hidden="true" />
            <span>{{ t('oauthAuthorize.cannot') }}</span>
          </p>
        </div>

        <div class="space-y-1 text-xs text-muted-gray">
          <p v-if="auth.user?.email">{{ t('oauthAuthorize.signedInAs', { email: auth.user.email }) }}</p>
          <p>{{ t('oauthAuthorize.redirectNotice', { host: redirectHost }) }}</p>
          <p>{{ t('oauthAuthorize.revokeHint') }}</p>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            data-testid="oauth-deny"
            :disabled="deciding"
            class="flex-1 rounded-full border border-cream-soft px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-cream disabled:opacity-40"
            @click="decide('deny')"
          >
            {{ t('oauthAuthorize.deny') }}
          </button>
          <button
            type="button"
            data-testid="oauth-allow"
            :disabled="deciding"
            class="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
            @click="decide('approve')"
          >
            {{ deciding ? t('oauthAuthorize.working') : t('oauthAuthorize.allow') }}
          </button>
        </div>
      </div>

      <div v-else-if="state === 'unavailable'" data-testid="oauth-unavailable" class="space-y-3 text-center">
        <p class="text-base font-semibold text-charcoal">{{ t('oauthAuthorize.unavailableTitle') }}</p>
        <p class="text-sm text-muted-gray">{{ t('oauthAuthorize.unavailableBody') }}</p>
        <button
          type="button"
          data-testid="oauth-back"
          class="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active"
          @click="navigateToClient(exitUrl)"
        >
          {{ t('oauthAuthorize.back') }}
        </button>
      </div>

      <div v-else-if="state === 'invalid'" data-testid="oauth-invalid" class="space-y-3 text-center">
        <p class="text-base font-semibold text-red-700">{{ t('oauthAuthorize.invalidTitle') }}</p>
        <p class="text-sm text-muted-gray">{{ t('oauthAuthorize.invalidBody') }}</p>
        <button
          type="button"
          data-testid="oauth-go-lists"
          class="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active"
          @click="router.replace({ name: 'lists' })"
        >
          {{ t('oauthAuthorize.goToLists') }}
        </button>
      </div>

      <div v-else data-testid="oauth-error" class="space-y-3 text-center">
        <p class="text-base font-semibold text-red-700">{{ t('oauthAuthorize.errorTitle') }}</p>
        <p class="text-sm text-muted-gray">{{ t('oauthAuthorize.errorBody') }}</p>
        <button
          type="button"
          data-testid="oauth-retry"
          class="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active"
          @click="loadRequest"
        >
          {{ t('oauthAuthorize.retry') }}
        </button>
      </div>
    </div>
  </main>
</template>
