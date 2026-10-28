---
name: scenario-writer
description: Write the story and subtitles for a Demo Director video as .demo/scenario.yaml — scenes, beats, selectors and English/Persian `say` lines. Use when writing, planning, reordering or editing a demo scenario, storyboard script or walkthrough plan ("write the scenario", "plan the demo", "add a scene", "fix the subtitles").
---

# Scenario writer

`.demo/scenario.yaml` is the single source of truth. Story before clicks.

## Story shape (60–90 s)

1. **Hook (first 5 s)**: the most impressive screen, wide, with one line that says what the app
   does for the viewer.
2. **Core workflow**: the one job users come for, in 2–3 scenes.
3. **Two "wow" features**: things that make people say "oh nice" (one-click export, live update…).
4. **Closing shot**: back to the dashboard/home, wide, with a short closing line.

Order features by value, not by menu order. One scene per feature, 2–5 beats each. Budget about
1.6 s per scene card + 0.8 s per pointer action + the `hold` of each beat (default 1.0 s).

## Format

```yaml
video:
  title: Acme in 60 seconds     # composition title
  format: desktop               # desktop | mobile — always the user's answer
  url: http://localhost:3000    # base URL; beat `path` is relative to it
  auth: .demo/auth.json         # optional Playwright storage state
  subtitles: [en, fa]
  style: { accent: "#2747D9" }
setup:                          # optional, runs before filming (e.g. login)
  - { do: goto, path: /login }
  - { do: type, target: label=Email, text: $ENV{DEMO_EMAIL} }
scenes:
  - id: reports                 # required, unique
    title: Reports in seconds   # chapter card text
    beats:
      - do: click
        target: role=button[name="Export"]
        callout: One-click export
        hold: 1.5
        say: { en: Export it with one click., fa: با یک کلیک آن را خروجی بگیرید. }
```

Beat fields:

| Field | Meaning |
|---|---|
| `do` | `goto` (needs `path` or `url`), `click`, `hover`, `type` (needs `text`), `press` (needs `key`, e.g. `Enter`), `scroll` (`target` to scroll into view, or `amount` px, default 600), `wait` (`seconds`, default 1) |
| `target` | Playwright selector: `role=button[name="Export"]`, `label=Search`, `text=…`, or CSS. `click`/`hover`/`type` need one |
| `text` | What to type; `$ENV{NAME}` reads from the environment and is never saved |
| `camera` | `wide` or `focus` (default: `focus` when there is a target, `wide` otherwise) — see `camera-director` |
| `callout` | Short label (2–4 words) shown next to the target |
| `hold` | Seconds to stay after the action (default 1.0; 1.5 after important clicks) |
| `say` | `{en: …, fa: …}`, one key per subtitle language |

## Selectors

Prefer role and label selectors (they survive restyling), then visible text, CSS last. Never use
generated class names or nth-child chains. Check every one with `record --dry-run`.

## Subtitle lines

- Plain spoken language, second person, present tense. At most 12 words per line per language;
  they must fit 2 lines of 42 characters.
- Describe the benefit, not the click ("Find any report by typing", not "Click the search box").
- Persian: natural, not word-for-word; use the zero-width non-joiner (‌) where Persian needs it
  (به‌روز، می‌شود). Keep Latin product names as-is. RTL markers are added automatically.
- Not every beat needs `say`; skip it on pure navigation beats.

## Before approval

Show the scenario as a table (scene | beat | do | target | camera | callout | say.en), the
estimated length, and any data on screen that looks real. Wait for the user's OK.
