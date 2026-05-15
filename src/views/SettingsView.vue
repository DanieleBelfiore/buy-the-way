<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const signingOut = ref(false);

const handleSignOut = async () => {
  signingOut.value = true;
  try {
    await authStore.signOut();
    router.push({ name: 'login' });
  } finally {
    signingOut.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen bg-cream">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        class="text-charcoal"
        aria-label="Back"
        @click="router.back()"
      >
        ←
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">Settings</h1>
    </header>

    <section class="px-5 pt-6">
      <button
        :disabled="signingOut"
        data-testid="sign-out-btn"
        class="w-full px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl
               disabled:opacity-40 text-left"
        @click="handleSignOut"
      >
        {{ signingOut ? 'Signing out…' : 'Sign out' }}
      </button>
    </section>
  </main>
</template>
