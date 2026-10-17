/* s1 · hook 0–1.6: headline rises, prompt bar enters (linear rise + inertial bounce, width from a square),
   types with a human cadence, click → needle zoom INTO the send button; the speed peak lands on the cut (1.6). */
(function () {
  const { E, p, el, glyphs, riseGlyphs, cadence, typedN, caretOn, rise, zoom, about } = FILM;
  const CUT = 1.6, PROMPT = 'Ship the launch film tonight', BX = 1400, BY = 700;   // button centre ON SCREEN = zoom pivot = bg flood origin
  FILM.ACTION = [BX, BY];                                                            // index.html floods the background from here
  const T = cadence(PROMPT, .55, 1.05);
  let S = {};
  FILM.scene({
    id: 's1', t0: 0, t1: CUT, post: 0,
    zoom: (lt) => zoom(lt, 1.22, CUT, 1, 9, E.in(4)),       // dominant scale for __qa (log-slope must keep its sign across the cut)
    build(root) {
      S.null = el('div', 'position:absolute;inset:0;transform-origin:0 0', root);          // the "null": zoom lives here, not on the objects
      const h = el('div', 'position:absolute;left:0;right:0;top:250px;text-align:center;font-size:150px;color:#131415', S.null);
      h.className = 'disp'; S.g = glyphs(h, 'launch.');
      S.bar = el('div', 'position:absolute;left:960px;top:700px;height:120px;border-radius:60px;background:#fff;box-shadow:0 24px 60px rgba(40,30,90,.14),0 0 0 2px rgba(19,20,21,.06)', S.null);
      S.txt = el('div', 'position:absolute;left:58px;top:38px;font-size:38px;color:#131415;white-space:pre', S.bar); S.txt.className = 'mono';
      S.caret = el('div', 'position:absolute;top:30px;width:3px;height:60px;background:#6B4BFF', S.bar);
      S.btn = el('div', 'position:absolute;width:92px;height:92px;border-radius:46px;background:linear-gradient(100deg,#8A5CFF,#5B6CFF,#3EB6FF);top:14px', S.bar);
    },
    update(lt) {
      riseGlyphs(S.g, lt, .05, .04, .55);
      // entrance: rise 217 px linearly then inertial bounce; width grows from a square around a fixed centre
      const W = 120 + (1000 - 120) * E.width(p(lt, .12, .62)), y = 640 + rise(lt - .1, 217);
      S.bar.style.width = W + 'px'; S.bar.style.marginLeft = -W / 2 + 'px'; S.bar.style.top = y + 'px';
      S.btn.style.left = (W - 106) + 'px';
      S.btn.style.transform = `rotate(${360 * E.width(p(lt, .12, .62))}deg) scale(${1 - .08 * Math.sin(Math.PI * p(lt, 1.12, 1.24))})`;   // click squash
      const n = typedN(T, lt); S.txt.textContent = PROMPT.slice(0, n);
      S.caret.style.left = (62 + S.txt.offsetWidth) + 'px';               // offsetWidth ignores transforms
      S.caret.style.opacity = lt < .53 ? 0 : caretOn(lt, 1.05);
      const z = zoom(lt, 1.22, CUT, 1, 9, E.in(4));                                        // needle INTO the button
      S.null.style.transform = about(BX, BY, z);
    },
  });
  FILM.cue('click', 1.12, 'ui'); FILM.cue('riser→cut', CUT, 'riser');
})();
