import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadScenario, normalizeScenario, resolveEnv, FORMATS } from '../../scripts/lib/scenario.mjs';

const minimal = () => ({
  video: { url: 'http://localhost:4173' },
  scenes: [{ id: 'home', title: 'Home', beats: [
    { do: 'goto', path: '/' },
    { do: 'click', target: 'text=Export' },
    { do: 'wait' },
  ] }],
});

test('applies defaults', () => {
  const s = normalizeScenario(minimal());
  assert.equal(s.video.format, 'desktop');
  assert.deepEqual(s.video.subtitles, ['en', 'fa']);
  assert.deepEqual(s.video.style, { background: 'soft-gradient', accent: '#2747D9' });
  const [goto, click, wait] = s.scenes[0].beats;
  assert.equal(goto.hold, 1.0);
  assert.equal(goto.camera, 'wide');
  assert.equal(click.camera, 'focus');
  assert.equal(wait.camera, 'wide');
  assert.deepEqual(s.setup, []);
});

test('keeps explicit values', () => {
  const obj = minimal();
  obj.video.format = 'mobile';
  obj.video.style = { accent: '#ff0000' };
  obj.scenes[0].beats[1].camera = 'wide';
  obj.scenes[0].beats[1].hold = 2.5;
  const s = normalizeScenario(obj);
  assert.equal(s.video.format, 'mobile');
  assert.deepEqual(s.video.style, { background: 'soft-gradient', accent: '#ff0000' });
  assert.equal(s.scenes[0].beats[1].camera, 'wide');
  assert.equal(s.scenes[0].beats[1].hold, 2.5);
});

test('does not mutate input', () => {
  const obj = minimal();
  normalizeScenario(obj);
  assert.equal(obj.video.format, undefined);
  assert.equal(obj.scenes[0].beats[0].hold, undefined);
});

test('reports every problem with its path', () => {
  const obj = {
    video: { format: 'tv' },
    setup: [{ do: 'type', target: 'label=Email' }],
    scenes: [
      { id: 'a', beats: [{ do: 'goto' }] },
      { id: 'a', beats: [{ do: 'press' }, { do: 'fly' }, { do: 'click' }, { do: 'hover' }] },
      { beats: [] },
    ],
  };
  assert.throws(() => normalizeScenario(obj), (err) => {
    const lines = err.message.split('\n');
    for (const want of [
      'video.format: must be desktop or mobile',
      'setup[0]: type needs text',
      'scenes[0].beats[0]: goto needs path or url',
      'scenes[1]: duplicate id a',
      'scenes[1].beats[0]: press needs key',
      'scenes[1].beats[1]: unknown do fly',
      'scenes[1].beats[2]: click needs target',
      'scenes[1].beats[3]: hover needs target',
      'scenes[2]: id is required',
    ]) assert.ok(lines.includes(want), `missing: ${want}\ngot:\n${err.message}`);
    return true;
  });
});

test('requires scenes', () => {
  assert.throws(() => normalizeScenario({ video: {} }), /scenes: at least one scene is required/);
});

test('resolveEnv replaces names and throws when unset', () => {
  assert.equal(resolveEnv('$ENV{USER_A}:$ENV{PASS}', { USER_A: 'me', PASS: 'pw' }), 'me:pw');
  assert.equal(resolveEnv('plain', {}), 'plain');
  assert.throws(() => resolveEnv('$ENV{MISSING}', {}), /MISSING is not set/);
});

test('FORMATS', () => {
  assert.deepEqual(FORMATS.desktop, { viewport: { width: 1440, height: 810 }, dpr: 2, out: { width: 1920, height: 1080 } });
  assert.deepEqual(FORMATS.mobile, { viewport: { width: 390, height: 693 }, dpr: 3, isMobile: true, hasTouch: true, out: { width: 1080, height: 1920 } });
});

test('loadScenario reads YAML and applies format override', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scenario-'));
  const file = join(dir, 'scenario.yaml');
  writeFileSync(file, 'video:\n  url: http://x\nscenes:\n  - id: one\n    beats:\n      - do: goto\n        path: /\n');
  assert.equal(loadScenario(file).video.format, 'desktop');
  assert.equal(loadScenario(file, { format: 'mobile' }).video.format, 'mobile');
});

test('example template is valid', () => {
  const s = loadScenario(new URL('../../templates/scenario.example.yaml', import.meta.url));
  assert.ok(s.scenes.length > 0);
  assert.ok(s.scenes.some((sc) => sc.beats.some((b) => b.say?.en && b.say?.fa)));
});
