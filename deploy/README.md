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
| `STACK_NAME`          | Defaults to `contest`; unique per event (below)    |
| `IMAGE_TAG`           | Defaults to `latest`; `event-<slug>` for an event  |
| `THEME`               | `christmas` (default), `halloween`, or your own    |

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

## Running a second event

Each event gets its own branch, its own images and its own Dockhand stack with
its own database, so two parties never share guests, votes or photos.

1. **Start from an up-to-date `main`.** Fixes made on `main` reach an event only
   when you merge them into its branch (step 6).

2. **Create the branch.** The slug becomes part of image tags, container names
   and folders: lowercase letters, digits and dashes.

   ```bash
   git checkout main && git pull
   git checkout -b event/<slug>
   git push -u origin event/<slug>
   ```

   The Release workflow publishes `contest-now-api:event-<slug>` and
   `contest-now-web:event-<slug>`. Only `main` moves `latest`, and only `main`
   calls `DOCKHAND_WEBHOOK_URL`, so this never redeploys the first event.

3. **Change the event's copy on that branch.** The intro, the Details rows
   (attire, drinks, activities) and the rules are written in
   `apps/web/src/components/event/EventDetails.tsx`. Search the web app for the
   old event's name for anything else. Commit and push; Release rebuilds the
   `event-<slug>` images.

4. **Add a second Dockhand Git stack.** Same repository and compose file
   (`deploy/docker-compose.yml`), branch `event/<slug>`. Set:

   | Variable                                                    | Value                                                           |
   | ----------------------------------------------------------- | --------------------------------------------------------------- |
   | `STACK_NAME`                                                | `<slug>`: names the containers and network                      |
   | `IMAGE_TAG`                                                 | `event-<slug>`                                                  |
   | `APPDATA_PATH`                                              | `/mnt/user/appdata/contest-<slug>`: never reuse another event's |
   | `WEB_PORT`                                                  | A free port, e.g. `3100`                                        |
   | `PUBLIC_URL`                                                | The new address, e.g. `https://<sub>.example.com`               |
   | `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` | New values, not copies of the first event's                     |
   | `SMTP_*`, `MAIL_FROM`                                       | The same mailbox is fine                                        |
   | `THEME`                                                     | The look for this party, e.g. `halloween` (below)               |

   Deploy. The API creates a fresh database and seeds the default contest.

5. **Point a hostname at it** in your reverse proxy (`<sub>.example.com` →
   `<unraid-host>:3100`, same TLS settings as the first event), then check
   `curl https://<sub>.example.com/api/health`. Open `/admin` → **Setup** and
   set the event name, date, location, categories and FAQ; those live in the
   database, not the branch.

6. **Bring fixes across** from `main` when you want them, then redeploy the
   event's stack in Dockhand:

   ```bash
   git checkout event/<slug> && git merge main && git push
   ```

When the event is over, back it up (below, with `<slug>-db` as the container
and its `APPDATA_PATH`), delete its stack in Dockhand, and keep or delete the
branch.

## Themes

`THEME` picks the colors and heading font. It is read when the web container
starts, so switching is a variable change and a restart, never a rebuild, and two
events on the same images can look different.

- **Built in:** `christmas` (the default) and `halloween`, from
  [`apps/web/themes`](../apps/web/themes).
- **Your own:** copy one of those files to `${APPDATA_PATH}/themes/<name>.css` on
  the server, change the values, and set `THEME=<name>`. A file there wins over a
  built-in theme of the same name, so you can also tweak `christmas` in place.

A misspelt or missing theme does not take the site down: the web container logs
`theme: no theme named …` with the names it found and uses the default.

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
