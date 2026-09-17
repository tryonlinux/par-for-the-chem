# Par for the Chem ⚗️⛳

A golf-style chemistry puzzle. Each of nine holes is a scrambled grid of element
tiles with a compound named beside every row and column: *Water*, *Table salt*,
*Stomach acid*. Swap neighbours until every line holds exactly its compound's atoms,
with blanks in the leftover cells. Every swap is a stroke. Fewest strokes wins.

Live at **[parchem.tryonlinux.com](https://parchem.tryonlinux.com)**.

A sibling of [Par for the Curve](https://par.tryonlinux.com) and
[ChemMove](https://chemmove.tryonlinux.com). No build step, no dependencies, no
framework: static files served by a Cloudflare Worker.

## Playing

| | |
|---|---|
| **A swap** | 1 stroke. Swapping two identical tiles is refused for free. |
| **Line status** | Green: made. Gold: one tile away (toggle "Near misses" off for a harder round). Made lines show their formula. |
| **Clue** | Tap a name: atom and blank counts plus a fact. Free. |
| **Peek** | Reveal a compound's formula for this hole. +1 stroke each. |
| **Reset tiles** | Puts the hole back how it started. Strokes already taken still count. |
| **Pick up** | Shows the solution and scores `max(strokes + 1, par + 5)`. |

Nine holes: three 3×3, three 4×4 and three 5×5. The scorecard marks birdies with a
circle and bogeys with a square, and any hole can be opened from it.

### Courses

- **Daily**: the same nine holes for everyone on a given date. The first finish counts.
- **Random**: a fresh course with a shareable code, e.g. `?c=K3F9QZ`.

Progress, settings, the notebook of compounds made and finished rounds live in
`localStorage` under `parchem:v1:`. Nothing leaves the browser.

## How holes are built

1. **Grid.** Rows are dealt compounds (weighted toward bigger ones) and their atoms
   are shuffled into place, then a local search swaps atoms within rows and redeals
   rows until every column is also a real compound. No compound repeats among the
   rows or among the columns. Requiring all 2n to differ would leave only 8 possible
   3×3 grids; this rule allows 349.
2. **Scramble.** The solved grid gets `mix` random neighbour swaps (2 on hole 1, up
   to 7 on hole 9). The best of up to eight scrambles is kept.
3. **Par.** An iterative-deepening search finds the fewest swaps back to *any*
   solved grid, not just the original. A sideways swap only changes two columns and
   an up-down swap only two rows, so half the broken rows plus half the broken
   columns (rounded up) is a lower bound that keeps the search small. Par is that
   minimum.

Generating a course takes about 90 ms on a laptop. A year of daily courses checked in
Node gave 3,258 distinct holes out of 3,285, with course par 36 to 38.

## Layout

```
public/
  index.html          markup, dialogs, meta/OG tags, JSON-LD
  404.html            "out of bounds" page
  game.js             compounds, hole generation, par search, scoring, rendering, persistence
  style.css           theming (light/dark), board, scorecard, dialogs
  _headers            CSP and security headers, cache policy
  robots.txt, sitemap.xml, site.webmanifest
  favicon.svg         source icon; apple-touch-icon and icon-192/512 are rendered from it
  og-image.svg/.png   social card source and the 1200×630 PNG that ships
wrangler.jsonc        Cloudflare Worker static-asset config
```

The CSP is `'self'` only, with no `unsafe-inline`. There are no inline scripts,
styles or `style="..."` attributes; dynamic styling goes through
`el.style.setProperty`.

To re-render the PNGs after editing an SVG:

```sh
printf '<body style="margin:0">' > /tmp/og.html && cat public/og-image.svg >> /tmp/og.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --screenshot=public/og-image.png --window-size=1200,630 --hide-scrollbars file:///tmp/og.html
```

The icons are rendered the same way from `favicon.svg` on a `#0e8f7e` background, at
180, 192 and 512 px.

## Running it

```sh
npx wrangler dev          # or: python3 -m http.server -d public 8765
```

## Deploying

```sh
npx wrangler deploy
```

The `routes` entry binds `parchem.tryonlinux.com` as a custom domain, which requires
`tryonlinux.com` to be an active zone on the same Cloudflare account.

Changing `COMPOUNDS`, `COURSE`, `buildGrid`, `makeHole` or the RNG changes every
course. Saved holes whose tiles no longer match are discarded on load, but bump
`PREFIX` in `game.js` anyway to keep old rounds from mixing with new ones.
