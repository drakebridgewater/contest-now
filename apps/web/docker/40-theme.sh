#!/bin/sh
# Runs from the nginx image's /docker-entrypoint.d before nginx starts.
#
# Copies the theme named by THEME over /theme.css, the stylesheet index.html
# loads after the app's own. A file in /themes (mounted from the server) wins
# over a built-in one of the same name. An unknown or malformed name keeps the
# built-in default and says so, rather than leaving the party without a site.
set -eu

theme="${THEME:-christmas}"
target=/usr/share/nginx/html/theme.css
builtin=/usr/share/contest/themes
custom=/themes

case "$theme" in
  '' | *[!a-z0-9-]*)
    echo "theme: THEME must be lowercase letters, digits and dashes, got '$theme'; using the default" >&2
    exit 0
    ;;
esac

for dir in "$custom" "$builtin"; do
  if [ -f "$dir/$theme.css" ]; then
    cp "$dir/$theme.css" "$target"
    echo "theme: using $dir/$theme.css"
    exit 0
  fi
done

available=$(ls "$custom"/*.css "$builtin"/*.css 2>/dev/null | sed 's#.*/##; s#\.css$##' | sort -u | tr '\n' ' ' | sed 's/ $//')
echo "theme: no theme named '$theme' (available: ${available}); using the default" >&2
