// The name tag on the picture: the viewer's address and the viewing's short code, drifting to new places every few seconds,
// so a screen recording that leaks says who made it. It is plain DOM inside the player's box (so it stays on full screen
// too), and it watches itself: if it is removed, hidden, made see-through, shrunk or moved out of the picture, the player
// stops and tells the site.

const SPOTS = 4;

export class Watermark {
  private layer: HTMLDivElement | null = null;
  private tags: HTMLSpanElement[] = [];
  private mo: MutationObserver | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private move: ReturnType<typeof setInterval> | null = null;
  private dead = false;

  constructor(
    private host: HTMLElement,
    private text: string,
    private onTamper: (why: string) => void,
  ) {}

  start() {
    this.build();
    this.tick = setInterval(() => this.check(), 1000);
    this.move = setInterval(() => this.place(), 7000);
    this.mo = new MutationObserver(() => this.check());
    this.mo.observe(this.host, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  stop() {
    this.dead = true;
    if (this.tick) clearInterval(this.tick);
    if (this.move) clearInterval(this.move);
    this.mo?.disconnect();
    this.layer?.remove();
  }

  private build() {
    this.layer?.remove();
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.wm = "layer";
    layer.style.cssText = "position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;user-select:none;-webkit-user-select:none;display:block;visibility:visible;opacity:1";
    this.tags = [];
    for (let i = 0; i < SPOTS; i++) {
      const tag = document.createElement("span");
      tag.textContent = this.text;
      tag.dataset.wm = "tag";
      tag.dir = "ltr";
      tag.style.cssText = `position:absolute;white-space:nowrap;font:600 ${i === 0 ? 13 : 11}px/1.2 system-ui,sans-serif;letter-spacing:.02em;color:#fff;opacity:${i === 0 ? 0.42 : 0.26};text-shadow:0 0 3px #000,0 0 6px #000;display:block;visibility:visible`;
      layer.appendChild(tag);
      this.tags.push(tag);
    }
    this.host.appendChild(layer);
    this.layer = layer;
    this.place();
  }

  private place() {
    this.tags.forEach((tag, i) => {
      // one in a fixed corner-ish zone, the others anywhere
      const x = i === 0 ? 3 + Math.random() * 20 : 3 + Math.random() * 60;
      const y = i === 0 ? 3 + Math.random() * 12 : 10 + Math.random() * 78;
      tag.style.left = `${x}%`;
      tag.style.top = `${y}%`;
    });
  }

  /** Is everything as we left it? Otherwise: put it back and tell why. */
  private check() {
    if (this.dead) return;
    const why = this.problem();
    if (why) {
      this.build();
      this.onTamper(why);
    }
  }

  private problem(): string | null {
    const layer = this.layer;
    if (!layer || !layer.isConnected || layer.parentElement !== this.host) return "layer removed";
    const ls = getComputedStyle(layer);
    if (ls.display === "none" || ls.visibility !== "visible" || Number(ls.opacity) < 0.9) return "layer hidden";
    const box = this.host.getBoundingClientRect();
    if (box.width < 50 || box.height < 50) return null; // the page itself is hidden or tiny: nothing to protect right now
    if (this.tags.length !== SPOTS || layer.children.length !== SPOTS) return "tags changed";
    for (const tag of this.tags) {
      if (!tag.isConnected || tag.parentElement !== layer || tag.textContent !== this.text) return "tag changed";
      const s = getComputedStyle(tag);
      if (s.display === "none" || s.visibility !== "visible" || Number(s.opacity) < 0.15 || parseFloat(s.fontSize) < 9) return "tag hidden";
      const r = tag.getBoundingClientRect();
      if (r.width < 20 || r.height < 6 || r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) return "tag out of the picture";
    }
    return null;
  }
}
