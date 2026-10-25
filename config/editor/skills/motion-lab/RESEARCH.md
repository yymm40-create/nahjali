# «مختبر الموشن» — the research behind حيدرا ماكس's code-made motion (2026-10-12)

Four research passes made for the owner's bar: **"a viewer thinks millions were spent on this clip."** This file is
the evidence; `src/lib/editor/scene/skill.ts` is the training drawn from it. Numbers marked *claim* are reported by
their sources and not verified.

## 1. How the viral Claude Opus 5.5 motion films were made (Sept–Oct 2026)

**One pipeline behind nearly all of them:** Claude writes ONE HTML file (Canvas / SVG / GSAP / three.js) or a
Remotion project → every frame is a pure function of time (`seek(t)`) → headless Chromium screenshots frame by frame
→ ffmpeg → H.264. The best add sub-frame motion blur, sound on a measured beat grid and a contact-sheet review
before the full render. The editor does the same in the person's browser (WebCodecs) — no server render.

Top pieces (views are *claims* from X snapshots):
| Creator | Piece | Views | Length | How |
|---|---|---|---|---|
| @donaldjewkes / @anabology | illustrated AI timeline / "Claude Pop" | 3.4–3.55M | 2:22 | canvas "papery" animation, generated character sheets, generated clips, ElevenLabs SFX; ~1,700-word dictated brief; 12-hour run |
| @stephanlivera | "the showreel that started it" | 1.7–2.2M | 0:15 | canvas (receding grid of red dots), Max effort, the one-line prompt, no assets |
| @kirill sh | showreel, Opus vs another model | 1.79M | — | the same one-liner on two models |
| @shneural | chrome 3D showreel | 1.7M | 0:32 | 3D chrome, loud type |
| @twoclipping | one shape morphs through 12 UI states | ~950K | 0:14 | one HTML file 1440², closed-form springs, 120 BPM grid, 4 sub-frames blended → 60 fps, one check frame per beat |
| @kevin_t_ngo | hand-drawn narrative | 635K | 0:28 | JavaScript drawing every frame |
| @ajith_io | résumé reel on a cream dot grid | ~560K | 0:15 | canvas, the one-liner |
| @deedydas | startup launch | ~340K | 0:26 | SVG + GSAP, one sentence, ~$2 of API |
| @daniel_haida | product film | — | 0:15 | Remotion, soundtrack synthesised from sine waves and noise, 1 prompt + 2 feedback rounds |

