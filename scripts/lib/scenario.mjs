import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export const FORMATS = {
  desktop: { viewport: { width: 1440, height: 810 }, dpr: 2, out: { width: 1920, height: 1080 } },
  mobile: { viewport: { width: 390, height: 693 }, dpr: 3, isMobile: true, hasTouch: true, out: { width: 1080, height: 1920 } },
};

const ACTIONS = ['goto', 'click', 'hover', 'type', 'press', 'scroll', 'wait'];
const NEEDS_TARGET = ['click', 'hover', 'type'];

export function loadScenario(file, { format } = {}) {
  const obj = parse(readFileSync(file, 'utf8')) ?? {};
  if (format) obj.video = { ...obj.video, format };
  return normalizeScenario(obj);
}

function beatProblem(b) {
  if (!ACTIONS.includes(b.do)) return `unknown do ${b.do}`;
  if (b.do === 'goto' && !b.path && !b.url) return 'goto needs path or url';
  if (NEEDS_TARGET.includes(b.do) && !b.target) return `${b.do} needs target`;
  if (b.do === 'type' && b.text == null) return 'type needs text';
  if (b.do === 'press' && !b.key) return 'press needs key';
}

function normalizeBeat(b, where, errors) {
  const problem = beatProblem(b);
  if (problem) errors.push(`${where}: ${problem}`);
  const camera = b.camera ?? (b.do !== 'goto' && b.target ? 'focus' : 'wide');
  return { ...b, hold: b.hold ?? 1.0, camera };
}

export function normalizeScenario(obj) {
  const errors = [];
  const video = {
    format: 'desktop',
    subtitles: ['en', 'fa'],
    ...obj.video,
    style: { background: 'soft-gradient', accent: '#2747D9', ...obj.video?.style },
  };
  if (!FORMATS[video.format]) errors.push('video.format: must be desktop or mobile');

  const setup = (obj.setup ?? []).map((b, i) => normalizeBeat(b, `setup[${i}]`, errors));

  if (!obj.scenes?.length) errors.push('scenes: at least one scene is required');
  const ids = new Set();
  const scenes = (obj.scenes ?? []).map((sc, i) => {
    if (!sc.id) errors.push(`scenes[${i}]: id is required`);
    else if (ids.has(sc.id)) errors.push(`scenes[${i}]: duplicate id ${sc.id}`);
    ids.add(sc.id);
    const beats = (sc.beats ?? []).map((b, j) => normalizeBeat(b, `scenes[${i}].beats[${j}]`, errors));
    return { ...sc, beats };
  });

  if (errors.length) throw new Error(errors.join('\n'));
  return { ...obj, video, setup, scenes };
}

export function resolveEnv(text, env = process.env) {
  return text.replace(/\$ENV\{(\w+)\}/g, (_, name) => {
    if (env[name] == null) throw new Error(`$ENV{${name}}: ${name} is not set`);
    return env[name];
  });
}
