// Shared pieces for the ink.astrius.room.scene pages. Classic script (works from file://), defines `Kit`.
// A scene page declares its default event content; the URL fragment overrides it for testing
// (#intensity=1&seed=7), and an embedding agent can set window.SCENE_CONTENT before this runs.
(function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Event content carries fractional settings as integer percentages (canonical JSON has no floats):
  // { "intensity": 70, "wind": -35 }. Scenes get them back as fractions.
  const PERCENT_KEYS = ['intensity', 'wind', 'clouds', 'speed'];
  function params(defaults) {
    const p = { ...defaults, ...(window.SCENE_CONTENT || {}) };
    for (const [k, v] of new URLSearchParams(location.hash.slice(1))) {
      p[k] = typeof defaults[k] === 'boolean' ? v !== '0' && v !== 'false' : isNaN(Number(v)) ? v : Number(v);
    }
    for (const k of PERCENT_KEYS) if (typeof p[k] === 'number') p[k] /= 100;
    return p;
  }

  function canvas(w, h) {
    const cv = document.getElementById('c');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return g;
  }

  function offscreen(w, h) {
    const o = document.createElement('canvas');
    o.width = w; o.height = h;
    const g = o.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [o, g];
  }

  const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
  function line(g, x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0);
    for (let i = 0; i <= n; i++) px(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  // 4x4 ordered dither: fades without gradients (a pixel is drawn when level > threshold)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dither = (x, y, level) => level * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;

  // generateCloudMap(): from astrius.ink (web/src/lib/sunset/clouds.ts), a port of Pixel Composer's
  // MK Cloud node (MIT). rg = offset from the puff centre, b = layer, a = coverage.
  function generateCloudMap(seed, w, h, options = {}) {
    const o = { layers: 3, amount: Math.round(w * 0.9), aspect: 1.3, basePos: 0.4, spread: 0.9, shift: 1, stretch: 0.3, ...options };
    const random = mulberry32(seed);
    const data = new Uint8Array(w * h * 4);
    const rMax = Math.max(2.5, h * 0.34), rMin = Math.max(1.5, h * 0.12);
    const ty = h - 2;
    const sizeY = Math.max(1, (ty - rMax) / (1 + o.basePos));
    const sizeX = Math.max(1, w * 0.5 - rMax * o.aspect - 1);
    const cx = w / 2, cy = ty - o.basePos * sizeY;
    const shiftScale = Math.max(4, h * 1.5);
    const stamp = (x, y, rx, ry, layerByte) => {
      if (rx < 0.5 || ry < 0.5) return;
      for (let py = Math.max(0, Math.floor(y - ry)); py <= Math.min(h - 1, Math.ceil(y + ry)); py++)
        for (let qx = Math.max(0, Math.floor(x - rx)); qx <= Math.min(w - 1, Math.ceil(x + rx)); qx++) {
          const nx = (qx + 0.5 - x) / rx, ny = (py + 0.5 - y) / ry;
          if (nx * nx + ny * ny > 1) continue;
          const k = (py * w + qx) * 4;
          data[k] = Math.round((nx * 0.5 + 0.5) * 255);
          data[k + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          data[k + 2] = layerByte;
          data[k + 3] = 255;
        }
    };
    for (let i = 0; i < o.layers; i++) {
      const layeri = 1 - i / o.layers;
      const lsx = sizeX * layeri, lsy = sizeY * layeri;
      const layerByte = o.layers > 1 ? Math.round((i / (o.layers - 1)) * 255) : 255;
      const count = Math.round(o.amount * layeri);
      for (let n = 0; n < count; n++) {
        const irad = Math.sqrt(random());
        const dir = random() * Math.PI * 2;
        let x = cx + Math.cos(dir) * Math.round(lsx * irad);
        let y = cy - Math.sin(dir) * Math.round(lsy * irad);
        let ro = rMin + (rMax - rMin) * (1 - irad);
        let sx = o.aspect, sy = 1;
        const ddx = x - (cx - lsx + lsx * o.shift);
        const ddy = Math.max(0, y - (ty - ro));
        const dx = ((ddy * ddx) / Math.max(lsx, 1)) * o.spread;
        ro *= Math.min(1, Math.max(0, 1 - Math.abs(dx) / shiftScale));
        x += dx;
        y -= Math.max(0, y - (ty - ro));
        const comp = (ddy / shiftScale) * o.stretch;
        sx += comp; sy -= comp; y += ro * comp;
        stamp(Math.round(x), Math.round(y), ro * sx, ro * Math.max(sy, 0.2), layerByte);
      }
    }
    return { w, h, data };
  }

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Light a cloud map the way the astrius.ink shader does (lit disc, shaded side, rim, underside),
  // into a sprite. ramp: 16 colours, 0..11 body, 12..15 underside glow. light: unit vector toward the light.
  const rgba = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return (255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);  // ABGR for a little-endian Uint32Array
  };
  const rampCache = new Map();
  const rampWords = (ramp) => { if (!rampCache.has(ramp)) rampCache.set(ramp, Uint32Array.from(ramp, rgba)); return rampCache.get(ramp); };

  function shadeCloud(map, seed, { v = 0.5, ramp, light = [0.25, -0.97], boost = 0, glow = true }) {
    const { w, h, data } = map;
    const [o, x2] = offscreen(w, h);
    const img = x2.createImageData(w, h), out = new Uint32Array(img.data.buffer), words = rampWords(ramp);
    const hr = mulberry32(seed ^ 0x9e3779b9);
    const [lx, ly] = light, INNER = 0.78, RIM = 0.6;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const noise = hr();
      if (data[k + 3] < 128) continue;
      const tnx = (data[k] / 255) * 2 - 1, tny = (data[k + 1] / 255) * 2 - 1, layer = data[k + 2] / 255;
      const r = Math.hypot(tnx, tny);
      const shaded = Math.hypot(tnx - lx * (1 - INNER), tny - ly * (1 - INNER)) > INNER;
      const rim = r > RIM && (tnx * lx + tny * ly) / Math.max(r, 1e-3) > 0.45;
      const underside = y + 1 >= h || data[((y + 1) * w + x) * 4 + 3] < 128;
      const body = Math.floor(3.6 + 1.8 * layer - 1.4 * smooth(0.45, 0.95, v)) + 0.5;
      let idx = shaded ? body - 1 : body;
      if (rim) idx = Math.floor(body + 2.5);
      if (glow && underside && noise > 0.35) idx = 12 + Math.floor(v * 3.5);
      idx = Math.min(boost ? 11 : 15, Math.floor(idx) + boost);
      out[y * w + x] = words[Math.max(0, idx)];
    }
    x2.putImageData(img, 0, 0);
    return o;
  }

  // unit vector from a cloud's centre toward a light, kept pointing at least a little downward-lit
  function lightFrom(cx, cy, lx, ly, minUp = -0.2) {
    let dx = lx - cx, dy = Math.min(minUp * Math.hypot(lx - cx, ly - cy), ly - cy);
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  }

  // fixed 30 fps simulation, draw every animation frame
  function loop(step, draw, fps = 30) {
    let last = 0, acc = 0;
    function frame(ts) {
      acc += Math.min(100, ts - last); last = ts;
      while (acc >= 1000 / fps) { step(); acc -= 1000 / fps; }
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame((ts) => { last = ts; frame(ts); });
  }

  window.Kit = { mulberry32, params, canvas, offscreen, px, line, dither, generateCloudMap, shadeCloud, lightFrom, rgba, smooth, loop };
})();
