import { FORMATS } from './scenario.mjs';

const r = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Desktop: window content 1536x864 at (192,130), title bar 44 px above (y 86). Mobile: full stage.
export function stageMap(format) {
  const { viewport, out } = FORMATS[format];
  const desktop = format === 'desktop';
  return { k: (desktop ? 1536 : out.width) / viewport.width, ox: desktop ? 192 : 0, oy: desktop ? 130 : 0, W: out.width, H: out.height };
}

export function toStage(b, { k, ox, oy }) {
  const p = { x: r(ox + b.x * k, 2), y: r(oy + b.y * k, 2) };
  return b.w == null ? p : { ...p, w: r(b.w * k, 2), h: r(b.h * k, 2) };
}

export function cutPlan(duration, idle, keep = 0.3) {
  const segs = [];
  let from = 0;
  for (const { start, end } of [...idle].sort((a, b) => a.start - b.start)) {
    if (end - start <= keep) continue;
    segs.push({ from, to: r(start + keep) });
    from = end;
  }
  segs.push({ from, to: duration });
  return segs;
}

export function remap(t, keep) {
  let out = 0;
  for (const { from, to } of keep) {
    if (t < from) return r(out);
    if (t <= to) return r(out + t - from);
    out += to - from;
  }
  return r(out);
}

function frame(cx, cy, s, { W, H }) {
  return { scale: r(s), x: r(clamp(W / 2 - cx * s, W - W * s, 0), 2), y: r(clamp(H / 2 - cy * s, H - H * s, 0), 2) };
}

const WIDE = { t: -Infinity, scale: 1, x: 0, y: 0 };

// box in stage px (null = wide); t = action time. Returns a camera key or null when nothing changes.
export function cameraFor(box, stage, prev = WIDE, t) {
  const { W, H } = stage;
  const start = r(Math.max(0, t - 0.45));
  let s = box ? Math.max(1, Math.min(2.2, W / (box.w * 1.6), H / (box.h * 1.6))) : 1;
  if (prev.scale > 1 && start - prev.t < 2) s = prev.scale; // already zoomed: pan, do not re-zoom
  const [cx, cy] = box ? [box.x + box.w / 2, box.y + box.h / 2] : [W / 2, H / 2];
  const f = frame(cx, cy, s, stage);
  if (f.scale === prev.scale && f.x === prev.x && f.y === prev.y) return null;
  const dist = Math.hypot(f.x - prev.x, f.y - prev.y);
  return { t: start, dur: r(clamp(dist / 1000, 0.6, 1.2)), ...f };
}

function pushIn(prev, stage, duration) {
  const cx = (stage.W / 2 - prev.x) / prev.scale, cy = (stage.H / 2 - prev.y) / prev.scale;
  return { t: r(duration - 3), dur: 3, ...frame(cx, cy, prev.scale * 1.06, stage) };
}

// Quadratic bezier from a to b, control point pushed sideways by 20% of the distance; 8 samples.
function arc(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = { x: (a.x + b.x) / 2 - dy * 0.2, y: (a.y + b.y) / 2 + dx * 0.2 };
  return Array.from({ length: 8 }, (_, i) => {
    const u = (i + 1) / 8, v = 1 - u;
    return { x: r(v * v * a.x + 2 * v * u * c.x + u * u * b.x, 2), y: r(v * v * a.y + 2 * v * u * c.y + u * u * b.y, 2) };
  });
}

export function direct(events, { format }) {
  const map = stageMap(format);
  const keep = cutPlan(events.duration, events.idle ?? []);
  const at = (t) => remap(t, keep);
  const beats = [...events.beats].sort((a, b) => a.t - b.t);
  const duration = at(events.duration);

  const camera = [];
  for (const b of beats) {
    const box = b.camera === 'focus' && b.box ? toStage(b.box, map) : null;
    const key = cameraFor(box, map, camera.at(-1), at(b.t));
    if (key) camera.push(key);
  }
  if (duration > 4) camera.push(pushIn(camera.at(-1) ?? WIDE, map, duration));

  const cursor = [];
  let from = { x: map.W / 2, y: map.H / 2 };
  for (const b of beats.filter((b) => b.point)) {
    const to = toStage(b.point, map);
    const end = at(b.t);
    const t = r(Math.max(0, end - clamp(400 + Math.hypot(to.x - from.x, to.y - from.y) * 0.6, 400, 1200) / 1000));
    cursor.push({ t, dur: r(end - t), points: arc(from, to), click: b.do === 'click' });
    from = to;
  }

  return {
    duration,
    keep,
    camera,
    cursor,
    callouts: beats.filter((b) => b.callout).map((b) => ({ t: at(b.t), end: at(b.end), text: b.callout, box: b.box && toStage(b.box, map) })),
    chapters: events.scenes.filter((s) => s.title).map((s) => ({ t: at(s.t), end: r(at(s.t) + 1.4), title: s.title })),
    urls: beats.filter((b) => b.do === 'goto').map((b) => ({ t: at(b.t), path: b.path })),
    cues: beats.filter((b) => b.say).map((b) => ({ t: at(b.t), end: at(b.end), say: b.say })),
  };
}
