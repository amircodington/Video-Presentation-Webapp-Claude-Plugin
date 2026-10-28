import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyScenario, buildHtml, compose } from '../../scripts/lib/compose.mjs';
import { normalizeScenario } from '../../scripts/lib/scenario.mjs';

const d = {
  duration: 8,
  keep: [{ from: 0, to: 8 }],
  camera: [{ t: 1, dur: 0.8, scale: 1.5, x: -200, y: -100 }, { t: 5, dur: 3, scale: 1.59, x: -230, y: -120 }],
  cursor: [
    { t: 0.5, dur: 0.6, points: [{ x: 100, y: 100 }, { x: 200, y: 200 }], click: true },
    { t: 3, dur: 0.5, points: [{ x: 300, y: 300 }], click: false },
  ],
  callouts: [{ t: 1.1, end: 3, text: 'Export <now> & "go"', box: { x: 400, y: 300, w: 100, h: 40 } }],
  chapters: [{ t: 0, end: 1.4, title: 'Reports & stats' }],
  urls: [{ t: 0.2, path: '/' }, { t: 4, path: '/reports' }],
  cues: [],
};

for (const format of ['desktop', 'mobile']) {
  test(`buildHtml ${format}`, () => {
    const html = buildHtml(d, { format, style: { accent: '#2747D9' }, title: 'T<x>', url: 'http://app.test/' });
    const [W, H] = format === 'desktop' ? [1920, 1080] : [1080, 1920];
    assert.match(html, new RegExp(`<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="${W}" data-height="${H}">`));
    assert.match(html, /<video id="take" class="clip" src="take.mp4" muted playsinline data-start="0" data-duration="8">/);
    assert.match(html, /gsap\.timeline\(\{ paused: true \}\)/);
    assert.match(html, /window\.__timelines\["main"\] = tl/);
    assert.match(html, /<script src="gsap.min.js">/);
    assert.equal(html.match(/tl\.to\('#cursor',\{keyframes/g).length, 2);
    assert.equal(html.match(/class="ripple"/g).length, 1);
    assert.match(html, /Export &#60;now&#62; &#38; &#34;go&#34;/);
    assert.match(html, /<div class="chapter" id="ch0"><div class="card">Reports &#38; stats<\/div><\/div>/);
    assert.match(html, /<title>T&#60;x&#62;<\/title>/);
    assert.match(html, /Vazirmatn/);
    assert.equal(html.includes('class="win"'), format === 'desktop');
    if (format === 'desktop') assert.match(html, /<span id="url1">app.test\/reports<\/span>/);
  });
}

test('compose cuts the idle gap and writes the comp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'compose-'));
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=2880x1620:rate=30:duration=4',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', join(dir, 'raw.mp4')]);
    const events = {
      format: 'desktop', viewport: { width: 1440, height: 810 }, dpr: 2, duration: 4,
      beats: [
        { scene: 's', sceneTitle: 'Start', index: 0, do: 'goto', path: '/', t: 0.2, end: 0.5, camera: 'wide' },
        { scene: 's', sceneTitle: 'Start', index: 1, do: 'click', t: 2.8, end: 3.6, box: { x: 600, y: 300, w: 120, h: 40 },
          point: { x: 660, y: 320 }, camera: 'focus', callout: 'Export', say: { en: 'Click export.', fa: 'روی خروجی بزنید.' } },
      ],
      scenes: [{ id: 's', title: 'Start', t: 0, end: 4 }],
      idle: [{ start: 1, end: 2.5 }],
    };
    writeFileSync(join(dir, 'events.json'), JSON.stringify(events));
    const scenario = normalizeScenario({ video: { url: 'http://app.test/' }, scenes: [{ id: 's', beats: [{ do: 'goto', path: '/' }] }] });
    compose(dir, scenario);

    const direct = JSON.parse(readFileSync(join(dir, 'direct.json'), 'utf8'));
    assert.equal(direct.duration, 2.8); // 4 s minus the 1.2 s cut
    const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'comp/take.mp4')], { encoding: 'utf8' });
    assert.ok(Math.abs(dur - direct.duration) < 0.1, `take is ${dur}s`);
    for (const f of ['comp/index.html', 'comp/gsap.min.js', 'out/demo.en.srt', 'out/demo.en.vtt', 'out/demo.fa.srt', 'out/demo.fa.vtt'])
      assert.ok(existsSync(join(dir, f)), f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('applyScenario takes story fields from the edited scenario', () => {
  const sc = normalizeScenario({ video: { url: 'http://x' }, scenes: [{ id: 'a', title: 'New title',
    beats: [{ do: 'click', target: '#b', camera: 'wide', callout: 'New', say: { en: 'New line' } }] }] });
  const ev = applyScenario({ scenes: [{ id: 'a', title: 'Old' }],
    beats: [{ scene: 'a', index: 0, do: 'click', camera: 'focus', callout: 'Old', say: { en: 'Old line' } }] }, sc);
  assert.equal(ev.scenes[0].title, 'New title');
  assert.deepEqual([ev.beats[0].camera, ev.beats[0].callout, ev.beats[0].say.en], ['wide', 'New', 'New line']);
});
