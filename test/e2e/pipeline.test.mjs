import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeScenario } from '../../scripts/lib/scenario.mjs';
import { serveStatic } from '../../scripts/lib/serve.mjs';
import { record } from '../../scripts/lib/record.mjs';
import { compose } from '../../scripts/lib/compose.mjs';
import { render } from '../../scripts/lib/render.mjs';

const app = new URL('../../examples/sample-app/', import.meta.url).pathname;

const probe = (file) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));

// A short take of the sample app: open reports, search, export.
const scenario = (url, format) => normalizeScenario({
  video: { format, url, title: 'E2E' },
  scenes: [{
    id: 'reports', title: 'Reports in seconds',
    beats: [
      { do: 'goto', path: '/reports.html', say: { en: 'Every report in one place.', fa: 'همه‌ی گزارش‌ها در یک جا.' } },
      { do: 'type', target: 'label=Search', text: 'Acme', say: { en: 'Search as you type.', fa: 'هنگام تایپ جست‌وجو کنید.' } },
      { do: 'click', target: 'role=button[name="Export"]', callout: 'One-click export', say: { en: 'Export with one click.', fa: 'با یک کلیک خروجی بگیرید.' } },
    ],
  }],
});

for (const [format, width, height] of [['desktop', 1920, 1080], ['mobile', 1080, 1920]]) {
  test(`sample app → silent ${format} video with subtitles`, async () => {
    const server = await serveStatic(app);
    const dir = mkdtempSync(join(tmpdir(), `demo-e2e-${format}-`));
    try {
      const sc = scenario(server.url, format);
      const events = await record(sc, { workDir: dir, log: () => {} });
      compose(dir, sc);
      const out = render(dir, { draft: true });

      const { streams, format: container } = probe(out);
      assert.equal(streams.filter((s) => s.codec_type === 'audio').length, 0, 'no audio stream');
      const video = streams.find((s) => s.codec_type === 'video');
      assert.deepEqual([video.width, video.height], [width, height]);

      const { duration } = JSON.parse(readFileSync(join(dir, 'direct.json'), 'utf8'));
      assert.ok(duration <= events.duration && duration > events.duration * 0.75, 'idle cut, not more');
      assert.ok(Math.abs(Number(container.duration) - duration) < duration * 0.25);

      for (const lang of ['en', 'fa']) {
        const srt = readFileSync(join(dir, 'out', `demo.${lang}.srt`), 'utf8');
        assert.equal(srt.match(/-->/g).length, 3);
        assert.ok(readFileSync(join(dir, 'out', `demo.${lang}.vtt`), 'utf8').startsWith('WEBVTT'));
      }
      assert.ok(readFileSync(join(dir, 'out', 'demo.fa.srt'), 'utf8').includes('‏'));
      assert.ok(existsSync(join(dir, 'comp', 'index.html')));
    } finally {
      await server.close();
    }
  });
}
