---
name: demo-director
description: Record a polished, silent product demo of a web app with camera zooms, a smooth cursor, callouts, chapter cards and timed subtitles (.srt/.vtt, English and Persian), rendered with HyperFrames. Use when the user wants a demo video, product video, walkthrough, feature tour, screencast or presentation recording of a website or web app ("make a demo video of my app", "record a walkthrough", "feature tour video", "ویدیوی معرفی").
---

# Demo Director

Record clean, direct later: the browser take has no effects; zooms, cursor, callouts and chapter
cards are added afterwards, so every edit is a cheap re-render.

CLI (run from the user's project directory; `DD="${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs"`):

```
node "$DD" record [--dry-run]     # scenario.yaml → raw.mp4 + events.json (dry run checks selectors only)
node "$DD" compose                # events → direct.json, comp/ (HyperFrames), out/demo.<lang>.srt/.vtt
node "$DD" storyboard             # out/storyboard.png, one frame per scene
node "$DD" render [--draft]       # out/demo.mp4, silent
node "$DD" all [--draft]          # record → compose → storyboard → render
node "$DD" serve <dir> [--port N] # static server, e.g. for examples/sample-app
common flags: --dir .demo  --scenario <dir>/scenario.yaml  --format desktop|mobile  --url URL
```

If `${CLAUDE_PLUGIN_ROOT}/node_modules` is missing, run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"` first.

## Always start by asking

1. Desktop (16:9, 1920×1080, app inside a browser window) or mobile (9:16, 1080×1920, full screen)?
   **Never assume.** Use AskUserQuestion.
2. The app URL and whether it needs a login. If it does, either put `setup` beats in the scenario
   that type `$ENV{DEMO_EMAIL}` / `$ENV{DEMO_PASSWORD}` (the user exports them; values are never
   saved to events.json), or use a Playwright storage state at `.demo/auth.json` via `video.auth`.
   Never ask for, echo or write down a password.
3. Subtitle language(s) (default `en` + `fa`) and target length (default 60–90 s).

## Steps

1. **Discover**: open the app headless with Playwright (playwright-cli if available, or a short
   node script), list routes and features, take one screenshot per page. Prefer role/label selectors.
2. **Scenario**: write `.demo/scenario.yaml` (see `${CLAUDE_PLUGIN_ROOT}/templates/scenario.example.yaml`)
   with the `scenario-writer` skill: one scene per feature, 2–5 beats each, every beat that matters
   has a `say` line of at most 12 words per language. Set `camera`/`callout`/`hold` with the
   `camera-director` skill. Show it as a table and **wait for approval**.
3. **Rehearse**: `record --dry-run`. Fix failing selectors; do not change the story without asking.
4. **Record**: `record` → `.demo/raw.mp4` + `.demo/events.json`.
5. **Compose**: `compose` → camera and cursor keyframes (`direct.json`), the HyperFrames comp in
   `.demo/comp/` and the subtitle files.
6. **Storyboard**: `storyboard`, then Read `.demo/out/storyboard.png` and show it before the final render.
7. **Render**: `render` (or `--draft` for a quick check) → `.demo/out/demo.mp4`, no audio track.
8. **Report** the paths and length.

What to re-run after an edit:

| Changed in scenario | Re-run |
|---|---|
| `say`, `callout`, `camera`, `video.style`, `video.title`, `video.subtitles` | compose → render |
| `do`, `target`, `text`, `path`, `hold`, scenes added/removed, `video.format`, `video.url` | record → compose → render |

## Rules

- Use demo or seeded data; never record real balances, emails, tokens or passwords.
- Max camera zoom 2.2×; every move eases in and out over 0.6–1.2 s (the director enforces this).
- Hold 1.5 s after each important click so viewers can read.
- Subtitle cues: 1–2 lines, 42 characters per line max, 1.2 s minimum. Subtitles are separate
  files, not burned in; the MP4 is silent by design.
- Troubleshooting: boxes instead of Persian/emoji → install fonts (doctor); selector not found →
  `record --dry-run`; slow render → `--draft`.
