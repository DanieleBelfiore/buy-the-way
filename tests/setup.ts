// Vitest global setup. Add jsdom polyfills, mocks, or test helpers here.
import { config } from '@vue/test-utils';

config.global.mocks = {};
config.global.stubs = {
  RouterLink: true,
  RouterView: true,
};
