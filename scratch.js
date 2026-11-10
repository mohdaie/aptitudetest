// Scratch paper: pressure-sensitive pen canvas (S Pen, Apple Pencil, mouse, finger).
// Palm rejection: once a pen is seen, finger touches on the canvas are ignored.
// S Pen side button (or eraser end) erases.
window.Scratch = (() => {
  'use strict';
  const pads = new WeakMap(); // key object → strokes
  let penSeen = false;

  function mount(el, key) {
    let strokes = pads.get(key);
    if (!strokes) { strokes = []; pads.set(key, strokes); }
    let tool = 'pen';
    el.innerHTML = `
      <div class="scratch-bar">
        <div class="seg" role="group" aria-label="Tool">
          <button type="button" data-tool="pen" class="on" aria-label="Pen">✎ Pen</button>
          <button type="button" data-tool="eraser" aria-label="Eraser">⌫ Eraser</button>
        </div>
        <button type="button" class="btn ghost" data-act="undo">Undo</button>
        <button type="button" class="btn ghost" data-act="clear">Clear</button>
      </div>
      <canvas class="scratch-canvas" aria-label="Scratch paper. Draw with pen or finger."></canvas>
      <p class="small muted scratch-hint">Write with your S Pen. Hold the side button to erase.</p>`;
    const cv = el.querySelector('canvas');
    const ctx = cv.getContext('2d');
    let W = 1;

    const color = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222';
    function drawStroke(s) {
      const pts = s.pts;
      if (!pts.length) return;
      ctx.save();
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = ctx.fillStyle = color();
      ctx.lineCap = ctx.lineJoin = 'round';
      const width = (p) => (s.erase ? 22 : 1.2 + 3.2 * p) * (W / 600) * 1.4;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x * W, pts[0].y * W, width(pts[0].p) / 2, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        ctx.lineWidth = width((a.p + b.p) / 2);
        ctx.beginPath(); ctx.moveTo(a.x * W, a.y * W); ctx.lineTo(b.x * W, b.y * W); ctx.stroke();
      }
      ctx.restore();
    }
    function redraw() { ctx.clearRect(0, 0, cv.width, cv.height); strokes.forEach(drawStroke); }
    function resize() {
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      W = r.width;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    const ro = new ResizeObserver(resize); ro.observe(cv);

    let cur = null;
    const pt = (e) => {
      const r = cv.getBoundingClientRect();
      const p = e.pointerType === 'mouse' ? 0.45 : (e.pressure || 0.45);
      return { x: (e.clientX - r.left) / W, y: (e.clientY - r.top) / W, p };
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'pen') penSeen = true;
      if (e.pointerType === 'touch' && penSeen) return; // palm rejection
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic or already-ended pointer */ }
      const erase = tool === 'eraser' || (e.buttons & 2) || (e.buttons & 32) || e.button === 5;
      cur = { erase: !!erase, pts: [pt(e)], id: e.pointerId };
      strokes.push(cur);
      drawStroke(cur);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!cur || e.pointerId !== cur.id) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const start = cur.pts.length - 1;
      for (const ce of (evs.length ? evs : [e])) cur.pts.push(pt(ce));
      // draw only the new segment(s)
      drawStroke({ erase: cur.erase, pts: cur.pts.slice(start) });
    });
    const end = (e) => { if (cur && e.pointerId === cur.id) cur = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    el.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => {
      tool = b.dataset.tool;
      el.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    el.querySelector('[data-act=undo]').onclick = () => { strokes.pop(); redraw(); };
    el.querySelector('[data-act=clear]').onclick = () => { strokes.length = 0; redraw(); };
    resize();
  }

  return { mount };
})();
