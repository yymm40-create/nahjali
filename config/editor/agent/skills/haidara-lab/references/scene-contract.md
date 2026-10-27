# The scene program, the kit and the sound kit

THE SCENE YOU WRITE — one JavaScript program (no HTML, no imports) that calls scene() once:

scene({
  title: "…",                     // the piece's name
  duration: 15,                   // seconds (the brief's length)
  bpm: 120,                       // the tempo the beats sit on (cuts and hits land on its grid)
  background: "#0b0b10",          // filled before every frame (optional)
  blur: 0.5,                      // motion-blur shutter 0–1 (0.5 = 180°): averaged sub-frames on export; 0 for crisp UI
  three: false,                   // true → K.THREE (three.js 0.170.0) and K.addon("postprocessing/EffectComposer.js") are loaded; render into K.glCanvas and draw it onto ctx
  cues: [ { t: 0.0, sfx: "transition-whoosh-fast" }, { t: 1.2, sfx: "hit-bass-hit", vol: 0.8 } ], // sound on the frames that change
  params: {                       // EDITABLE on the timeline: every word shown on screen and the 2–4 main colours (≤ 16, Arabic labels)
    title: { label: "العنوان", type: "text", value: "ابدأ اليوم" },
    accent: { label: "لون التمييز", type: "color", value: "#e8572a" },
  },
  setup(K, ctx) { /* once: sample particles, measure text, build three.js scenes. May be async. */ },
  draw(K, t, ctx) { /* the frame at time t (seconds). Pure: depends only on t and what setup built. */ },
  sound(K, S) { /* the soundtrack, made in code, timed to your own frames (see THE SOUND below) */ },
});

EDITABLE (the person edits the finished piece on the timeline, and it is rendered again with their values): EVERY word shown on screen and the 2–4 main colours of the palette are params, always read in draw with K.p("id", fallback) — never hard-code a shown word or a main colour. The layout must survive a longer or shorter text (K.fit / K.wrap), and a colour change must keep contrast. Words spoken by the person's video are not params.

HARD RULES OF THE MACHINE
- A frame depends ONLY on t. No state carried from one draw to the next (no "x += …" across frames, no counters), no Math.random (use K.rng(seed) in setup or K.hash), no Date/performance/timers/requestAnimationFrame (they are frozen). Springs and retargets: K.spring / K.springTo (a sum of one spring per change: still a function of t).
- Lay everything out in fractions of K.W / K.H (the project's frame, often 1080×1920 portrait or 1920×1080). Text stays inside the safe zone: portrait y 0.13–0.82 of H and x 0.075–0.89 of W (the platform's buttons sit on the right and the bottom); landscape 6% margins.
- Fonts: K.fonts.head (display) and K.fonts.body (text) are loaded for you; pass them as the family. Never a font name of your own.
- Pictures: only K.img(id) / K.picture(ctx, id, …) for the ids you were given. Never draw a real product, logo or UI from imagination when its picture was given — animate the real thing. When none was given, draw it yourself in code (shapes, gradients, particles, type).
- No network, no fetch, no DOM, no eval of strings, no workers. Everything you need is K (below), the 2D ctx and, when three:true, three.js.
- Keep it fast: a frame must draw in well under 100 ms at full size (particles ≤ ~6,000; metaball res ≤ 0.25; heavy blur only on small layers). The page renders 30–60 frames a second of video.
- A layer is { c: canvas, x: ctx }: draw on l.x, and use l.c (or K.pattern(ctx, l)) wherever a picture is wanted — ctx.createPattern / drawImage take l.c, never l.
- Errors: wrap nothing silently; a bug must throw so you see it in the next round.
- cues: only ids from this list: transition-whoosh-fast, transition-whoosh-deep, transition-whoosh-light, transition-swish-double, transition-zoom-in, transition-zoom-out, transition-swipe, transition-glitch, transition-glitch-long, transition-tape-rewind, transition-reverse-cymbal, transition-camera-flash, transition-page-turn, transition-wind-transition, transition-sparkle-transition, transition-bass-whoosh, transition-paper-slide, transition-film-reel, riser-riser-short, riser-riser-long, riser-riser-reveal, riser-riser-white-noise, riser-riser-shepard, riser-braam, riser-braam-dark, riser-drop-sub, riser-suck-back, riser-tick-tension, riser-heartbeat-tension, riser-drumroll, riser-string-rise, riser-countdown-beeps, riser-pulse-build, hit-boom, hit-boom-meme, hit-impact-heavy, hit-impact-soft, hit-slam, hit-metal-hit, hit-bass-hit, hit-thud, hit-clap-hit, hit-gong, hit-timpani, hit-stomp, hit-piano-stab, hit-tension-hit, ui-pop, ui-pop-bright, ui-click, ui-tap, ui-notification, ui-message-sent, ui-message-received, ui-typing, ui-typewriter, ui-ding, ui-correct, ui-wrong, ui-error, ui-success, ui-cash, ui-coin-drop, ui-camera-shutter, ui-screenshot, ui-like, ui-subscribe-bell, ui-text-blip, ui-swoosh-text, ui-checkmark, ui-loading, magic-sparkle, magic-fairy-dust, magic-teleport, magic-poof, magic-power-up, magic-transform, magic-portal, magic-spell, magic-glow, magic-laser, magic-robot, magic-hologram.

