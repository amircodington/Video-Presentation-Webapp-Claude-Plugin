import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../../node_modules/hyperframes/bin/hyperframes.mjs', import.meta.url));
const ENV = { ...process.env, HYPERFRAMES_TELEMETRY_DISABLED: '1', HYPERFRAMES_SKIP_SKILLS: '1' };

function hyperframes(args) {
  const res = spawnSync(process.execPath, [BIN, ...args], { stdio: 'inherit', env: ENV });
  if (res.status !== 0) throw new Error(`hyperframes ${args[0]} failed (exit ${res.status ?? res.signal})`);
}

const hasAudio = (file) =>
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim() !== '';

export function render(workDir, { draft = false } = {}) {
  const out = join(workDir, 'out');
  mkdirSync(out, { recursive: true });
  const file = join(out, 'demo.mp4');
  hyperframes(['render', join(workDir, 'comp'), '-o', file, '-q', draft ? 'draft' : 'standard', '--fps', '30', '--video-frame-format', 'png']);
  if (hasAudio(file)) {
    const tmp = join(out, 'demo.silent.mp4');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-an', '-c', 'copy', tmp]);
    renameSync(tmp, file);
  }
  return file;
}

// Snapshot the middle of each scene (or 6 even times) and tile them into out/storyboard.png.
export function storyboard(workDir) {
  const d = JSON.parse(readFileSync(join(workDir, 'direct.json'), 'utf8'));
  const times = d.chapters.length
    ? d.chapters.map((c, i) => (c.t + (d.chapters[i + 1]?.t ?? d.duration)) / 2)
    : Array.from({ length: 6 }, (_, i) => ((i + 0.5) * d.duration) / 6);
  const snaps = join(workDir, 'snapshots');
  rmSync(snaps, { recursive: true, force: true });
  hyperframes(['snapshot', join(workDir, 'comp'), '-o', snaps, '--at', times.map((t) => t.toFixed(3)).join(','), '--no-end', '--keep']);

  const pngs = readdirSync(snaps).filter((f) => /^at-.*\.png$/.test(f)).sort((a, b) => parseFloat(a.slice(3)) - parseFloat(b.slice(3)));
  if (!pngs.length) throw new Error('hyperframes snapshot produced no frames');
  const seq = join(snaps, 'seq');
  mkdirSync(seq);
  pngs.forEach((f, i) => copyFileSync(join(snaps, f), join(seq, `${String(i).padStart(3, '0')}.png`)));
  const cols = Math.min(pngs.length, 3);
  const file = join(workDir, 'out', 'storyboard.png');
  mkdirSync(join(workDir, 'out'), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', join(seq, '%03d.png'),
    '-vf', `scale=640:-2,tile=${cols}x${Math.ceil(pngs.length / cols)}:padding=8:color=white`, '-frames:v', '1', '-update', '1', file]);
  return file;
}
