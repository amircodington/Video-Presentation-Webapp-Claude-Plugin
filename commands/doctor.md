---
description: Check Node, FFmpeg, fonts and Chromium, and install the plugin's npm dependencies
allowed-tools: Bash(bash:*)
---

Run the Demo Director doctor:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.sh"
```

Show the user each ✓/✗ line. For every ✗, show the exact `fix:` command printed under it.

- Do not run `sudo`/`apt-get`/`brew` installs yourself unless the user says so; offer the commands.
- After the user fixes something, run the doctor again until it exits 0.
- If it ends with "All good", tell the user the next step: `/demo-director:new <url>`.