K (the kit, deterministic — never Math.random, never Date/performance: use K.rng(seed) and t):
NUMBERS · K.clamp(v,a=0,b=1) · K.lerp(a,b,t) · K.map(v,a,b,c,d,clamp=true) · K.seg(t,start,dur)→0..1 · K.smooth(e0,e1,x) · K.fract(x) · K.TAU
EASING · K.ease.{linear,inQuad,outQuad,inOutQuad,inCubic,outCubic,inOutCubic,outQuart,inOutQuart,outQuint,inExpo,outExpo,inOutExpo,outCirc,inOutSine,outBack(x,s),inBack(x,s),outElastic,silk (cubic-bezier .16,1,.3,1 — the product-film landing),snap (.34,1.56,.64,1 — fast with a soft overshoot)} · K.bezier(x1,y1,x2,y2)→ease · K.spring(tSeconds,{stiffness=170,damping=26})→0..1 (overshoots when damping is low)
TIME · K.springTo(t,from,[[at,target],…],{stiffness,damping}) (retargets many times, still a pure function of t: the UI-morph look) · K.keys(t,[[t,v,ease?],…],ease) · K.tween(t,start,dur,from,to,ease) · K.stagger(i,gap=0.06) · K.envelope(t,start,end,in=0.35,out=0.25,easeIn,easeOut)→0..1..0 · K.beat(t,bpm,offset)→{n,f}
RANDOM · K.rng(seed)→()=>0..1 · K.hash(n) · K.noise2(x,y) · K.noise3(x,y,z) (−1..1) · K.fbm(x,y,z,oct) · K.curl(x,y,z)→[vx,vy] · K.shake(t,amp,freq=7,seed)→[dx,dy]
COLOUR · K.rgb(hex)→[r,g,b] · K.rgba(hex,a) · K.mix(hexA,hexB,t)→hex · K.digits(s,arabic) · K.counter(p,from,to,{decimals,comma,prefix,suffix,arabic,ease})→string
CANVAS · K.W, K.H (frame size), K.ctx, K.canvas, K.glCanvas (a WebGL canvas for three.js), K.fonts.{head,body,…} (CSS families loaded for you), K.layer(name,w,h)→{c,x} (a cleared offscreen layer, reused by name), K.reset(ctx), K.isArabic(s), K.font(size,weight,family), K.fit(ctx,str,maxW,max,weight,family,min)→size, K.wrap(ctx,str,maxW,size,weight,family)→lines, K.text(ctx,str,x,y,{size,weight,family,color,gradient:[c1,c2],glow:{color,blur},shadow,stroke:{width,color},tracking (Latin only),align,baseline,alpha,blur,scale,rotate}), K.roundRect(ctx,x,y,w,h,r), K.drawOn(ctx,p,len,pathFn)
PARTICLES · K.textPoints(str,{x,y,size,weight,family,step=4,max,seed})→points · K.imagePoints(id,{x,y,w,h,step,max})→points with their colours · K.sample(drawFn,{step,max,seed})→points · K.swarm(points,{from:"scatter"|"center"|"bottom"|"edge"|"explode",seed,size=2.2,delay=0.35,wave,waveSpan,text,spread,color}) → swarm.draw(ctx,p 0..1,t,{color,ownColor,curl=160,alpha,ease,additive=true,sizeLanded}) (p 0→1 assembles out of dust; 1→0 dissolves)
LIQUID · K.metaballs(ctx,[{x,y,r}],{color|gradient:[c1,c2],res=0.25,threshold=1,edge=0.25,alpha,soften})
LIGHT · K.glow(ctx,drawFn,{blur=24,wide,alpha,comp}) · K.bloom(ctx,{strength=0.55,radius=18,threshold=1.15,res}) (call near the end) · K.lightSweep(ctx,p,clipFn,{angle=-22,width=0.18,color,alpha}) · K.echo(ctx,t,drawFn(ctx,t'),{copies=5,dt=0.035,alpha=0.5,tint})
FILM · K.grain(ctx,t,{amount=0.02}) (the owner's taste: ≤ 0.02–0.04 or none) · K.vignette(ctx,{amount=0.45,inner=0.35,color}) · K.rgbSplit(ctx,px,{dy,bg}) · K.glass(ctx,x,y,w,h,{radius=28,blur=26,tint,border,borderColor,shadow})
SPACE · K.camera({x,y,z,fov=900,roll}) · K.project(cam,x,y,z)→{x,y,s} · K.inSpace(ctx,cam,z,drawFn,{dof,focus}) (nearer layers move and grow more: parallax, push-ins, fly-throughs; dof blurs what is off focus)
GRAMMAR (the owner's skill, as calls) · K.TQ(t) (snap a DISCRETE change — a word swapped in, a typed character — to a frame: never swap on a raw word time) · K.E.{lin,in(k),out(k),inOut(k),soft,smooth,glide,sine,expoIn,needle,into,settle,morph1,morph2,width,back(s)} · K.kf(t,[[t,v],[t,v,ease]…]) (never stops at a middle key) · K.zoom(t,t0,t1,a,b,ease) (log space) · K.needle(t,cut,a,b,h=0.2) (fastest frame ON the cut) · K.about(ctx,px,py,s,dx,dy,r) (scale/rotate about a pivot: the parent null) · K.pop(t,t0,d) · K.settle(t,t0,d) · K.bounce(dt,v) · K.rise(dt,dist,v)→y offset (AE inertial bounce entrance) · K.cadence(n,T0,T1,seed)→times · K.typedN(times,t) · K.caretOn(t,tEnd) · start the next move at ≈0.45 of the current one (overlap, never a dead stop) · scene({ cuts:[t…] }) lists the hard cuts: motion-blur sub-frames never straddle one
ASSETS · K.img(id)→ImageBitmap|null · K.picture(ctx,id,x,y,w,h,{fit:"cover"|"contain",radius,alpha}) · K.assets (all pictures by id)

THE SOUND, MADE IN CODE (optional, but every piece with a voice or the person's "صوت" choice needs it) — add to scene({ … }):

  sound(K, S) { /* called ONCE: write the whole soundtrack, timed to YOUR frames */ }

S (48 kHz stereo, length = duration). Times in seconds; o = options; gain ≈ 0.1–0.9; pan −1 (left) … 1 (right):
  S.whoosh(t, {dur:0.5, gain, from:300, to:3200, pan})   air sweeping past — PEAKS at t (starts before it): put t on the move's fastest frame
  S.hit(t, {dur:0.6, gain, f0:120, f1:42})                 an impact on the landing frame (bigger = lower f0/f1, longer dur)
  S.riser(t0, t1, {gain})                                 tension cresting exactly at t1 = the reveal
  S.sub(t, {f:70, dur:1.2, gain})                         a deep drop under the logo / the biggest moment
  S.pop(t, {f:620, gain}) · S.click(t, {f, gain}) · S.tick(t, {f, gain})   small UI things: a card lands, a counter ticks
  S.shimmer(t, {dur:1, gain})                             sparkle on a light sweep / a magic reveal
  S.glitch(t, {dur:0.25, gain})                           a digital break (only on a glitch you draw)
  S.tone(t, {f, to, dur, gain, type:"sine"|"tri"|"saw"|"square", attack, pan})   a note or a sweep of your own
  S.drone(t0, t1, {f:110, chord:[1,1.5,2], gain:0.1})     a soft bed — ONLY when music by code is asked
  S.beat(t0, t1, {bpm, gain:0.35, full})                  a beat on the grid — ONLY when music by code is asked
  S.noise(), S.at(t) → sample index, S.add(i, value, pan) — for a sound of your own, sample by sample (deterministic: S.noise is seeded)
Rules: the sound is part of the design, timed to what YOU draw (you know every frame's time): whoosh peaks on the move, hit on the landing frame, riser cresting on the reveal, ~1 accent per 1–2 s, never the same sound twice in a row, quiet before the big hit. It is mixed under the person's voice when there is one: while words are spoken keep accents short and soft (gain ≤ 0.25), and put the big ones in the gaps between lines. The page limits the level; don't chase loudness. Library cues (cues: […]) are still there for real recorded sounds; with sound() use them rarely.
