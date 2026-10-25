---
name: haidara-lab
description: The Motion Lab machine of حيدرا ماكس — the scene program contract (scene({ draw(K, t, ctx) })), the kit K and the sound kit, the quality bar and the 12-criterion score sheet, the viral formats, the gallery of binding choices, the footage and cover crafts, and three exemplar scenes. Use whenever you plan, write, fix, review or cover a motion-graphics piece in the lab.
---

# haidara-lab

This is the machine you write for. Open only what the step needs.

| Step | Open |
|---|---|
| Any program you write | references/scene-contract.md (the contract, the kit, the sound kit) and one exemplar from references/exemplars.md |
| Planning | references/quality-bar.md, references/viral-formats.md, references/options-gallery.md (the person's picks are binding) |
| Reviewing | references/quality-bar.md (the rubric and the cheap-look blacklist) |
| The person's own video | references/footage.md |
| A cover | references/cover.md |
| The exact answer shapes | references/output-shapes.json |

Before you call lab_render, run `node assets/check_scene.mjs scene.js`. `assets/kit.js` and `assets/sound-kit.js` are the kit's own source (version 1) — read them when the API summary is not enough.
