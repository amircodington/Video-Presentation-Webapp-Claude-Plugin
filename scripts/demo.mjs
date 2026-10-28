#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { join, resolve } from 'node:path';
import { loadScenario } from './lib/scenario.mjs';
import { record } from './lib/record.mjs';
import { compose } from './lib/compose.mjs';
import { render, storyboard } from './lib/render.mjs';
import { serveStatic } from './lib/serve.mjs';

const USAGE = `Usage: demo.mjs <command> [options]
  record [--dry-run]   film the scenario → raw.mp4 + events.json
  compose              direct + build comp/ and subtitles
  render [--draft]     render out/demo.mp4
  storyboard           out/storyboard.png
  all [--draft]        record → compose → storyboard → render
  serve <dir> [--port] serve a static folder
Options: --dir (.demo)  --scenario (<dir>/scenario.yaml)  --format desktop|mobile  --url <url>`;

const { values: o, positionals: [cmd, arg] } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: '.demo' },
    scenario: { type: 'string' },
    format: { type: 'string' },
    url: { type: 'string' },
    port: { type: 'string', default: '0' },
    'dry-run': { type: 'boolean', default: false },
    draft: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});

const dir = resolve(o.dir);
const scenario = () => {
  const s = loadScenario(o.scenario ?? join(dir, 'scenario.yaml'), { format: o.format });
  if (o.url) s.video.url = o.url;
  return s;
};

const steps = {
  record: async () => {
    await record(scenario(), { workDir: dir, dryRun: o['dry-run'] });
    return o['dry-run'] ? [] : [join(dir, 'raw.mp4'), join(dir, 'events.json')];
  },
  compose: async () => compose(dir, scenario()),
  storyboard: async () => [storyboard(dir)],
  render: async () => [render(dir, { draft: o.draft })],
};

async function main() {
  if (o.help || !cmd) return console.log(USAGE);
  if (cmd === 'serve') {
    if (!arg) throw new Error('serve needs a directory');
    const { url } = await serveStatic(arg, Number(o.port));
    console.log(url);
    return; // the open server keeps the process alive
  }
  const plan = cmd === 'all' ? ['record', 'compose', 'storyboard', 'render'] : [cmd];
  if (!steps[plan[0]]) throw new Error(`unknown command ${cmd}\n${USAGE}`);
  const files = [];
  for (const step of plan) files.push(...(await steps[step]()));
  for (const f of files) console.log(f);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
