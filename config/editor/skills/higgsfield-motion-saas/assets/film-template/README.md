# Film template
Copy this folder to `<project>/film/`, then (S = skill dir):
```bash
source $S/scripts/code/env.sh
$S/scripts/code/stills.sh film/index.html stills/check 0.3,1.2,1.6,2.9     # look at stills/check/sheet.jpg
"$NODE" $S/scripts/code/capture.mjs film/index.html /tmp --qa              # zoom direction across cuts
$S/scripts/code/render_film.sh film/index.html film/draft.mp4 1 8          # draft, no blur
LENS=1 $S/scripts/code/render_film.sh film/index.html film/final.mp4 4 8 16 "1.2-1.9"
```
`engine.js` is the engine (API in its header and in `references/code-engine.md`); `scenes/s1_hook.js` and `scenes/s2_reveal.js` are a
working example of a needle INTO a button with the next shot continuing forward and the background flooding from the button.
Replace them with your scenes (one file per scene, one `<script>` each in `index.html`), set `FILM.fonts`, `FILM.BG`, `FILM.CAM`, `dur`.
