import { defineConfig } from 'tsup';

// Bundle the API (including @contest/shared, which is consumed as TypeScript source)
// into a single ESM file. Native/optional modules stay external and are installed
// in the runtime image.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  noExternal: ['@contest/shared'],
  external: [
    'sharp',
    'postgres',
    'pino',
    'pino-http',
    'express',
    'multer',
    'helmet',
    'cors',
    'express-rate-limit',
    'drizzle-orm',
    'zod',
  ],
});
