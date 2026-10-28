# Demo Director — design

Date: 2026-10-28. Source: `docs/BRIEF.md` and `docs/research/blueprint.html`.

The brainstorm questions were answered from the brief's confirmed defaults (Mohammad asked for an
autonomous build). Each decision is listed with the reason, so it can be changed later.

## What it is

A Claude Code plugin, `demo-director`, that turns a web app URL into a polished, silent
presentation video plus English and Persian subtitle files. The repo is its own marketplace.

## Decisions

| # | Question | Decision | Why |
|---|----------|----------|-----|
| D1 | Plugin name | `demo-director` (marketplace `demo-director`) | Blueprint name; commands read well: `/demo-director:new`. |
| D2 | Desktop look | App inside a browser window (title bar, traffic lights, URL pill) on a soft gradient background, 1920×1080 | Brief default. |
| D3 | Mobile look | Full-screen 9:16, 1080×1920, touch dot instead of arrow cursor | Brief default. |
| D4 | Desktop capture | Viewport 1440×810 at `deviceScaleFactor` 2 → 2880×1620 frames | Crisp up to 2× zoom in 1080p. |
| D5 | Mobile capture | Viewport 390×693 at density 3, `isMobile`, `hasTouch`, iPhone UA → 1170×2079 frames | 390×693 is exactly 9:16, so the take fills 1080×1920 with no crop (the brief's 390×844 would need cropping). |
| D6 | How to record | Playwright `page.screencast` with `onFrame` JPEG frames (q 90) stamped in epoch ms; frames are assembled into a constant 30 fps `raw.mp4` with FFmpeg's concat demuxer | Frame timestamps use the same clock as our event log, so events line up exactly; `recordVideo` has low bitrate and an unknown start offset (~0.8 s). |
| D7 | Record clean, direct later | No cursor, zoom or overlay in the browser. `events.json` stores per-beat times, element boxes (CSS px), points and idle waits | Blueprint core idea; every edit is a cheap re-render. |
| D8 | Scenario file | `.demo/scenario.yaml`, single source of truth: `video` (format, url, auth, subtitles, style), optional `setup` beats (run before recording, not filmed), `scenes[]` → `beats[]` with `do`, `target`, `path`, `text`, `key`, `camera`, `callout`, `say {en, fa}`, `hold` | Brief schema; `setup` lets a headless VPS log in without a screen. |
| D9 | Secrets | `$ENV{NAME}` in `text` is resolved from the environment at run time and never written to `events.json`; `video.auth` may point to a Playwright storage state file | Never record or print secrets. |
| D10 | Selectors | Playwright selector strings (`role=button[name="Export"]`, `text=…`, CSS), plus `label=…` → `getByLabel` | Role/label selectors survive restyling. |
| D11 | Rehearse | `record --dry-run`: run every beat without filming, report each target that fails | Cheap check before a real take. |
| D12 | Pacing in the take | 0.8 s pause before each pointer action (room for cursor travel and camera lead); `hold` after each beat (default 1.0 s); 1.6 s pause at each scene start for the chapter card | All motion is added later, so the take must leave time for it. |
| D13 | Dead time | Waits longer than 0.3 s (navigation, selector waits, network idle) are logged as idle and **cut** down to 0.3 s; all event times are remapped | Cutting is simpler than speed ramps and keeps pacing brisk. |
| D14 | Camera | `wide` = scale 1. `focus` = `min(2.2, W/(w·1.6), H/(h·1.6))`, centred on the target, clamped so the frame never leaves the stage. Moves ease `power3.inOut`, 0.6–1.2 s by distance, starting 0.45 s before the action. If the previous camera change was under 2 s ago, keep the scale and pan. Final 3 s: slow push-in to 1.06× | Blueprint camera math and camera-director rules. |
| D15 | Camera layer | One stage the size of the output. The camera transforms the whole stage (window + background on desktop), so one formula serves both formats | Simplest; matches Screen Studio. |
| D16 | Cursor | Drawn in HyperFrames inside the camera layer. Bezier arc sampled to keyframes, travel 400–1200 ms by distance, ripple on click. Desktop arrow, mobile touch dot | Blueprint numbers. |
| D17 | Callouts and chapters | Callout = accent label next to the target, in the camera layer. Chapter = title card with blurred backdrop for 1.4 s at each scene start (the take is paused there, D12) | Inserted cards would shift video time; overlays don't. |
| D18 | Spotlight dim | Not in v1 | Ponytail: callouts + zoom already direct the eye. |
| D19 | Composition | `compose` writes `.demo/comp/index.html` (HyperFrames root, muted `<video>`, GSAP timeline on `window.__timelines.main`), copies a local `gsap.min.js` and `take.mp4` (raw with cuts applied via FFmpeg `select`) | No CDN at render time → reproducible. |
| D20 | Render | `hyperframes render .demo/comp -o .demo/out/demo.mp4 -q standard --fps 30 --video-frame-format png`; the MP4 has no audio stream. `--draft` flag uses `-q draft` | Brief: silent MP4; PNG frames keep UI colours exact. |
| D21 | Storyboard | `hyperframes snapshot` at the middle of each scene, tiled into `.demo/out/storyboard.png` with FFmpeg | Check before the final render. |
| D22 | Subtitles | Cue per beat with a `say` line, from the beat's start to its end (plus hold), min 1.2 s, max 2 lines of 42 chars, no overlap. Separate files `demo.en.srt/.vtt`, `demo.fa.srt/.vtt`. Persian lines start with U+200F (RLM) so players lay out RTL correctly. Not burned in | Brief: separate files, silent video. |
| D23 | Code shape | Plain Node ESM, no build step. `scripts/demo.mjs <record|direct|compose|render|storyboard|all|serve>` calls pure modules in `scripts/lib/`. Deps: `playwright`, `hyperframes`, `gsap`, `yaml` | One entry point for commands; pure functions are unit-testable. |
| D24 | Install of deps | Plugin dir has `package.json` + lock; `/demo-director:doctor` runs `scripts/doctor.sh`, which checks Node 22+, FFmpeg, fonts, and runs `npm ci` + `playwright install chromium` + `hyperframes browser ensure` if missing | Plugins ship without `node_modules`. |
| D25 | Tests | `node --test`. Unit: scenario parsing, direct, subtitles, compose HTML. E2E (`npm run test:e2e`): sample app → record → render in desktop and mobile, assert size, no audio, duration, subtitle files | Brief deliverable. |
| D26 | Sample app | `examples/sample-app/`: static "Northwind Ledger" dashboard (KPIs, chart, reports table with search, Export toast, settings), served by `demo.mjs serve`; scenario in `examples/sample-app/scenario.yaml` | Seeded fake data; nothing secret. |
| D27 | Work dir | Everything for a project lives in `.demo/` (`scenario.yaml`, `auth.json`, `raw.mp4`, `events.json`, `direct.json`, `comp/`, `out/`); outputs are git-ignored | One folder to delete or ignore. |
| D28 | Plugins used while building | Superpowers, HyperFrames and Ponytail could not be installed globally on the VPS (blocked by the agent's safety policy); the workflow was followed by hand and Ponytail's rule (simplest working solution, reuse first) applied in review | Recorded so it can be redone once installed. |

## Data flow

```
scenario.yaml ─record─▶ raw.mp4 + events.json ─direct─▶ direct.json ─compose─▶ comp/index.html + take.mp4
                                                                  └──────────▶ demo.<lang>.srt/.vtt
comp/ ─render─▶ out/demo.mp4 (silent)      comp/ ─storyboard─▶ out/storyboard.png
```

### events.json

```json
{ "format": "desktop", "viewport": {"width":1440,"height":810}, "dpr": 2, "duration": 41.2,
  "beats": [{ "scene": "dashboard", "sceneTitle": "Everything at a glance", "index": 0, "do": "click",
              "t": 3.1, "end": 4.6, "box": {"x":10,"y":20,"w":120,"h":40}, "point": {"x":70,"y":40},
              "path": "/reports", "camera": "focus", "callout": "Export", "say": {"en":"…","fa":"…"} }],
  "scenes": [{ "id": "dashboard", "title": "…", "t": 0, "end": 12.3 }],
  "idle": [{ "start": 5.0, "end": 6.8 }] }
```

Times are seconds from the first frame. `t` is the moment of the action; `end` includes the hold.

### direct.json

`{ duration, keep: [{from,to}], camera: [{t,dur,scale,x,y}], cursor: [{t,dur,points:[{x,y}],click}],
callouts: [{t,end,text,box}], chapters: [{t,end,title}], urls: [{t,path}], cues: [{t,end,say}] }` — all
times in output (post-cut) seconds, all positions in stage pixels.

## Error handling

- Scenario validation fails fast with the beat path (`scenes[1].beats[2]: click needs target`).
- A target that does not resolve within 8 s stops the take with that path; `--dry-run` lists all.
- `doctor` prints each missing tool with the exact install command.
