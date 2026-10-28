# Demo Director implementation plan

> For agentic workers: build task by task, one subagent per task (subagent-driven development).
> Each task: write failing tests first where the task has logic, make them pass, keep the code
> minimal (Ponytail: simplest working solution, reuse before writing), commit with a clear message.

**Goal:** the plugin described in `docs/superpowers/specs/2026-10-28-demo-director-design.md`.

**Architecture:** plain Node 22 ESM, no build. `scripts/demo.mjs` is the only CLI; pure logic in
`scripts/lib/*.mjs`; tests in `test/` run with `node --test`. Decisions are referred to as D1…D28.

**Tech:** playwright 1.64, hyperframes 0.8.210, gsap 3.14, yaml 2, FFmpeg 6.

---

### Task 1: Scaffold and scenario parser

Files: `package.json` (name `demo-director`, `"type": "module"`, scripts `test` = `node --test test/unit`,
`test:e2e` = `node --test --test-timeout=1800000 test/e2e`), `.gitignore` (`node_modules/`, `.demo/`,
`examples/**/.demo/`), `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
`scripts/lib/scenario.mjs`, `templates/scenario.example.yaml`, `test/unit/scenario.test.mjs`.

- `loadScenario(file, {format})` → reads YAML, applies `format` override, returns normalized object.
- `normalizeScenario(obj)` (pure): defaults `video.format='desktop'`, `subtitles=['en','fa']`,
  `style={background:'soft-gradient', accent:'#2747D9'}`, beat `hold=1.0`, `camera` = `wide` for
  `goto`, `focus` for actions with a target, otherwise `wide`. Validates: format ∈ {desktop, mobile};
  `do` ∈ {goto, click, hover, type, press, scroll, wait}; goto needs `path` or `url`; click/hover/type
  need `target`; type needs `text`; press needs `key`; scene `id` required and unique. Errors name the
  path, e.g. `scenes[1].beats[2]: click needs target`.
- `resolveEnv(text, env)` replaces `$ENV{NAME}`; throws if unset.
- `FORMATS` constant: desktop `{viewport:{width:1440,height:810}, dpr:2, out:{width:1920,height:1080}}`,
  mobile `{viewport:{width:390,height:693}, dpr:3, isMobile:true, hasTouch:true, out:{width:1080,height:1920}}`.
- plugin.json: name `demo-director`, version `0.1.0`, description, author Mohammad, repository URL.
- marketplace.json: name `demo-director`, owner, one plugin with `source: "./"`.

### Task 2: Subtitles

Files: `scripts/lib/subtitles.mjs`, `test/unit/subtitles.test.mjs`.

- `buildCues(cues, lang)` from direct cues `[{t,end,say}]`: skip missing language, min 1.2 s,
  trim end so cues never overlap the next one, wrap to at most 2 lines of 42 chars (word wrap;
  if still longer, keep 2 lines and let the last one run long rather than drop words).
- `toSrt(cues)` (`1\n00:00:01,200 --> 00:00:03,000\ntext\n\n`) and `toVtt(cues)` (`WEBVTT\n\n` + `.` ms).
- Persian (`fa`, also `ar`, `he`): each line prefixed with U+200F.
- `writeSubtitles(dir, cues, langs)` writes `demo.<lang>.srt` and `.vtt`, returns paths.

### Task 3: Director (events → direct.json)

Files: `scripts/lib/direct.mjs`, `test/unit/direct.test.mjs`.

- `stageMap(format)`: maps CSS px of the viewport to stage px. Desktop: window content
  1536×864 at (192, 130) (title bar 44 px above at y 86); `k = 1536/1440`. Mobile: `k = 1080/390`, offset 0.
- `cutPlan(duration, idle, keep=0.3)` → `keep` segments; `remap(t, keep)` → output time.
- `cameraFor(box, stage, prev, t)`: D14 math with clamping (`x`,`y` are the translate of a
  `transform-origin: 0 0` stage: `x = W/2 - cx*s` clamped to `[W - W*s, 0]`).
- `direct(events, {format})` → direct.json shape from the spec: camera keys (lead 0.45 s, 0.6–1.2 s,
  2-second pan rule, final push-in 1.06× over the last 3 s), cursor moves (bezier arc sampled at 8
  points, travel `clamp(400 + dist*0.6, 400, 1200)` ms ending at the action time, `click` for
  click/tap), callouts (`t` → `end`), chapters (scene start, 1.4 s), urls (goto beats), cues.
- Tests: zoom limit 2.2, clamping keeps frame inside stage, lead time, pan rule, cut remapping,
  cursor travel bounds, chapters per scene.

### Task 4: Sample app

Files: `examples/sample-app/{index.html,reports.html,settings.html,app.css,app.js}`,
`examples/sample-app/scenario.yaml`, `scripts/lib/serve.mjs` (`serveStatic(dir, port=0)` → `{url, close}`
with node:http, correct MIME types).

- "Northwind Ledger": sidebar nav, dashboard (3 KPI cards, SVG chart, "Recent activity"), reports
  (table of 8 rows with a labelled Search input that filters rows, an Export button that shows a
  toast "Report ready"), settings (toggle). Seeded fake data, responsive down to 390 px (sidebar
  becomes a top bar). Uses Vazirmatn/system fonts, no external requests.
- scenario.yaml: 3 scenes (dashboard, reports: search "Acme" + click Export with callout, settings
  toggle), each beat with `say.en` and `say.fa`, total take ~30 s.

### Task 5: Recorder

Files: `scripts/lib/record.mjs`, `test/unit/record.test.mjs` (pure helpers only).

- `record(scenario, {workDir, dryRun})`: launch chromium; context from `FORMATS` (mobile uses
  iPhone 15 UA); `storageState` from `video.auth` if present; run `setup` beats unfilmed; then
  `page.screencast.start({size: viewport*dpr, quality: 90, onFrame})` writing frames to
  `workDir/frames/NNNNNN.jpg` with epoch-ms timestamps. For each scene: pause 1.6 s; for each beat:
  resolve locator (`label=` → `getByLabel`), `scrollIntoViewIfNeeded`, take box, pause 0.8 s for
  pointer actions, log `t`, act (`tap` on mobile for click), wait for load state, log idle waits
  > 0.3 s, `hold`, log `end`. Navigation `goto` resolves relative `path` against `video.url`.
- After stop: `framesToMp4(frames, out, fps=30)` via concat demuxer (per-frame `duration`), H.264
  crf 16 yuv420p, even dimensions; delete frames dir. Write `events.json` (spec shape, no secrets:
  typed text from `$ENV{}` stored as `"•••"`).
- `dryRun`: no screencast, no pauses; collect every failing beat path and throw one error listing them.
- Pure helpers tested: `concatList(frames, endTs)`, `selectorFor`, event time conversion.

### Task 6: Composer, renderer and CLI

Files: `scripts/lib/compose.mjs`, `scripts/lib/render.mjs`, `scripts/demo.mjs`,
`test/unit/compose.test.mjs`.

- `buildHtml(direct, {format, style, title})` (pure): HyperFrames root `data-composition-id="main"`,
  size from format, `#stage` (camera layer, `transform-origin:0 0`) containing background, desktop
  browser window chrome with URL pill (text swapped at `urls` times), `<video id="take" class="clip"
  src="take.mp4" muted playsinline data-start="0" data-duration=…>`, cursor (svg arrow / touch dot),
  ripples, callouts, chapter cards (outside the camera layer). Local `<script src="gsap.min.js">`,
  timeline `{paused:true}` registered at `window.__timelines.main`. Persian-safe font stack
  (`Vazirmatn`, `Noto Color Emoji`).
