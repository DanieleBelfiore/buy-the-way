import { describe, it, expect, vi, beforeEach } from 'vitest';

const back = vi.fn();
const push = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ back, push }),
}));

import {
  installSafeBackTracker,
  useSafeBack,
  __resetSafeBackForTests,
} from '@/composables/useSafeBack';

describe('useSafeBack', () => {
  beforeEach(() => {
    __resetSafeBackForTests();
    vi.clearAllMocks();
  });

  it('pushes the fallback when there is no in-app history', () => {
    const safeBack = useSafeBack();
    safeBack({ name: 'lists' });
    expect(push).toHaveBeenCalledWith({ name: 'lists' });
    expect(back).not.toHaveBeenCalled();
  });

  it('calls router.back after an in-app navigation was committed', () => {
    const router = {
      afterEach: (fn: (to: unknown, from: { name?: string }) => void) => {
        fn({}, { name: 'lists' });
      },
    };
    installSafeBackTracker(router as any);

    const safeBack = useSafeBack();
    safeBack({ name: 'lists' });
    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores the synthetic start location when counting navs', () => {
    const router = {
      afterEach: (fn: (to: unknown, from: { name?: string }) => void) => {
        fn({}, { name: undefined });
      },
    };
    installSafeBackTracker(router as any);

    const safeBack = useSafeBack();
    safeBack({ name: 'home' });
    expect(push).toHaveBeenCalledWith({ name: 'home' });
  });
});
