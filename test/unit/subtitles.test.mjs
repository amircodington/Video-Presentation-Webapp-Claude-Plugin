import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCues, toSrt, toVtt, writeSubtitles } from '../../scripts/lib/subtitles.mjs';

const RLM = '‏';
const cues = [
  { t: 1.2, end: 3, say: { en: 'Open the dashboard', fa: 'داشبورد را باز کنید' } },
  { t: 3.5, end: 3.6, say: { en: 'Click Export' } },
  { t: 4.2, end: 8, say: { en: 'Done', fa: 'تمام' } },
];

test('builds cues, skips missing language', () => {
  assert.deepEqual(buildCues(cues, 'en').map((c) => c.lines), [['Open the dashboard'], ['Click Export'], ['Done']]);
  assert.equal(buildCues(cues, 'fa').length, 2);
});

test('min 1.2 s, trimmed so cues never overlap', () => {
  const [a, b, c] = buildCues(cues, 'en');
  assert.deepEqual([a.start, a.end], [1.2, 3]);
  assert.deepEqual([b.start, b.end], [3.5, 4.2]);
  assert.deepEqual([c.start, c.end], [4.2, 8]);
  const [solo] = buildCues([{ t: 0, end: 0.1, say: { en: 'Hi' } }], 'en');
  assert.equal(solo.end, 1.2);
});

test('wraps to at most 2 lines of 42 chars, never drops words', () => {
  const text = 'This is a fairly long subtitle line that needs to wrap onto a second line nicely';
  const [c] = buildCues([{ t: 0, end: 3, say: { en: text } }], 'en');
  assert.equal(c.lines.length, 2);
  assert.ok(c.lines.every((l) => l.length <= 42));
  assert.equal(c.lines.join(' '), text);
  const huge = Array(40).fill('word').join(' ');
  const [h] = buildCues([{ t: 0, end: 3, say: { en: huge } }], 'en');
  assert.equal(h.lines.length, 2);
  assert.equal(h.lines.join(' '), huge);
});

test('RTL languages get RLM on each line', () => {
  const [c] = buildCues(cues, 'fa');
  assert.equal(c.lines[0], RLM + 'داشبورد را باز کنید');
  assert.ok(!buildCues(cues, 'en')[0].lines[0].startsWith(RLM));
});

test('toSrt and toVtt format', () => {
  const c = [{ start: 1.2, end: 3, lines: ['Hello', 'world'] }, { start: 3725.5, end: 3726, lines: ['Bye'] }];
  assert.equal(toSrt(c), '1\n00:00:01,200 --> 00:00:03,000\nHello\nworld\n\n2\n01:02:05,500 --> 01:02:06,000\nBye\n\n');
  assert.equal(toVtt(c), 'WEBVTT\n\n00:00:01.200 --> 00:00:03.000\nHello\nworld\n\n01:02:05.500 --> 01:02:06.000\nBye\n\n');
});

test('writeSubtitles writes srt and vtt per language', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'subs-')), 'out', 'nested');
  const paths = writeSubtitles(dir, cues, ['en', 'fa']);
  assert.deepEqual(paths, ['en.srt', 'en.vtt', 'fa.srt', 'fa.vtt'].map((s) => join(dir, `demo.${s}`)));
  assert.match(readFileSync(join(dir, 'demo.fa.srt'), 'utf8'), /^1\n00:00:01,200 --> 00:00:03,000\n‏/);
  assert.match(readFileSync(join(dir, 'demo.en.vtt'), 'utf8'), /^WEBVTT\n\n/);
});
