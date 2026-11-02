# Almost Universal

An interactive archive of pictograms and symbol systems: an explore map, a deconstruction view,
and Saved, History, Index and Timeline pages. Plain HTML, CSS and JavaScript, with no build step.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup |
| `style.css` | All styles, plus the `@font-face` rules and design tokens at the top |
| `app.js` | All behaviour (core, symbols, map, views, lists, panels, main) |
| `data.js` | The symbol data, loaded as `window.SYMBOLS_DATA` |
| `fonts/` | WOFF2 files for NewEdge666 Test and PP Mori |

## Run

Open `index.html` in a browser, or serve the folder (`python3 -m http.server`).

## Publish with GitHub Pages

Push these files to a repository, then go to **Settings > Pages**, choose the `main` branch and
the `/ (root)` folder, and save.

## Fonts

NewEdge666 Test is a trial cut and PP Mori is a commercial font. Get web licences before
publishing publicly, or remove `fonts/` and the `@font-face` rules to fall back to system fonts.
