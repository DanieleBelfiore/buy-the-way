<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuth } from '@/composables/useAuth';

// App-wide loading veil. Covers the two network waits that happen BEFORE any
// view can render its own skeleton, so they used to surface as a blank screen:
//   1. Reopen after the Firebase session lapsed - `ready` stays false until the
//      auth state is restored (token refresh over the network).
//   2. A navigation that blocks in the router guard (the boot-redirect awaits
//      the user profile before resolving the target route).
// The per-view skeletons only cover the final data-fetch frame, after mount.

// Most in-app navigations resolve in well under this budget and must NOT flash
// an overlay. Only the ones that genuinely block on the network cross it.
// Exposed as a prop purely so tests can drive the slow-nav path deterministically.
const props = withDefaults(defineProps<{ navDelayMs?: number }>(), {
  navDelayMs: 300,
});

const { t } = useI18n();
const { ready } = useAuth();
const router = useRouter();

const navSlow = ref(false);
let navTimer: ReturnType<typeof setTimeout> | null = null;

const clearNav = (): void => {
  if (navTimer !== null) {
    clearTimeout(navTimer);
    navTimer = null;
  }
  navSlow.value = false;
};

let removeBefore: (() => void) | null = null;
let removeAfter: (() => void) | null = null;
let removeError: (() => void) | null = null;

onMounted(() => {
  removeBefore = router.beforeEach(() => {
    if (navTimer !== null) clearTimeout(navTimer);
    navTimer = setTimeout(() => {
      navSlow.value = true;
    }, props.navDelayMs);
    return true;
  });
  removeAfter = router.afterEach(() => clearNav());
  removeError = router.onError(() => clearNav());
});

onBeforeUnmount(() => {
  clearNav();
  removeBefore?.();
  removeAfter?.();
  removeError?.();
});

const visible = computed(() => !ready.value || navSlow.value);
</script>

<template>
  <Transition name="global-loader-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-cream"
      role="status"
      aria-live="polite"
      :aria-label="t('common.loading')"
      data-testid="global-loader"
    >
      <span
        class="w-9 h-9 border-[3px] border-charcoal/20 border-t-charcoal rounded-full animate-spin"
        aria-hidden="true"
      />
    </div>
  </Transition>
</template>

<style scoped>
.global-loader-fade-enter-active,
.global-loader-fade-leave-active {
  transition: opacity 150ms ease;
}
.global-loader-fade-enter-from,
.global-loader-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .global-loader-fade-enter-active,
  .global-loader-fade-leave-active {
    transition: none;
  }
}
</style>
