# Deploying to Unraid with Dockhand

Images are built by GitHub Actions and published to GHCR. The server only pulls
them, so nothing compiles on Unraid.

`deploy/docker-compose.yml` is the **server** stack: it stores data on the Unraid
appdata share and deliberately leaves Postgres unpublished, reachable only by the
other containers. Do not run it for day-to-day development — use the root
`compose.yaml` instead (see the main [README](../README.md)).

## One-time setup

**1. Make the packages readable.** After the first successful run of the Release
workflow, two packages appear under your GitHub profile: `contest-now-api` and
`contest-now-web`. Open each one's settings and set visibility to public, or
give Dockhand a registry login with a personal access token that has
`read:packages`. Public is simpler and the images contain no secrets.

**2. Create the stack in Dockhand.** Add a Git stack pointing at this
repository with the compose file path `deploy/docker-compose.yml`, and pick the
branch you deploy from (`main`).

**3. Set the variables.** From `deploy/.env.example`, at minimum:

| Variable              | Notes                                              |
| --------------------- | -------------------------------------------------- |
| `ADMIN_PASSWORD`      | Unlocks the host area at `/admin`                  |
| `POSTGRES_PASSWORD`   | Any long random string; only the containers see it |
| `BETTER_AUTH_SECRET`  | 32+ random characters; signs guest sign-in cookies |
| `PUBLIC_URL`          | The address guests open; emailed links point here  |
| `SMTP_*`, `MAIL_FROM` | Optional email for RSVP links and invites          |
| `APPDATA_PATH`        | Defaults to `/mnt/user/appdata/contest-now`        |
| `WEB_PORT`            | Defaults to `3099`                                 |
| `GITHUB_OWNER`        | The account the images were published under        |

> **Dockhand secrets caveat.** On Git stacks without a committed `.env`,
> Dockhand versions before 1.0.14 could inject variables marked as _secret_ as
> the literal string `***` (Finsys/dockhand issue #365). If the API logs a
> Postgres authentication failure right after deploy, either update Dockhand or
> enter these as regular variables rather than secrets.

**4. Deploy.** Dockhand pulls the images and starts three containers: `db`,
`api` and `web`. The API waits for Postgres to report healthy, applies its
migrations, seeds a default contest, and only then starts answering requests.

**5. Automate redeploys (optional).** Copy the stack's webhook URL from Dockhand
and add it to this repository under Settings → Secrets → Actions as
`DOCKHAND_WEBHOOK_URL`. The Release workflow calls it _after_ both images are
published. Pointing GitHub's own webhook at Dockhand instead would fire when the
push lands, before the images exist, and redeploy the previous build.

## Checking a deploy

```bash
curl -s http://<unraid-host>:3099/api/health
# {"status":"ok","db":"ready","version":"<commit sha>"}
```

`version` is the commit the running image was built from. `status` is
`starting` while migrations run and `error` if the database never became
reachable.

## Starting over

The migration history was squashed into a single `0000_initial` when guests and
RSVPs arrived, so a database created by an earlier build will not upgrade. There
was no data in it yet; wipe it once and let the API create a fresh one:

1. Stop the stack in Dockhand.
2. Delete `${APPDATA_PATH}/db` on the server (uploaded photos in `uploads/` can stay or go).
3. Redeploy. The API applies the migration and seeds the default contest.

The same steps reset the party for next year: back up first (below) if you want to keep the results.

## Backups

Both the database and the photos matter. The photos are not in the database.

```bash
# Database
docker exec contest-db pg_dump -U contest contest > contest-$(date +%F).sql

# Photos
tar czf contest-uploads-$(date +%F).tar.gz -C /mnt/user/appdata/contest-now uploads
```

Restore into a fresh stack with `psql -U contest contest < contest-<date>.sql`
after the containers have started once, then unpack the uploads archive back
into `${APPDATA_PATH}/uploads`.

## Party-day checklist

1. Open `/admin`, unlock, and go to **Setup**. Set the event name and tagline,
   add a photo album link if you have one, and confirm the categories,
   criteria and awards you want.
2. Check **Voting is open** is on.
3. Share the URL. Guests land on Submit; the bottom tabs take them to Vote.
4. Watch **Results** during the evening. Part-finished ratings are flagged per
   entry, so you can nudge guests to finish rating.
5. After the awards, turn **Voting is open** off to freeze everything.

## Pinning or rolling back

Every build is also tagged `sha-<short commit>`. To pin, set `IMAGE_TAG` to that
value in Dockhand and redeploy; set it back to `latest` afterwards.
