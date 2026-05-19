import type { App } from 'vue';
import type { Router } from 'vue-router';

const FILTERED_FRAGMENTS = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/popup-blocked',
  'firestore/unavailable',
  'unavailable',
  'failed-precondition',
  'networkerror',
  'load failed',
  'failed to fetch',
];

interface SentryExceptionValue {
  value?: string;
  type?: string;
}

export interface SentryEventLike {
  exception?: { values?: SentryExceptionValue[] };
  message?: string;
}

export const shouldFilterEvent = (event: SentryEventLike | null | undefined): boolean => {
  if (!event) return false;
  const head = event.exception?.values?.[0];
  const haystack = [event.message ?? '', head?.value ?? '', head?.type ?? '']
    .join(' ')
    .toLowerCase();
  return FILTERED_FRAGMENTS.some((fragment) => haystack.includes(fragment));
};

export const initSentry = async (app: App, router?: Router): Promise<boolean> => {
  const dsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
  if (!import.meta.env.PROD || !dsn) {
    return false;
  }

  const Sentry = await import('@sentry/vue');

  Sentry.init({
    app,
    dsn,
    release:
      (import.meta.env['VITE_RELEASE'] as string | undefined) ??
      (import.meta.env['VITE_GIT_SHA'] as string | undefined) ??
      undefined,
    environment: 'production',
    integrations: [
      Sentry.browserTracingIntegration(router ? { router } : {}),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    beforeSend(event) {
      return shouldFilterEvent(event as SentryEventLike) ? null : event;
    },
  });

  return true;
};
