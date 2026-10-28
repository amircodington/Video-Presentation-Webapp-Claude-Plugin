---
name: camera-director
description: Taste rules for camera moves, cursor and callouts in a Demo Director video, and which scenario fields drive them (camera wide|focus, callout, hold). Use when choosing zooms, focus shots, callouts or pacing, or when the user says the video is too zoomy, too fast, blurry or hard to follow ("tweak the camera", "zoom on the button", "slow it down").
---

# Camera director

The camera is computed from the take (`events.json`) by the director in `compose`; you steer it
from the scenario. Edits to `camera` and `callout` only need `compose` + `render`; edits to `hold`
change the take, so they need `record` again.

## Fields that drive the camera

| Field | Effect |
|---|---|
| `camera: wide` | Full frame (scale 1). Default for beats without a target and for `goto`. |
| `camera: focus` | Zoom to the beat's target: scale = min(2.2 desktop or 1.5 mobile, W/(w·1.6), H/(h·1.6)), centred, clamped so the frame never leaves the stage. Default for beats with a target. |
| `callout` | Accent label next to the target, shown from the action to the end of the hold. |
| `hold` | Seconds the take stays still after the action (default 1.0) — reading time for the shot. |

Automatic (not configurable per beat): moves ease `power3.inOut` over 0.6–1.2 s by distance and
start 0.45 s before the action; if the previous camera change was under 2 s ago the scale is kept
and the camera pans; the last 3 s get a slow 6 % push-in; idle waits over 0.3 s are cut; the
cursor travels on a bezier arc in 400–1200 ms and ripples on click (desktop arrow, mobile touch dot);
each scene opens with a 1.4 s chapter card.

## Taste rules

- **Wide when a page loads**, focus when acting. Every `goto` and the first beat of a scene: `wide`.
- **Never zoom twice within 2 seconds.** Neighbouring targets → pan, not zoom-out-zoom-in. If
  two focus beats are on opposite sides of the screen, put a `wide` beat (or a longer `hold`) between.
- **Focus on small things** (buttons, fields, badges); **stay wide on big things** (tables, charts,
  whole cards) — a large target barely zooms anyway.
- **Callouts sparingly**: at most one per scene, 2–4 words, on the "wow" beat. Not on every click.
- **Hold 1.5 s after important clicks** and on beats with a callout or a long `say` line; 1.0 s
  elsewhere. Never below 0.6 s.
- **Typing**: focus on the field; keep the text short (≤ 12 characters) so it reads in time.
- **Closing**: end on a `wide` beat with `hold: 2` so the push-in has room.
- **Mobile**: targets are already large in 9:16; prefer `wide` more often and focus only on small
  controls. Keep callouts short — the frame is narrow.

## Fixes for common complaints

- Too zoomy / dizzy → change some `focus` beats to `wide`, especially consecutive ones.
- Blurry zoom → the target is tiny; the 2.2× cap and capture at dpr 2 (desktop) / 3 (mobile) keep
  it sharp. Choose a larger target (the whole control group) instead.
- Too fast to read → raise `hold` (re-record).
- Viewer gets lost → add a `wide` beat at the start of the scene and a callout on the key action.
