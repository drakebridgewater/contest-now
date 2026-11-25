import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node 25+ has its own localStorage and sessionStorage globals, which are undefined unless
// node runs with --localstorage-file. They win over jsdom's, so point them back at jsdom's
// (Vitest exposes the JSDOM instance as a global; tests in the node environment have none).
declare const jsdom: { window: Pick<Window, 'localStorage' | 'sessionStorage'> } | undefined;
if (typeof jsdom !== 'undefined') {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: jsdom.window[key],
    });
  }
}

afterEach(() => {
  cleanup();
});
