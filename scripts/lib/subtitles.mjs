import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIN = 1.2;
const WIDTH = 42;
const RTL = ['fa', 'ar', 'he'];
const RLM = '\u200F';

function wrap(text) {
  const lines = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = lines.at(-1);
    if (last != null && (lines.length === 2 || (last + ' ' + word).length <= WIDTH)) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

export function buildCues(cues, lang) {
  const said = [...cues].filter((c) => c.say?.[lang]).sort((a, b) => a.t - b.t);
  return said.map((c, i) => {
    const next = said[i + 1]?.t ?? Infinity;
    const end = Math.min(Math.max(c.end, c.t + MIN), next);
    const lines = wrap(c.say[lang]).map((l) => (RTL.includes(lang) ? RLM + l : l));
    return { start: c.t, end: Math.round(end * 1000) / 1000, lines };
  });
}

function stamp(sec, sep) {
  const ms = Math.round(sec * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}

const block = (c, sep) => `${stamp(c.start, sep)} --> ${stamp(c.end, sep)}\n${c.lines.join('\n')}\n\n`;

export const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${block(c, ',')}`).join('');
export const toVtt = (cues) => 'WEBVTT\n\n' + cues.map((c) => block(c, '.')).join('');

export function writeSubtitles(dir, cues, langs) {
  mkdirSync(dir, { recursive: true });
  return langs.flatMap((lang) => {
    const built = buildCues(cues, lang);
    return [['srt', toSrt], ['vtt', toVtt]].map(([ext, fmt]) => {
      const file = join(dir, `demo.${lang}.${ext}`);
      writeFileSync(file, fmt(built));
      return file;
    });
  });
}
