// Consumed by `npm run db:generate`, which fetches drizzle-kit on demand rather
// than installing it: drizzle-kit pins an esbuild version Vite rejects, and the
// generated SQL under drizzle/ is committed, so nothing else needs the tool.
// Typed loosely for that reason; drizzle-kit validates the shape when it runs.
export default {
  $schema: 'https://json.schemastore.org/drizzle.config.json',
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://contest:contest@localhost:5432/contest',
  },
  strict: true,
  verbose: true,
};
