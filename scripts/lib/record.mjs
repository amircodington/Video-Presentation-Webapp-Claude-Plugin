import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { FORMATS, resolveEnv } from './scenario.mjs';

const TARGET_TIMEOUT = 8000;
const IDLE_MIN = 300; // ms; shorter waits are not worth cutting (D13)
const POINTER = ['click', 'hover', 'type'];
const even = (n) => Math.ceil(n / 2) * 2;

export function selectorFor(page, target) {
  return target.startsWith('label=') ? page.getByLabel(target.slice(6)) : page.locator(target);
}

// Epoch ms → seconds since the first frame, rounded to ms.
export const toSec = (ts, t0) => Math.round(ts - t0) / 1000;

// Typed text that came from $ENV{} is never written to disk (D9).
export const safeText = (text) => (/\$ENV\{\w+\}/.test(text) ? '•••' : text);

// ffconcat list: each frame lasts until the next one; the last until endTs.
// The concat demuxer ignores the last duration unless the last file is repeated.
export function concatList(frames, endTs) {
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.ts ?? endTs;
    lines.push(`file '${f.file}'`, `duration ${(Math.max(next - f.ts, 1) / 1000).toFixed(3)}`);
  });
  if (frames.length) lines.push(`file '${frames.at(-1).file}'`);
  return lines.join('\n') + '\n';
}

export function framesToMp4(framesDir, frames, endTs, out, fps = 30) {
  const list = join(framesDir, 'list.ffconcat');
  writeFileSync(list, concatList(frames, endTs));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-r', String(fps), '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
}

function contextOptions(video) {
  const f = FORMATS[video.format];
  const opts = { viewport: f.viewport, deviceScaleFactor: f.dpr };
  if (f.isMobile) Object.assign(opts, { isMobile: true, hasTouch: true, userAgent: devices['iPhone 15'].userAgent });
  if (video.auth && existsSync(video.auth)) opts.storageState = video.auth;
  return opts;
}

async function locate(page, target, where) {
  const loc = selectorFor(page, target).first();
  try {
    await loc.waitFor({ state: 'visible', timeout: TARGET_TIMEOUT });
  } catch {
    throw new Error(`${where}: target ${target} not found within ${TARGET_TIMEOUT / 1000} s`);
  }
  await loc.scrollIntoViewIfNeeded();
  return loc;
}

