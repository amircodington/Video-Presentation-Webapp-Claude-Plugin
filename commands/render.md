---
description: Direct, compose, storyboard and render the silent MP4 plus subtitles from the last take
argument-hint: "[--draft] [--dir .demo]"
allowed-tools: Bash(node:*), Bash(ls:*), Bash(bash:*), Read
---

Turn the existing take into the final video, without re-recording. Use the `demo-director` and
`camera-director` skills.

1. If `${CLAUDE_PLUGIN_ROOT}/node_modules` is missing, run `/demo-director:doctor` first.
2. If `.demo/events.json` is missing, stop and suggest `/demo-director:record`.
   (Edits to `camera`, `callout` and `say` take effect here without a re-take; edits to actions,
   targets or `hold` need `/demo-director:record` again.)
3. Compose (direct + HyperFrames composition + subtitles):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" compose
   ```
4. Storyboard, then open `.demo/out/storyboard.png` with Read and show it to the user. If they
   want changes, edit the scenario and compose again.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" storyboard
   ```
5. Render (pass `--draft` through for a fast preview):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" render $ARGUMENTS
   ```
   Pass `--dir DIR` to every step if the user gave one; `--draft` goes to `render` only.
6. Report the paths: `.demo/out/demo.mp4` (silent, no audio track), `.demo/out/demo.<lang>.srt`
   and `.vtt` for each language, and `.demo/out/storyboard.png`.
