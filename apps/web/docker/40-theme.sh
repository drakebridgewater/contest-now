#!/bin/sh
# Runs from the nginx image's /docker-entrypoint.d before nginx starts.
#
# Copies the theme named by THEME over /theme.css, the stylesheet index.html
# loads after the app's own. A file in /themes (mounted from the server) wins
# over a built-in one of the same name. An unknown or malformed name falls back
# to the default and says so, rather than leaving the party without a site.
#
# index.html then links /theme.css?v=<checksum>, so a theme switch reaches
# browsers at once even when a CDN in front (Cloudflare) rewrites no-cache on
# the stylesheet into hours of browser caching. index.html itself is no-store.
set -eu

default=christmas
theme="${THEME:-$default}"
html=/usr/share/nginx/html
target="$html/theme.css"
builtin=/usr/share/contest/themes
custom=/themes

find_theme() {
  for dir in "$custom" "$builtin"; do
    if [ -f "$dir/$1.css" ]; then
      echo "$dir/$1.css"
      return
    fi
  done
}

source=""
case "$theme" in
  '' | *[!a-z0-9-]*)
    echo "theme: THEME must be lowercase letters, digits and dashes, got '$theme'; using $default" >&2
    ;;
  *)
    source=$(find_theme "$theme")
    if [ -z "$source" ]; then
      available=$(ls "$custom"/*.css "$builtin"/*.css 2>/dev/null | sed 's#.*/##; s#\.css$##' | sort -u | tr '\n' ' ' | sed 's/ $//')
      echo "theme: no theme named '$theme' (available: ${available}); using $default" >&2
    fi
    ;;
esac
# Always copy, so a restart after a bad THEME never keeps the previous theme.
[ -n "$source" ] || source="$builtin/$default.css"
cp "$source" "$target"
echo "theme: using $source"

version=$(cksum < "$target" | cut -d' ' -f1)
sed -i "s#/theme\.css[^\"]*\"#/theme.css?v=$version\"#" "$html/index.html"
