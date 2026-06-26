import { watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';

/**
 * Traps keyboard focus inside an open modal dialog and restores it on close.
 * Pairs with `useModalBack` (which owns the hardware-back / history side).
 *
 * On open: remembers the element that had focus (the trigger), then moves
 * focus to the first focusable child of `containerRef` (or the container
 * itself when it has none). Tab / Shift+Tab cycle within the container.
 * On close (or unmount while open): focus returns to the remembered trigger.
 *
 * Stacked modals coexist: each instance only reacts to Tab while focus is
 * already inside ITS container, so an inner sheet opened over an outer one
 * keeps the cycle without the outer trap stealing focus back.
 *
 * Visibility note: jsdom computes no layout, so we filter by `tabIndex >= 0`
 * and the `hidden` attribute rather than `offsetParent`. Permanently rendered
 * but visually-hidden controls (e.g. the file inputs in ItemEditSheet) must
 * carry `tabindex="-1"` so they are excluded here too.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].join(',');

const focusablesWithin = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('hidden'),
  );

export const useFocusTrap = (
  isOpen: Ref<boolean>,
  containerRef: Ref<HTMLElement | null>,
): void => {
  let previouslyFocused: HTMLElement | null = null;

  const restoreFocus = (): void => {
    const target = previouslyFocused;
    previouslyFocused = null;
    if (target && typeof target.focus === 'function' && document.contains(target)) {
      target.focus();
    }
  };

  const focusFirst = async (): Promise<void> => {
    await nextTick();
    const container = containerRef.value;
    if (!container) return;
    const focusables = focusablesWithin(container);
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container.focus();
    }
  };

  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const container = containerRef.value;
    if (!container) return;
    const active = document.activeElement as HTMLElement | null;
    // A stacked (inner) trap owns focus - let it handle the cycle.
    if (!container.contains(active)) return;

    const focusables = focusablesWithin(container);
    if (focusables.length === 0) {
      e.preventDefault();
      container.focus();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const activate = (): void => {
    previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', onKeydown, true);
    void focusFirst();
  };

  const deactivate = (): void => {
    document.removeEventListener('keydown', onKeydown, true);
    restoreFocus();
  };

  watch(isOpen, (open) => {
    if (open) activate();
    else deactivate();
  });

  onMounted(() => {
    if (isOpen.value) activate();
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown, true);
    restoreFocus();
  });
};
