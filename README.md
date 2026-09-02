# Contest

The app the party runs on. Guests submit a dish or drink with a photo, rate every
entry with stars, and nominate their favourites for special awards. The host
unlocks a results area to see rankings, award tallies and to set the contest up.

The contest itself is data, not code. Categories, the rating criteria inside each
category, the awards and the event branding are all edited in the app, so a new
category or a new award never needs a deploy.

## How it fits together

| Piece             | What it is                                                           |
| ----------------- | -------------------------------------------------------------------- |
| `apps/web`        | Vite + React 19 + Tailwind 4, mobile-first, served by nginx          |
| `apps/api`        | Express 5 + Drizzle on Postgres 17, photos stored on disk            |
| `packages/shared` | Zod schemas, the types inferred from them, and the scoring functions |
| `deploy/`         | The compose stack Dockhand tracks on Unraid                          |

`packages/shared` is the reason the two halves cannot drift: the API validates
requests with the same schemas the web app compiles against, and both decide
"is this vote finished?" and "who won?" with the same functions.

## Running it locally

Requires Node 22 (`.nvmrc`) and Docker for the database.

```bash
npm ci

# Start Postgres on :5432
docker compose -f deploy/docker-compose.yml up -d db

cp apps/api/.env.example apps/api/.env    # then set ADMIN_PASSWORD
npm run dev                               # API on :3001, web on :5173
```

The API applies its migrations and seeds a default contest on first start, so
`http://localhost:5173` is usable immediately. The admin area is at `/admin`.

To run the whole stack in containers exactly as the server does:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/compose.build.yml up --build
```

## Checks

```bash
npm run lint         # ESLint across every workspace
npm run typecheck    # tsc per package
npm test             # Vitest: shared logic, API against in-process Postgres, React components
npm run build
```

API tests run the real migrations against PGlite, an in-process Postgres, so
they need no database and no Docker.

## Changing the contest

Everything below is done in the app, under **Results → Setup**, and takes effect
for guests within a minute.

- **Add a category**: name it and give it an emoji, then add its criteria. Each
  category is scored only on its own criteria.
- **Add a criterion**: it appears as another row of stars on that category's
  cards. If people have already rated, their ratings become part-finished until
  they revisit the entry, and the setup screen says so before you do it.
- **Add an award**: name it, describe what guests should look for, and pick
  which categories are eligible. Selecting none means every category. Each
  guest nominates one entry per award, separately from the star ratings.
- **Hide instead of delete**: hiding keeps the data and removes the item from
  the guest view. Deleting is refused once something has been rated or
  nominated, and the app tells you to hide it instead.
- **Close voting** with the toggle after the awards, which freezes entries,
  ratings and nominations.

Retheming for next year is one file: the color and font tokens in
`apps/web/src/styles/index.css`.

## How scoring works

- A vote counts toward a ranking only when every **active** criterion of that
  entry's category has a star. Part-finished ratings are shown to the host
  separately and never distort an average.
- A category ranking is the weighted mean of that entry's criterion averages.
  Entries with the same score and the same number of votes share a rank.
- Awards are a straight count of nominations. A tie is reported as a tie rather
  than broken arbitrarily.

Deactivating a criterion is always safe: completeness is judged against active
criteria only, so part-finished ratings become complete again.

## Deploying

See [`deploy/README.md`](deploy/README.md). In short: pushing to `main` builds
both images, publishes them to GHCR, and asks Dockhand to redeploy.
