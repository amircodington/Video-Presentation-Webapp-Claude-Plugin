import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageMap, toStage, cutPlan, remap, cameraFor, direct } from '../../scripts/lib/direct.mjs';

const desk = stageMap('desktop');

test('stageMap maps viewport CSS px to stage px', () => {
  assert.deepEqual(desk, { k: 1536 / 1440, ox: 192, oy: 130, W: 1920, H: 1080 });
  assert.deepEqual(stageMap('mobile'), { k: 1080 / 390, ox: 0, oy: 0, W: 1080, H: 1920 });
  assert.deepEqual(toStage({ x: 0, y: 0, w: 1440, h: 810 }, desk), { x: 192, y: 130, w: 1536, h: 864 });
  assert.deepEqual(toStage({ x: 720, y: 405 }, desk), { x: 960, y: 562 });
});

test('cutPlan cuts idle waits down to 0.3 s and remap shifts times', () => {
  const keep = cutPlan(10, [{ start: 2, end: 4 }, { start: 6, end: 6.2 }]);
  assert.deepEqual(keep, [{ from: 0, to: 2.3 }, { from: 4, to: 10 }]);
  assert.equal(remap(1, keep), 1);
  assert.equal(remap(3, keep), 2.3); // inside the cut collapses to the cut point
  assert.equal(remap(5, keep), 3.3);
  assert.equal(remap(10, keep), 8.3);
  assert.deepEqual(cutPlan(5, []), [{ from: 0, to: 5 }]);
});

test('focus zoom is limited to 2.2 and never below 1', () => {
  const tiny = cameraFor({ x: 900, y: 500, w: 20, h: 20 }, desk, undefined, 5);
  assert.equal(tiny.scale, 2.2);
  const huge = cameraFor({ x: 0, y: 0, w: 1900, h: 1000 }, desk, tiny, 9);
  assert.equal(huge.scale, 1);
});

test('clamping keeps the frame inside the stage', () => {
  for (const box of [{ x: 0, y: 0, w: 40, h: 40 }, { x: 1880, y: 1040, w: 40, h: 40 }]) {
    const k = cameraFor(box, desk, undefined, 5);
    const { W, H } = desk;
    assert.ok(k.x <= 0 && k.x >= W - W * k.scale);
    assert.ok(k.y <= 0 && k.y >= H - H * k.scale);
  }
  const corner = cameraFor({ x: 0, y: 0, w: 40, h: 40 }, desk, undefined, 5);
  assert.equal(corner.x, 0);
  assert.equal(corner.y, 0);
});

test('camera leads the action by 0.45 s and moves in 0.6–1.2 s', () => {
  const k = cameraFor({ x: 900, y: 500, w: 200, h: 100 }, desk, undefined, 5);
  assert.equal(k.t, 4.55);
  assert.ok(k.dur >= 0.6 && k.dur <= 1.2);
  assert.equal(cameraFor({ x: 0, y: 0, w: 9, h: 9 }, desk, undefined, 0.2).t, 0);
});

test('camera keeps scale and pans when the last change was under 2 s ago', () => {
  const a = cameraFor({ x: 400, y: 400, w: 100, h: 50 }, desk, undefined, 5);
  const b = cameraFor({ x: 1000, y: 500, w: 800, h: 400 }, desk, a, 6);
  assert.equal(b.scale, a.scale);
  assert.notEqual(b.x, a.x);
  const c = cameraFor({ x: 1000, y: 500, w: 800, h: 400 }, desk, a, 9);
  assert.notEqual(c.scale, a.scale);
});

test('camera skips a key when nothing changes', () => {
  const box = { x: 400, y: 400, w: 100, h: 50 };
  const a = cameraFor(box, desk, undefined, 5);
  assert.equal(cameraFor(box, desk, a, 9), null);
  assert.equal(cameraFor(null, desk, undefined, 5), null); // already wide
});

const events = () => ({
  format: 'desktop', viewport: { width: 1440, height: 810 }, dpr: 2, duration: 20,
  beats: [
    { scene: 'a', index: 0, do: 'goto', t: 0.5, end: 1.5, path: '/', camera: 'wide' },
    { scene: 'a', index: 1, do: 'click', t: 3, end: 4, box: { x: 100, y: 100, w: 100, h: 40 },
      point: { x: 150, y: 120 }, camera: 'focus', callout: 'Export', say: { en: 'Hi', fa: 'سلام' } },
    { scene: 'b', index: 0, do: 'hover', t: 12, end: 13, box: { x: 1000, y: 600, w: 100, h: 40 },
      point: { x: 1050, y: 620 }, camera: 'focus' },
  ],
  scenes: [{ id: 'a', title: 'Start', t: 0, end: 8 }, { id: 'b', t: 8, end: 20 }],
  idle: [{ start: 5, end: 7 }],
});

test('direct builds the direct.json shape with remapped times', () => {
  const d = direct(events(), { format: 'desktop' });
  assert.equal(d.duration, 18.3);
  assert.deepEqual(d.keep, [{ from: 0, to: 5.3 }, { from: 7, to: 20 }]);
  assert.deepEqual(d.urls, [{ t: 0.5, path: '/' }]);
  assert.deepEqual(d.chapters, [{ t: 0, end: 1.4, title: 'Start' }]);
  assert.deepEqual(d.callouts, [{ t: 3, end: 4, text: 'Export',
    box: toStage({ x: 100, y: 100, w: 100, h: 40 }, desk) }]);
  assert.deepEqual(d.cues, [{ t: 3, end: 4, say: { en: 'Hi', fa: 'سلام' } }]);
  assert.equal(d.camera[0].t, 2.55);
  assert.equal(d.camera[1].t, 9.85);
  const [wide, push] = d.camera.slice(-2);
  assert.equal(wide.t, 11.3); // back to wide once the last beat ends
  assert.equal(wide.scale, 1);
  assert.equal(push.t, +(wide.t + wide.dur).toFixed(3));
  assert.equal(push.scale, 1.06);
  assert.equal(+(push.t + push.dur).toFixed(3), d.duration);
});

test('cursor moves arc to each point and end at the action time', () => {
  const d = direct(events(), { format: 'desktop' });
  assert.equal(d.cursor.length, 2);
  const [m1, m2] = d.cursor;
  assert.equal(m1.click, true);
  assert.equal(m2.click, false);
  for (const m of d.cursor) {
    assert.equal(m.points.length, 8);
    assert.ok(m.dur >= 0.4 && m.dur <= 1.2);
  }
  assert.ok(Math.abs(m1.t + m1.dur - 3) < 1e-9);
  assert.deepEqual(m1.points.at(-1), toStage({ x: 150, y: 120 }, desk));
  const mid = m1.points[3];
  const start = { x: 960, y: 540 }, end = m1.points.at(-1);
  const off = Math.abs((end.x - start.x) * (mid.y - start.y) - (end.y - start.y) * (mid.x - start.x));
  assert.ok(off > 1, 'path is an arc, not a straight line');
});

test('mobile zoom is capped lower than desktop', () => {
  const mob = stageMap('mobile');
  assert.equal(cameraFor({ x: 500, y: 900, w: 40, h: 20 }, mob, undefined, 5).scale, 1.5);
});
