# Themes

One CSS file per look. The `THEME` environment variable picks one by file name:
`THEME=halloween` uses `halloween.css`. Names are lowercase letters, digits and
dashes.

| Theme       | Look                                                             |
| ----------- | ---------------------------------------------------------------- |
| `christmas` | Cranberry red and pine green (the default)                       |
| `halloween` | Pumpkin orange and potion purple, dusky page, Creepster headings |

## Making your own

Copy `christmas.css`, which lists every token the app reads with a note on what
each one colors, and change the values. Anything you leave out keeps the
Christmas value. A test fails on a token the app does not read, so a typo
cannot slip through silently.

- **On the server**, put the file in `${APPDATA_PATH}/themes/<name>.css`, set
  `THEME=<name>` and restart the web container. No rebuild, no commit. A file
  there wins over a built-in theme of the same name.
- **In this repository**, add it here and it ships in the image for everyone.

Keep the `600` and `700` brand shades dark enough for white text on top: they
sit under buttons and the header. `--app-background` takes any CSS background,
so a theme can also layer in a pattern or a `url(...)` image.

**Fonts.** `--font-display` sets the headings (event name and section titles,
never body text). To use a web font, put the `.woff2` in `apps/web/public/fonts`,
declare it with `@font-face` at the top of the theme pointing at
`/fonts/<file>.woff2`, and name it first in `--font-display` with fallbacks after
it. `halloween.css` is the worked example. Keep the font's license file next to
it. Google Fonts' `@import url(...)` also works, at the cost of every guest's
browser calling Google.

Only the look lives here. The event's words (the intro, attire, rules) are in
`apps/web/src/components/event/EventDetails.tsx`, per event branch.

## How it works

`index.html` loads `/theme.css` after the app's stylesheet. The app's own
tokens sit inside Tailwind's `@layer theme`, and a theme file's `:root` is
outside any layer, so the theme wins whatever order the files load in.

- **Container:** `apps/web/docker/40-theme.sh` runs as nginx starts and copies
  `/themes/<THEME>.css` (the server mount) or the built-in file over
  `/theme.css`. An unknown name logs the available ones and uses the default.
  It then points `index.html` at `/theme.css?v=<checksum>`, so a switch
  reaches browsers immediately even through a CDN that caches stylesheets
  for hours whatever nginx says (Cloudflare does).
- **Dev:** Vite serves `themes/<THEME>.css` at `/theme.css` on every request:
  `THEME=halloween npm run dev`, and edits show on reload.
