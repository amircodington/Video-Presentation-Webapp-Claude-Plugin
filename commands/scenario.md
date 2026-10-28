---
description: Write or edit the demo scenario (.demo/scenario.yaml) and get it approved
argument-hint: "[what to change, e.g. \"add a scene for Settings\"]"
allowed-tools: Bash(node:*), Bash(ls:*), Bash(mkdir:*), Read, Write, Edit, AskUserQuestion
---

Write or edit `.demo/scenario.yaml` in the current project. Follow the `scenario-writer` skill for
the story and `camera-director` for `camera`, `callout` and `hold`. The format is documented in
`${CLAUDE_PLUGIN_ROOT}/templates/scenario.example.yaml`.

Request: $ARGUMENTS

1. If `.demo/scenario.yaml` exists, read it and apply the request. If it does not, start from the
   template; if there is no URL or format yet, use `/demo-director:new` instead (it asks the questions).
2. Never put passwords or tokens in the file: use `$ENV{NAME}` in `text`, or `video.auth: .demo/auth.json`.
3. Show the result as a table: scene title | beat | `do` | target | camera | callout | `say.en`.
   Also give the estimated length (sum of holds + ~1.5 s per action + 1.6 s per scene).
4. Wait for the user's approval before recording.
5. If `${CLAUDE_PLUGIN_ROOT}/node_modules` exists, check the selectors with a rehearsal:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" record --dry-run
   ```
   (if it is missing, run `/demo-director:doctor` first). Fix failing selectors only.