- `compose(workDir)`: read events + scenario, `direct()`, write `direct.json`, cut `raw.mp4` →
  `comp/take.mp4` with an FFmpeg `select`/`setpts` filter (or copy when no cuts), copy gsap, write HTML,
  write subtitles to `out/`.
- `render(workDir, {draft})`: run the local `hyperframes` bin (resolved from this package), then
  verify with ffprobe that there is no audio stream (strip with `-an -c copy` if there is).
- `storyboard(workDir)`: `hyperframes snapshot` at each scene midpoint, tile with FFmpeg `tile`.
- `demo.mjs`: `record [--dry-run] [--format] [--scenario] [--dir]`, `compose`, `render [--draft]`,
  `storyboard`, `all` (record → compose → storyboard → render), `serve <dir>`; default dir `.demo`.

### Task 7: End-to-end test and sample renders

Files: `test/e2e/pipeline.test.mjs`, `docs/media/` (poster PNG and a small GIF, < 2 MB total).

- For desktop and mobile: serve the sample app, write a temp scenario with its URL, run record →
  compose → render `--draft`; assert 1920×1080 / 1080×1920, no audio stream, duration within ±25 %
  of events, `demo.en.srt`, `demo.fa.vtt` exist and parse.
- Produce full-quality sample renders under `examples/sample-app/.demo-<format>/out/` (git-ignored)
  and a README GIF + poster in `docs/media/`.

### Task 8: Commands, skills, doctor and README

Files: `commands/{new,scenario,record,render,doctor}.md`, `skills/demo-director/SKILL.md`,
`skills/scenario-writer/SKILL.md`, `skills/camera-director/SKILL.md`, `scripts/doctor.sh`, `README.md`.

- Commands call `node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" …` and tell Claude to run doctor first
  when `node_modules` is missing.
- `new.md` follows the blueprint conversation: ask format (never assume), URL, login, languages,
  length; discover; write scenario; show it as a table; wait for approval; rehearse; record; storyboard;
  render; report paths.
- doctor.sh: checks Node ≥ 22, FFmpeg, ffprobe, fonts (`fc-list | grep -i vazirmatn`, emoji), installs
  npm deps, Playwright Chromium, HyperFrames browser; prints exact apt commands for missing fonts.
- README: what it does, GIF, requirements, install (`claude plugin marketplace add
  amircodington/Video-Presentation-Webapp-Claude-Plugin`, `claude plugin install demo-director@demo-director`,
  `/demo-director:doctor`), commands, scenario format, outputs, troubleshooting, development (tests).
