#!/bin/sh
# Runs as root purely to fix up the uploads volume, then hands the server to the
# unprivileged app user and gets out of the way.
#
# UPLOADS_DIR is a mounted volume, so whatever ownership it has on the host
# replaces what the image gave it — and Docker creates a missing bind-mount
# source as root. The image's own chown cannot reach it; only this can, at run
# time, once the mount is actually there.
set -eu

if [ "$(id -u)" = '0' ]; then
  mkdir -p "$UPLOADS_DIR"
  # Ownership only, and only when it is already wrong: on a volume with a lot of
  # photos this walks every file, and there is no reason to do that every start.
  if [ "$(stat -c '%u:%g' "$UPLOADS_DIR")" != "$(id -u app):$(id -g app)" ]; then
    echo "entrypoint: taking ownership of $UPLOADS_DIR for the app user" >&2
    chown -R app:app "$UPLOADS_DIR"
  fi
  exec su-exec app "$@"
fi

# Already unprivileged: someone set `user:` in compose, so leave the mount alone
# and let the start-up probe report it if the write does not work.
exec "$@"
