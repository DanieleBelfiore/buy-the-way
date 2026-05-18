export {};

declare global {
  interface Window {
    __btw?: {
      signIn: (email: string, displayName: string) => Promise<string>;
      signOut: () => Promise<void>;
      currentUid: () => string | null;
    };
  }
}