What a typical hit looks like (Revid, 63 hits): median 29 s; a quarter exactly 15.1 s; first hard cut ≈3.9 s; ~3 cuts
per video; 59% show readable text within 2 s; 71% music/sound design without a voice; 9 of 10 showreels on dark
backgrounds; median −14.2 LUFS; palette near-white #e6e8e6, near-black #141318, warm grey #726d68 + ONE accent
(#d78d45 orange or #493cca violet). No craft measure predicted likes (|rho| ≤ 0.16): reach came from naming Claude
and from the showreel format (median 792 likes vs 245). Craft decides whether it looks expensive; packaging decides
whether it spreads.

The prompts that worked:
- **The one-liner** (51+ reruns): *"make a dynamic 15-second motion graphics video that shows what an incredible
  motion designer you are, like it's your showreel for a résumé. go all out."* With a style file it stays on brand;
  without the ambition line, output comes out "far too polite".
- **The structured spec** (most copied): inputs (ask first) · direction (one shape never cut, springs, one accent,
  camera zooms so each state fills the frame, the last frame is the first) · banned list (bouncy easing, particle
  bursts, glows, gradients on UI, dead time, anything template-like) · structure (120 BPM, something on every beat) ·
  build (state from time only, one spring per retarget summed, 4 sub-frames, one frame per beat checked) · gotchas.
- **The premium brand brief:** "This is NOT a generic SaaS explainer… The first 1.5 seconds must already look
  premium… No five-second logo intro." One shot = one idea; object-driven transitions (a card becomes the next card);
  overshoot below ~2%; no effect only because it looks cool; no particle spam, fake glass everywhere, spinning 3D
  cards, constant zoom, 20 animation styles. QA: render ~10 exact frames and LOOK at them — "the deliverable is the
  FILM"; "I would rather have 3 extraordinary visual moments than 10 mediocre ones."
- **The critique pass:** "Be a harsh motion director, not a proud author." Score 1–10: hook in 2 s, phone
  readability, motion quality, variety (new every 2–4 s), composition, brand accuracy, sound sync. Name the 3 worst
  problems with timestamps, fix only those, re-render; repeat until every score ≥ 8 (2–3 rounds typical).

Failure modes: centred title on a gradient, everything fading in, corner labels, frame borders, generic particle
bursts, glows, "AI purple"; linear slides, bouncy overshoot, one ease and one duration for everything; crossfades and
random wipes, constant zoom, spinning cards, whip/glitch spam; a static opening; dead frames; loop-seam stutter;
overlapping text in swaps; blurry scaled text; invented UI and invented numbers; a silent film; a +7–10 dB jump on a
cut; living things drawn in code look off.

## 2. Higgsfield (site, presets, camera library — read-only, nothing generated)

- **Viral Hub, 87 one-photo presets:** camera spectacles (Bullet time, Orbit 360, Earth zoom, Eyes in, High flip,
  Selfception), time tricks (Stop world, Floating fall), physics gags (Incline, World morphing, Architecture wave,
  Vanish, Melting, Cutout into paper layers, Sticker peel), duplication (Clones, Studio slide — copies at depths sliding
  past each other), scale (Street colossus), "living paintings", and mixed-media looks (Ink Riot, Comic, Particles,
  Windows, Tracking lines, Fragments, Overexposed, Origami, Two color, Halftone, Broken mirror, Magazine…).
- **Marketing Studio, 231 motion templates** in four engines: hypermotion (CGI product film: Liquid Gold, Droplet Hero,
  Chili Burst, Liquid Lettering, Price Roll Carousel, HUD callouts), saas_motion (Echo Wave, Shutter Bands, Magnet,
  Masks, Liquid Carousel, Chalk Blueprint, Sticker Bounce), 2d_motion (Falling Type Mosaic, Split-flap Scoreboard,
  Expanding Type Rings, Powder Particle Type, Paper-cut Shadow Theatre, Tile Mosaic Spiral), mixed_media (Halftone
  Street Collage, Chrome Core, Y2K, Taped Zine Collage, 3D Fur…).
- **Product recipes** (6 s, 1080p): Crane Reveal, Detail Scan, Floating Roll, Half Turn, Impact (radial burst frozen
  mid-air + short arc), Label Trace, Light Sweep, Liquid Wrap, Macro Glide, Product Spin, Pull Back, Push In, Shadow
  Motion, Sunrise Pass, Topdown Dive, Whip Pan.
- **Camera library:** crash zoom (0.2–0.4 s), rapid/yo-yo zoom, dolly / super dolly / dolly zoom (vertigo), double
  dolly, 360 orbit / lazy susan, arc, bullet time, speed ramps (flash in/out, impact, ramp up), whip pan (0.3–0.6 s),
  crane/jib, top-down dive, FPV drone, robo arm, snorricam, through-object / eyes-in portal (1–2 s), earth zoom,
  flying-cam transition (1–1.5 s), hyperlapse, dutch/incline, fisheye, handheld wiggle, rack focus, light sweep, macro
  glide, impact burst, liquid wrap, disintegrate, melt, morph / column wipe, clones, cutout, glitch/RGB split.
- **Their definition of expensive (Cinema Studio "world"):** film stock (Raw 16mm, Fine Film), lens (anamorphic oval
  bokeh + horizontal flares, warm halation, vintage haze), focal length, aperture (f/1.4), light (soft cross,
  contre-jour halo, practicals, silhouette), palettes (Teal & Orange Epic, Bleach Bypass, Hyper Neon, Cold Steel,
  Sodium Decay), director move-sets (Fincher's silent machine, Lubezki's one take, IMAX epic scale), speed ramps.
- **Ten ingredients of a million-dollar clip** (from their outputs): one unbroken motivated camera move eased into a
  held final frame · speed ramping (real → slow/freeze at impact → snap back) · the hero alone on a seamless
  background sampled from its own colour, filling 60–70% · studio light with a MOVING specular · physics you can
  feel, with the hero still against the chaos · lens character (shallow focus, anamorphic flares, halation) · one
  committed grade · scale contrast · an impossible event on frame 1 and a clean loopable end · texture (grain, VHS,
  halftone, handheld micro-shake, motion blur) that makes CGI read as "shot".
- **Their own code editor engine (Higgsedit)** is keyframed text/masks/morph/counters/2.5D camera/motion blur/custom
  GLSL — the same family as ours. Code covers essentially all of saas_motion, 2d_motion and most mixed_media; a video
  model is needed only to change a real person's body or a photographed world.
- **Prompt grammar to borrow (for asset images):** "the supplied image is the authoritative reference"; a preserve
  list repeated verbatim; hard negatives (no extra logos, captions, watermarks, people); seamless single-colour
  studio background with the hue sampled from the subject, subject at 60–70% of the frame with motion-safe space,
  soft studio light and ONE grounding shadow; numbers instead of adjectives; the same quality boilerplate on every
  shot ("physically plausible, high temporal consistency, stable edges, coherent lighting").

## 3. The craft of expensive motion (studios, guides, skills — numbers)

- **Easing:** never linear on anything that starts or stops. Entrances strong ease-out (cubic-bezier .16,1,.3,1 /
  expo-out), exits ease-in (.7,0,.84,0 or .3,0,1,1), moves between states in-out (.65,0,.35,1). ~80% of the distance
  fast, the last 20% decelerating. No more than two tweens of a scene on the same ease.
- **Durations (video scale):** small element 400–700 ms, headline build 600–1000 ms, hero reveal 1.2–2.5 s, camera
  move 3–6 s across the shot, exit 60–75% of its entrance; duration grows with distance (full screen ×1.8–2).
  Mood: 0.15–0.3 s energy, 0.3–0.5 s professional, 0.5–0.8 s luxury, 0.8–2 s cinematic. The slowest scene ≥ 3× the
  fastest. Never start at t = 0 (offset 0.1–0.3 s).
- **Overshoot budget:** premium 0–2%, feedback 2–5%, success/badge 5–10% (scale to 1.08), celebration 15–25%; never on
  opacity. Springs critically damped by default (ζ = 1), 0.8–0.85 "alive", 0.6–0.7 playful only, never below 0.55.
- **Stagger:** letters 15–35 ms, UI 30–80 ms, words 60–120 ms, dramatic 100–200 ms; the whole group ≤ ~500–700 ms
  (gravity pulls of particles excepted). Order by importance; one shared origin and direction.
- **Choreography:** one hero motion at a time, at most 2–3 secondary ones at lower amplitude, at most a third of the
  elements moving at once; the background always slightly alive (0.5–2% drift); follow-through 50–150 ms behind;
  counter-motion of the background 20–30% against the hero. Scene shape: build 0–30%, breathe 30–70% with exactly
  one ambient motion (scale 1 → 1.04), resolve 70–100%, then 100–200 ms of stillness. "Premium = one object changing
  shape; a fade between pictures looks cheap."
- **Physicality:** never scale from 0 (start at 0.9–0.97 + opacity), arcs not straight lines (10–20 px off the chord
  at the middle), motion blur only on moves that really travel (180° shutter, 8–16 samples; keep still text sharp).
- **Camera:** a slow push (2–6% scale) on every hold; parallax with 3–5 planes (near 1.5×, hero 1×, far 0.2–0.4×);
  rack focus 400–800 ms; orbits slow (15–40° over 4–6 s) on a dark or seamless backdrop; one move per shot, no shake,
  no spin; fly-throughs aim at a point ahead, bank into turns (≤ 0.13 rad), constant speed; the lens never tweens.
- **Light & material:** key + rim lights on a black void; reflections need an environment; roughness varies; contact
  shadows under everything; ACES/AgX tone mapping. Post: bloom with a high threshold (strength 0.2–0.6), vignette
  10–25%, grain 2–5% re-seeded every frame, chromatic aberration 0.5–1.5 px at the edges only, halation, dither.
- **Typography:** one idea per card, ≤ ~7 words, held ≥ 1.5–2 s after it lands (0.5 s + 0.25 s/word); on a
  1080-wide frame headline 90–180 px (≥ 84), support ≥ 44 px, nothing under 36 px; weight contrast (300 vs 900);
  ≤ 2 families; tight tracking on big Latin type; hero text 60–80% of the frame width; mask reveals rising 40–60% of
  their height (expo-out 600–900 ms, word stagger 60–100 ms); blur-to-sharp 8–16 px → 0 with 4–8% scale-down. No
  typewriter on headlines, no bouncing letters, no spinning 3D text.
- **Colour:** 3–5 colours, one accent (60-30-10), near-black #0A0A0C–#141318 and off-white #F2F0EB (never pure
  #000/#FFF), saturation only on the accent; one grade for the whole piece.
- **Safe zones 9:16 (1080×1920):** text in y 250–1570 (stricter: 360–1420), out of the right 120 px; sides ≥ 80 px.
- **Pacing & sound:** hook in the first 1–1.5 s, something new every 0.8–1.5 s (kinetic) or 2–4 s (explainer); cut
  on beats (120 BPM: beat 0.5 s, bar 2 s); the biggest reveal on the drop after a riser; whoosh 10–20 ms ahead of the
  move, impact on the exact landing frame, riser crest on the hit; ~1 sound accent per 1–2 s, not on every move; no
  jump > +6 dB on a cut; −14 LUFS; end held ≥ 2 s or looping to frame 1.
- **Arabic:** animate whole words or lines, never letters (the joins break); never letter-spacing — stretch with
  kashida (ـ) only after letters that join forward; motion and reveal masks run right → left; line height 1.3–1.5,
  room above for diacritics; one digit system per film; display faces Lalezar, Changa 800, Alexandria 800–900, UI
  Cairo / Tajawal / IBM Plex Sans Arabic, heritage Amiri / Reem Kufi / Aref Ruqaa. Measured on top Arabic reels:
  word-by-word 120–200 ms a word, 60–120 ms apart; pill 300–450 ms; badge pop 350–500 ms (0 → 1.08 → 1, −8° → 0);
  iris transition 500–700 ms; push 250–400 ms with directional blur; a hold over 2.5 s needs secondary motion; end
  card 3–7 s. Gold/brass on deep dark grounds and geometric patterns assembling from particles are common in Gulf
  campaign looks (*observation, to check against current accounts*).

## 4. Algorithms that the kit implements

Particle assembly (sample the glyph/logo mask every 2–4 px, ~85% of particles on the shape, per-particle delay by x
for a wave, curl-noise turbulence that dies on landing, ease-out-expo landing) · curl noise (divergence-free swirl) ·
metaballs (Σ r²/d², smoothstep at 1) · glass (blurred copy of what is behind + tint + top highlight + 1 px rim + soft
shadow) · light sweep (a band 20–30° from vertical, additive, clipped to the glyph) · accumulation motion blur
(sub-frames across the shutter, averaged) · deterministic echo trails · bloom (downscaled bright pass, blurred,
screen) · grain re-seeded per frame · 2.5D camera with parallax and depth of field · springs that retarget as a sum of
one spring per change (pure function of t).

## Sources
- Viral pieces and data: github.com/yihui-dev/awesome-opus5-5-videos · skillry.dev/ai-videos/opus-5-5 ·
  github.com/nickcheng/claude-opus-5-5-js-animation-research · revid.ai/case-studies/claude-opus-motion-graphics ·
  ayautomate.com/resources/claude-opus-5-5-motion-graphics · claudevideo.org/videos ·
  fliki.ai/features/claude-motion-graphics · x.com/stephanlivera/status/2103315922098470926 ·
  x.com/twoclipping/status/2103273003555402193 · x.com/daniel_haida/status/2104139720829636937 ·
  x.com/brainextends/status/2103801834930606193 · x.com/deedydas/status/2102787937482252537 ·
  x.com/__morse/status/2103485566570369333
- Guides: iart.ai/blog/claude-motion-graphics · growwithaiguide.substack.com/p/claude-makes-the-best-motion-graphics ·
  movez.substack.com/p/how-to-build-motion-design-studio · daily.dev (Opus 5.5 motion design in code) ·
  remotion.dev/docs/ai/coding-agents · charliehills.substack.com/p/claude-code-motion-graphics
- Skills read: github.com/remotion-dev/skills · github.com/cloudai-x/threejs-skills · github.com/greensock/gsap-skills ·
  github.com/lottiefiles/motion-design-skill · github.com/AThevon/genjutsu · github.com/emilkowalski/skills ·
  github.com/charlie947/motion-graphics-skills · github.com/heygen-com/hyperframes ·
  github.com/wshuyi/remotion-video-skill · github.com/sudadom/arabic-motion-graphics-skill ·
  github.com/iart-ai/javascript-animation-skills · Material 3 motion tokens (material-web)
- Higgsfield: higgsfield.ai/camera-controls · higgsfield.ai/viral · higgsfield.ai/blog/cinema-studio-3 ·
  higgsfield.ai/blog/ai-video-camera-control · higgsfield.ai/blog/how-to-make-viral-videos-viral-presets ·
  higgsfield.ai/creator-hub/changelog · the Higgsfield MCP catalogue (presets, recipes, explainer styles, models)
- Craft: schoolofmotion.com/blog/motion-design-price-difference · trydemotion.com/blog/apple-style-animation-guide ·
  olafmotion.com/tips/how-to-make-motion-design-more-professional · ordinaryfolk.co/process ·
  elements.envato.com/learn/motion-design-trends · senatemedia.co.uk (animation trends 2026) ·
  theogarnot.com/guide/infinite-zoom · learnopengl.com (physically based bloom) · Bridson et al. 2007 (curl noise)
