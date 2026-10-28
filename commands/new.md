---
description: Make a polished, silent demo video of a web app (asks, explores, writes the scenario, records and renders)
argument-hint: "<app url>"
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion
---

Make a presentation video of the web app at: $ARGUMENTS

Follow the `demo-director` skill (and `scenario-writer`, `camera-director` for the details). All
commands run from the user's project directory; outputs go to `.demo/`.

## 0. Dependencies

If `${CLAUDE_PLUGIN_ROOT}/node_modules` is missing, run the doctor first and fix what it reports:
`bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"`.

## 1. Ask (one AskUserQuestion round, never assume)

- **Format**: Desktop (16:9, 1920×1080, app in a browser window) or Mobile (9:16, 1080×1920,
  full screen). Always ask, even if the app looks mobile-first.
- **URL**: use the argument if given, otherwise ask.
- **Login**: none, email/password, or an existing session. For credentials, ask the user to export
  them as environment variables (e.g. `DEMO_EMAIL`, `DEMO_PASSWORD`) and use `$ENV{NAME}` in `setup`
  beats, or save a Playwright storage state to `.demo/auth.json` and set `video.auth`. Never ask
  for the password in chat, never echo it, never write it to a file.
- **Subtitle languages**: default `en` + `fa`.
- **Target length**: default 60–90 s.

## 2. Discover

Open the app headless with Playwright (`playwright-cli` if available; otherwise a short throwaway
node script in the scratchpad that imports `playwright` from `${CLAUDE_PLUGIN_ROOT}/node_modules`).
Log in through the setup steps if needed, list routes and main features, take one screenshot per
page and look at them. Collect stable selectors: prefer `role=button[name="…"]` and `label=…`,
then `text=…`, CSS last. Use seeded or demo data only; flag any real customer data or secrets on screen.

## 3. Scenario

Write `.demo/scenario.yaml` (format in `${CLAUDE_PLUGIN_ROOT}/templates/scenario.example.yaml`)
following `scenario-writer`: hook first, one scene per feature, 2–5 beats each, `say` in every
requested language. Show it as a table (scene | beat | do | target | camera | callout | say.en)
with the estimated length, then **wait for approval**. Apply edits until the user approves.

## 4. Rehearse

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" record --dry-run
```

Fix failing selectors and rehearse again. Don't change the story without asking.

## 5. Record and compose

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" record
node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" compose
```

## 6. Storyboard

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" storyboard
```

Read `.demo/out/storyboard.png` and show it. Ask whether to render or adjust (camera, callouts,
subtitles → compose again; actions or timing → record again).

## 7. Render and report

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" render
```

Report: `.demo/out/demo.mp4` (silent), `.demo/out/demo.<lang>.srt` and `.vtt` per language,
`.demo/out/storyboard.png`, `.demo/scenario.yaml`, and the video length. Mention
`/demo-director:scenario`, `/demo-director:record` and `/demo-director:render` for changes.
