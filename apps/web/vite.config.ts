import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const DEFAULT_THEME = 'christmas';

/**
 * Serves apps/web/themes/<THEME>.css as /theme.css. In dev it is read on every request,
 * so editing a theme needs only a reload. A build ships the default theme under that name;
 * the web container overwrites it at start-up from its own THEME (docker/40-theme.sh).
 */
function theme(): Plugin {
  const read = () => {
    const name = process.env.THEME || DEFAULT_THEME;
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`THEME must be lowercase letters, digits and dashes, got '${name}'`);
    }
    return readFileSync(new URL(`./themes/${name}.css`, import.meta.url), 'utf8');
  };
  return {
    name: 'contest-theme',
    configureServer(server) {
      server.middlewares.use('/theme.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(read());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme.css', source: read() });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), theme()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
  build: {
    sourcemap: true,
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
