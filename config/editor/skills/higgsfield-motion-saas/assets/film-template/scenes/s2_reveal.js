/* s2 · reveal 1.6–3.0: the camera KEEPS flying forward — the new shot starts small (.38) and decelerates in, so the
   zoom direction does not flip at the cut. The title's animation CLOCK starts 0.12 s before the cut (lt = −0.12) so the
   first frames after the cut are already moving — but nothing of s2 is visible before the cut (no pre-roll overlay). */
(function () {
  const { E, el, glyphs, riseGlyphs, zoom, about, pop } = FILM;
  const T0 = 1.6;
  let S = {};
  FILM.scene({
    id: 's2', t0: T0, t1: 3.0,
    zoom: (lt) => zoom(lt, 0, .75, .38, 1, E.out(3)),
    build(root) {
      S.null = el('div', 'position:absolute;inset:0;transform-origin:0 0', root);
      const h = el('div', 'position:absolute;left:0;right:0;top:330px;text-align:center;font-size:170px;color:#F0F0F2', S.null);
      h.className = 'disp'; S.g = glyphs(h, 'ships today');
      const s = el('div', 'position:absolute;left:0;right:0;top:540px;text-align:center;font-size:86px;color:#B9B2FF', S.null);
      s.className = 'serif'; S.sub = glyphs(s, 'in one prompt.');
      S.pill = el('div', 'position:absolute;left:760px;top:720px;width:400px;height:96px;border-radius:48px;background:linear-gradient(100deg,#8A5CFF,#5B6CFF,#3EB6FF);color:#fff;font:700 36px "Inter Tight";display:flex;align-items:center;justify-content:center', S.null, 'Try it free');
    },
    update(lt) {
      S.null.style.transform = about(960, 540, zoom(lt, 0, .75, .38, 1, E.out(3)));
      riseGlyphs(S.g, lt, -.12, .03, .5);
      riseGlyphs(S.sub, lt, .25, .03, .5);
      const k = pop(lt, .62, .5);                       // spring only on an entrance
      S.pill.style.transform = `scale(${.6 + .4 * k})`; S.pill.style.opacity = Math.min(1, k * 3);
    },
  });
  FILM.cue('cut hit', T0, 'hit'); FILM.cue('pill pop', T0 + .62, 'ui');
})();
