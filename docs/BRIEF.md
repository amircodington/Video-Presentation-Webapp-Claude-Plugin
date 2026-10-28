# Brief: Video Presentation Webapp Claude Plugin

Starting point for the brainstorm. The full research page, with diagrams and links, is
[`docs/research/blueprint.html`](research/blueprint.html) (live copy: https://claude.ai/artifact/EvdNYv3Dj818Lm8SvZRGZ4).

## Goal

A Claude Code plugin that records a polished presentation video of a web app:

- It first asks whether the video is **desktop** (16:9, 1920×1080) or **mobile** (9:16, 1080×1920).
- It explores the app and writes a feature-by-feature scenario that the user approves.
- It records the browser, then adds camera zooms and pans, a smooth cursor with click ripples,
  callouts, chapter cards and explanatory motion.
- Output: a **silent MP4** plus **subtitle files** (`.srt` and `.vtt`, English and Persian).
- Rendering uses **HyperFrames** (`heygen-com/hyperframes`, its Claude plugin and npm package).

## Core design: record clean, direct later

1. **Ask**: desktop or mobile, URL, login, subtitle languages, target length.
2. **Discover**: crawl routes and features (playwright-cli skill).
3. **Scenario**: `.demo/scenario.yaml` is the single source of truth (scenes → beats with `do`,
   `target`, `camera`, `callout`, `say: {en, fa}`, `hold`).
4. **Rehearse**: dry run that only checks selectors.
5. **Record**: Playwright at `deviceScaleFactor` 2 (desktop) or iPhone emulation at 3 (mobile),
   no effects, writing `raw.mp4` and `events.json` (timestamps, element boxes, clicks, scrolls, idle gaps).
6. **Direct**: turn events into camera keyframes (max zoom 2.2×, eased 0.6–1.2 s moves, lead the
   click by ~0.45 s) and cursor paths (bezier arcs, 400–1200 ms), cut idle time.
7. **Compose**: generate a HyperFrames composition (video layer + GSAP camera + cursor + callouts).
8. **Render**: HyperFrames render without audio, snapshot storyboard, then subtitles from beat times.

## Defaults (confirmed unless Mohammad changes them)

- Desktop: the app inside a browser window on a soft background.
- Mobile: full-screen 9:16.
- Subtitles: English and Persian as separate files.

## Constraints

- Runs headless on a Linux VPS: needs Node 22+, FFmpeg, Chromium, Vazirmatn and Noto Color Emoji fonts.
- Never depend on paid HeyGen features (Avatar IV quota ran out in an earlier project).
- Use seeded or demo data; never record secrets.

## Deliverables

- Installable plugin (`.claude-plugin/plugin.json` + `marketplace.json`, `commands/`, `skills/`, `scripts/`, `templates/`).
- `README.md` with install steps and useful commands after install.
- Tests: unit tests for direct/subtitle logic, and an end-to-end run against a small sample app
  in both desktop and mobile sizes.
