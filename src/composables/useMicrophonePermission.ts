export type MicrophoneAccess = 'granted' | 'denied' | 'unsupported';

/**
 * Request microphone access via getUserMedia. SpeechRecognition on Chromium
 * relies on the same permission; calling this on a user gesture surfaces the
 * browser prompt when policy allows it.
 */
export const ensureMicrophoneAccess = async (): Promise<MicrophoneAccess> => {
  if (typeof navigator === 'undefined') return 'unsupported';

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      if (status.state === 'denied') return 'denied';
    } catch {
      // Permissions API unsupported for microphone - fall through to gUM.
    }
  }

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) return 'unsupported';

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      return 'denied';
    }
    return 'denied';
  }
};

export const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
};

export const isAndroidMobile = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};
