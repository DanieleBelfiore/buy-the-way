import { ref, type Ref } from 'vue';

export interface ToastAction {
  label: string;
  fn: () => void;
}

export interface Toast {
  id: string;
  message: string;
  action?: ToastAction;
}

const TOAST_TTL_MS = 4000;

// Module-level state — singleton across the app.
const toasts = ref<Toast[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const dismiss = (id: string): void => {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter((t) => t.id !== id);
};

const addToast = (message: string, action?: ToastAction): void => {
  const id = generateId();
  const toast: Toast = action ? { id, message, action } : { id, message };
  toasts.value = [...toasts.value, toast];
  if (typeof window !== 'undefined') {
    const handle = setTimeout(() => dismiss(id), TOAST_TTL_MS);
    timers.set(id, handle);
  }
};

export const useToasts = (): {
  toasts: Readonly<Ref<readonly Toast[]>>;
  addToast: (message: string, action?: ToastAction) => void;
  dismiss: (id: string) => void;
} => ({
  toasts: toasts as Readonly<Ref<readonly Toast[]>>,
  addToast,
  dismiss,
});