// Runs one beat; returns the event fields (times in epoch ms). `idle(start, end)` logs dead time.
async function runBeat(page, beat, { video, mobile, dry, where, idle }) {
  const pause = (ms) => (dry ? null : page.waitForTimeout(ms));
  const settle = async () => {
    const s = Date.now();
    await page.waitForLoadState('networkidle').catch(() => {});
    idle(s, Date.now());
  };
  const ev = {};
  let loc;
  if (beat.target) {
    const s = Date.now();
    loc = await locate(page, beat.target, where);
    idle(s, Date.now());
  }
  if (POINTER.includes(beat.do)) await pause(800);
  if (loc) {
    const b = await loc.boundingBox();
    if (b) {
      ev.box = { x: b.x, y: b.y, w: b.width, h: b.height };
      ev.point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
  }
  ev.t = Date.now();
  const press = () => (mobile ? loc.tap() : loc.click());
  switch (beat.do) {
    case 'goto': {
      const url = beat.url ?? new URL(beat.path, video.url).href;
      ev.path = beat.path ?? new URL(url).pathname;
      await page.goto(url);
      idle(ev.t, Date.now());
      await settle();
      break;
    }
    case 'click': await press(); await settle(); break;
    case 'hover': await loc.hover(); break;
    case 'type':
      ev.text = safeText(beat.text);
      await press();
      await loc.pressSequentially(resolveEnv(beat.text), { delay: dry ? 0 : 70 });
      break;
    case 'press': ev.key = beat.key; await page.keyboard.press(beat.key); break;
    case 'scroll':
      if (!loc) await page.mouse.wheel(0, beat.amount ?? 600);
      await pause(600);
      break;
    case 'wait': await pause((beat.seconds ?? 1) * 1000); break;
  }
  await pause(beat.hold * 1000);
  ev.end = Date.now();
  return ev;
}

export async function record(scenario, { workDir, dryRun = false, log = console.log }) {
  const { video } = scenario;
  const fmt = FORMATS[video.format];
  const mobile = !!fmt.isMobile;
  const failures = [];
  // Headless screencast frames are in CSS px unless the device scale is forced at launch.
  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${fmt.dpr}`] });
  try {
    const context = await browser.newContext(contextOptions(video));
    const page = await context.newPage();
    const step = async (beat, where, idle) => {
      try {
        return await runBeat(page, beat, { video, mobile, dry: dryRun, where, idle });
      } catch (e) {
        const msg = e.message.startsWith(where) ? e.message : `${where}: ${e.message.split('\n')[0]}`;
        if (!dryRun) throw new Error(msg);
        failures.push(msg);
        log(`✗ ${msg}`);
      }
    };

    for (const [i, beat] of scenario.setup.entries()) await step(beat, `setup[${i}]`, () => {});

    if (dryRun) {
      for (const [i, sc] of scenario.scenes.entries())
        for (const [j, beat] of sc.beats.entries()) await step(beat, `scenes[${i}].beats[${j}]`, () => {});
      if (failures.length) throw new Error(`Rehearsal failed:\n${failures.join('\n')}`);
      log('Rehearsal passed: every beat ran.');
      return { failures };
    }

    const framesDir = join(workDir, 'frames');
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });
    const frames = [];
    const writes = [];
    let gotFirst;
    const first = new Promise((r) => (gotFirst = r));
    await page.screencast.start({
      // Rounded up to even: Playwright floors odd sizes, which would shrink 1170×2079 frames.
      size: { width: even(fmt.viewport.width * fmt.dpr), height: even(fmt.viewport.height * fmt.dpr) },
      quality: 90,
      onFrame: ({ data, timestamp }) => {
        const file = `${String(frames.length).padStart(6, '0')}.jpg`;
        frames.push({ file, ts: timestamp });
        writes.push(writeFile(join(framesDir, file), data));
        gotFirst();
      },
    });
    await Promise.race([first, page.waitForTimeout(2000)]);
    const t0 = frames[0]?.ts ?? Date.now();

    const idle = [];
    const markIdle = (s, e) => e - s > IDLE_MIN && idle.push({ start: s, end: e });
    const beats = [];
    const scenes = [];
    for (const [i, sc] of scenario.scenes.entries()) {
      const scene = { id: sc.id, title: sc.title ?? '' };
      log(`Scene ${sc.id}`);
      // Still time for the chapter card (D12), shown on the scene's own page: after a leading goto.
      const cardPause = async () => { scene.t = Date.now(); await page.waitForTimeout(1600); };
      if (sc.beats[0]?.do !== 'goto') await cardPause();
      for (const [j, beat] of sc.beats.entries()) {
        const ev = await step(beat, `scenes[${i}].beats[${j}]`, markIdle);
        beats.push({
          scene: sc.id, sceneTitle: scene.title, index: j, do: beat.do, ...ev,
          camera: beat.camera, callout: beat.callout, say: beat.say,
        });
        if (j === 0 && beat.do === 'goto') await cardPause();
      }
      scene.end = Date.now();
      scenes.push(scene);
    }

    await page.waitForTimeout(2500); // outro: room for the final wide shot and push-in
    const endTs = Date.now();
    await page.screencast.stop();
    await Promise.all(writes);
    if (!frames.length) throw new Error('screencast produced no frames');
    log(`Encoding ${frames.length} frames…`);
    framesToMp4(framesDir, frames, endTs, join(workDir, 'raw.mp4'));
    rmSync(framesDir, { recursive: true, force: true });

    const s = (ts) => toSec(ts, t0);
    const events = {
      format: video.format, viewport: fmt.viewport, dpr: fmt.dpr, duration: s(endTs),
      beats: beats.map((b) => ({ ...b, t: s(b.t), end: s(b.end) })),
      scenes: scenes.map((sc) => ({ ...sc, t: s(sc.t), end: s(sc.end) })),
      idle: idle.map((w) => ({ start: s(w.start), end: s(w.end) })),
    };
    writeFileSync(join(workDir, 'events.json'), JSON.stringify(events, null, 2) + '\n');
    log(`Wrote ${join(workDir, 'raw.mp4')} (${events.duration} s) and events.json`);
    return events;
  } finally {
    await browser.close();
  }
}
