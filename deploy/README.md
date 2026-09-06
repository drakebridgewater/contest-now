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

| Variable            | Notes                                              |
| ------------------- | -------------------------------------------------- |
| `ADMIN_PASSWORD`    | Unlocks the host area at `/admin`                  |
| `POSTGRES_PASSWORD` | Any long random string; only the containers see it |
| `APPDATA_PATH`      | Defaults to `/mnt/user/appdata/contest-now`        |
| `WEB_PORT`          | Defaults to `3099`                                 |
| `GITHUB_OWNER`      | The account the images were published under        |

> **Dockhand secrets caveat.** On Git stacks without a committed `.env`,
> Dockhand versions before 1.0.14 could inject variables marked as _secret_ as
> the literal string `***` (Finsys/dockhand issue #365). If the API logs a
> Postgres authentication failure right after deploy, either update Dockhand or
> enter these as regular variables rather than secrets.

**4. Deploy.** Dockhand pulls the images and starts three containers: `db`,
`api` and `web`. The API waits for Postgres to report healthy, applies its
migrations, seeds a default contest, and only then starts answering requests.

Nothing to do about the uploads directory. Docker creates a missing bind-mount
source as `root`, and the ownership a mount has on the host replaces whatever
the image set, so the API's entrypoint starts as root, takes ownership of
`/data/uploads`, and drops to its unprivileged `app` user before the server
runs. It only touches the ownership when it is already wrong, so restarts do
not walk the whole photo directory.

**5. Automate redeploys (optional).** Copy the stack's webhook URL from Dockhand
and add it to this repository under Settings → Secrets → Actions as
`DOCKHAND_WEBHOOK_URL`. The Release workflow calls it _after_ both images are
published. Pointing GitHub's own webhook at Dockhand instead would fire when the
push lands, before the images exist, and redeploy the previous build.

## Checking a deploy

```bash
curl -s http://<unraid-host>:3099/api/health
# {"status":"ok","db":"ready","uploads":"ready","version":"<commit sha>"}
```

`version` is the commit the running image was built from. `status` is
`starting` while migrations run, `error` if the database never became
reachable, and `degraded` if the app is serving but something is wrong — check
`db` and `uploads` for which. A degraded API answers `/api/health` with a 503,
so the container shows unhealthy rather than looking fine until someone tries
to use the broken part.

`uploads: "unwritable"` means photo submissions will fail: the API cannot write
to `${APPDATA_PATH}/uploads`. Voting and results are unaffected. The container
takes ownership of that directory at start-up, so this should heal itself on a
restart; if it does not, the mount is being held by something else:

```bash
docker logs contest-api | grep uploads
docker exec -u 0 contest-api chown -R app:app /data/uploads && docker restart contest-api
```

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
