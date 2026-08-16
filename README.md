# TVmine 🍃

A Ghibli-flavored personal watch tracker, hosted as a static GitHub Pages site.
The library is edited **offline** with a small CLI tool; the website just displays it.

## The site

Open `index.html` in a browser (or serve the folder with `python3 -m http.server`).

- **No scrolling** — everything fits one screen: an auto-scrolling poster river
  fills the viewport (hover a lane to pause it, click a poster for details)
- Two big buttons over the river — **To Watch** and **Watched** — open a
  center-stage panel; the river keeps flowing around its edges
- Currently-watching shows float in an always-visible strip with progress bars
- Panels have TV/Films + genre filters; the topbar has live search (searching
  with no panel open opens a search panel across the whole library)
- Panels can sort by Duration or Year (click again to flip direction; TV counts
  as total watch time). Duration chips only show while duration sort is active
- Four view modes (top-right) apply inside panels: grid · list · shelf · timeline
- Watched is sorted by score, To Watch by date added; Esc closes panels/popups
- Titles without a downloaded cover get a unique painted placeholder landscape
- Watching items never show a score — no verdict until the story ends

## Managing the library

`library.json` is the source of truth. `tvmine.py` edits it and regenerates
`data.js` (which the site reads). Never edit `data.js` by hand.

One-time setup — get a free API key at <https://www.themoviedb.org/settings/api>, then:

```sh
echo "YOUR_KEY" > .tmdb_key        # or: export TMDB_API_KEY=YOUR_KEY
```

Everyday use:

```sh
./tvmine.py add "Frieren" --score 9.5 --status watching --progress 1:21/28
./tvmine.py add "Perfect Days" --type movie --notes "rainy day pick"
./tvmine.py update frieren --score 10 --status watched   # stamps today's date
./tvmine.py update severance --progress 2:5/10
./tvmine.py remove the-bear-s3
./tvmine.py list
./tvmine.py regen        # rebuild data.js from library.json
./tvmine.py check        # scan the library for duplicate entries
```

`add` searches TMDB, lets you pick the right match, downloads the cover into
`covers/`, and fills in year/genres/synopsis automatically. Use `--first` to
skip the picker. Statuses: `watching` · `towatch` · `watched`.
Progress format is `season:episode/episodesInSeason`.

**Scoring implies watched** — `add "The Substance" --score 9` goes straight
into Watched (no `--status` needed), and scoring an existing entry with
`update` moves it to Watched and stamps today's date. An explicit `--status`
always wins.

**Duplicate protection** — `add` refuses anything already in the library
(matched by TMDB id, or by title + type for entries that lack one) and points
you at `update` instead; interactively it asks, with `--first` it just refuses,
and `--again` overrides. Every save also warns if the library contains
look-alike entries — `./tvmine.py check` lists them (useful after hand-editing
`library.json`).

## Files

| file | role |
|---|---|
| `index.html` `styles.css` `app.js` | the website |
| `library.json` | your library (source of truth) |
| `data.js` | generated from `library.json` — do not edit |
| `covers/` | downloaded poster art |
| `tvmine.py` | offline library tool (stdlib only, Python 3.8+) |
| `.tmdb_key` | your TMDB API key — **do not commit this** |

## Publishing

Push the folder to a GitHub repo, then Settings → Pages → deploy from the
main branch root. Add `.tmdb_key` to `.gitignore` first.
