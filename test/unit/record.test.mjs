import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { concatList, selectorFor, toSec, safeText, record } from '../../scripts/lib/record.mjs';
import { normalizeScenario } from '../../scripts/lib/scenario.mjs';

test('concatList gives each frame a duration until the next and repeats the last file', () => {
  const list = concatList([{ file: '000000.jpg', ts: 1000 }, { file: '000001.jpg', ts: 1250.5 }], 2000);
  assert.equal(list, [
    'ffconcat version 1.0',
    "file '000000.jpg'", 'duration 0.251',
    "file '000001.jpg'", 'duration 0.750',
    "file '000001.jpg'", '',
  ].join('\n'));
});

test('selectorFor maps label= to getByLabel, everything else to locator', () => {
  const page = { getByLabel: (s) => ['label', s], locator: (s) => ['locator', s] };
  assert.deepEqual(selectorFor(page, 'label=Email'), ['label', 'Email']);
  assert.deepEqual(selectorFor(page, 'role=button[name="Export"]'), ['locator', 'role=button[name="Export"]']);
});

test('toSec converts epoch ms to seconds since the first frame', () => {
  assert.equal(toSec(1700000003100.4, 1700000000000), 3.1);
  assert.equal(toSec(1000, 1000), 0);
});

test('safeText hides text that uses $ENV{}', () => {
  assert.equal(safeText('$ENV{DEMO_PASSWORD}'), '•••');
  assert.equal(safeText('Q3'), 'Q3');
});

test('record films a tiny page into raw.mp4 + events.json', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dd-record-'));
  writeFileSync(join(dir, 'index.html'), `<!doctype html><body style="font:24px sans-serif">
    <button onclick="document.body.style.background='#cde'">Go</button>
    <label>Name <input></label></body>`);
  const scenario = normalizeScenario({
    video: { format: 'desktop', url: pathToFileURL(dir + '/').href },
    scenes: [{ id: 's1', title: 'One', beats: [
      { do: 'goto', path: 'index.html', hold: 0.3 },
      { do: 'click', target: 'role=button[name="Go"]', hold: 0.5 },
      { do: 'type', target: 'label=Name', text: '$ENV{DD_SECRET}', hold: 0.3 },
    ] }],
  });
  process.env.DD_SECRET = 'hunter2';
  const events = await record(scenario, { workDir: dir, log: () => {} });

  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,r_frame_rate', '-of', 'csv=p=0', join(dir, 'raw.mp4')], { encoding: 'utf8' }).trim();
  assert.equal(probe, '2880,1620,30/1');
  assert.ok(!existsSync(join(dir, 'frames')));

  const saved = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(events)));
  assert.equal(saved.beats.length, 3);
  for (const b of saved.beats) assert.ok(b.t < b.end, `${b.do}: t < end`);
  assert.ok(saved.beats[0].path.endsWith('/index.html')); // resolved path, as the address bar shows it
  for (const b of saved.beats.slice(1)) assert.ok(b.box.w > 0 && b.box.h > 0 && b.point.x > 0);
  assert.equal(saved.beats[2].text, '•••');
  assert.ok(!readFileSync(join(dir, 'events.json'), 'utf8').includes('hunter2'));
  assert.deepEqual(saved.scenes.map((s) => s.id), ['s1']);
  assert.ok(saved.duration >= saved.scenes[0].end);
});

test('dry run lists every failing beat in one error', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dd-dry-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><button>Go</button>');
  const scenario = normalizeScenario({
    video: { format: 'mobile', url: pathToFileURL(dir + '/').href },
    scenes: [{ id: 's1', beats: [
      { do: 'goto', path: 'index.html' },
      { do: 'click', target: '#missing-a' },
      { do: 'click', target: 'role=button[name="Go"]' },
      { do: 'hover', target: '#missing-b' },
    ] }],
  });
  await assert.rejects(record(scenario, { workDir: dir, dryRun: true, log: () => {} }),
    (e) => /scenes\[0\]\.beats\[1\]/.test(e.message) && /scenes\[0\]\.beats\[3\]/.test(e.message)
      && !/beats\[2\]/.test(e.message));
  assert.ok(!existsSync(join(dir, 'raw.mp4')));
});
