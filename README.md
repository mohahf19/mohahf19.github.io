# mohahf19.github.io

My website: a traveller rides a camel through the road so far, from Bilkent to EPFL to QuantCo, and back to the campfire.

## Editing

- **`assets/story.js`** holds all the text: the stops on the road, what each dialog says, and the extra entries at the bottom of the journal. This is the only file to touch when the CV changes.
- `assets/caravan.js` is the engine: the camel, the scenery at each stop (search for `SCENES`), the minimap (`WHERE` says which city each stop happened in), the telescope.
- `assets/caravan.css` styles the dialog boxes, buttons, map and journal.

Adding a stop means adding an entry to `stops` in `story.js`, a city to `WHERE` in `caravan.js`, and optionally props under `SCENES`.

## Links

- `/#journal` opens the journal (the whole CV, no animation).
- `/#at=4` starts at a stop (0 is the camp).
- `/#lens` opens the telescope.

## Preview locally

```sh
python3 -m http.server 8000
```

then open http://localhost:8000. The site is plain HTML, CSS and JavaScript; there is no build step, and `.nojekyll` tells GitHub Pages to serve it as is.
