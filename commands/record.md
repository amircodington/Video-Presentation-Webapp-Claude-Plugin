---
description: Rehearse the scenario (dry run), then record a clean take to .demo/raw.mp4 and events.json
argument-hint: "[--dry-run] [--format desktop|mobile] [--url URL] [--dir .demo]"
allowed-tools: Bash(node:*), Bash(ls:*), Bash(bash:*), Read, Edit
---

Record (or re-record) the take for the scenario in the current project. Use the `demo-director`
skill for context.

1. If `${CLAUDE_PLUGIN_ROOT}/node_modules` is missing, run `/demo-director:doctor` first
   (`bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"`).
2. If `.demo/scenario.yaml` (or the `--dir`/`--scenario` given) does not exist, stop and suggest
   `/demo-director:new` or `/demo-director:scenario`.
3. Rehearse from the user's project directory:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" record --dry-run $ARGUMENTS
   ```
   If any target fails, fix the selector in the scenario (prefer `role=…` / `label=…`) and rehearse
   again. Do not change the story (scenes, order, `say` lines) without asking.
4. Unless the user passed `--dry-run`, record the real take:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/demo.mjs" record $ARGUMENTS
   ```
5. Report `.demo/raw.mp4` and `.demo/events.json`, the take length, and suggest
   `/demo-director:render` next. Never print secret values from `$ENV{…}` or `.demo/auth.json`.
