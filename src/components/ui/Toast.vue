<script setup lang="ts">
import { useToasts, type Toast } from '@/composables/useToasts';

const { toasts, dismiss } = useToasts();

const onAction = (toast: Toast): void => {
  toast.action?.fn();
  dismiss(toast.id);
};
</script>

<template>
  <div
    v-if="toasts.length > 0"
    class="toast-region"
    role="region"
    aria-live="polite"
    aria-label="Notifications"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
    >
      <span class="toast__msg">{{ t.message }}</span>
      <button
        v-if="t.action"
        type="button"
        class="toast__action"
        @click="onAction(t)"
      >
        {{ t.action.label }}
      </button>
      <button
        type="button"
        class="toast__close"
        :aria-label="`Dismiss ${t.message}`"
        @click="dismiss(t.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  left: 50%;
  bottom: var(--space-8);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 50;
  pointer-events: none;
}

.toast-region > .toast {
  pointer-events: auto;
}

.toast__msg {
  flex: 1 1 auto;
}

.toast__action {
  background: transparent;
  color: var(--cream);
  border: 0;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 var(--space-2);
}

.toast__close {
  background: transparent;
  color: var(--cream);
  border: 0;
  font: inherit;
  font-size: var(--text-md);
  line-height: 1;
  cursor: pointer;
  padding: 0 var(--space-1);
  opacity: 0.6;
}
.toast__close:hover {
  opacity: 1;
}
</style>
