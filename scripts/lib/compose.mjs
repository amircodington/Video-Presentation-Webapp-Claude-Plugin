import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMATS } from './scenario.mjs';
import { direct } from './direct.mjs';
import { writeSubtitles } from './subtitles.mjs';

const GSAP = fileURLToPath(new URL('../../node_modules/gsap/dist/gsap.min.js', import.meta.url));
const FONTS = `"Vazirmatn","Inter",system-ui,"Noto Color Emoji",sans-serif`;
const WIN = { x: 192, y: 86, w: 1536, bar: 44, h: 864 }; // matches stageMap() in direct.mjs

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const color = (c) => (/^#[0-9a-f]{3,8}$|^[a-z]+$/i.test(c ?? '') ? c : '#2747D9');
const parts = (url) => { try { const u = new URL(url); return [u.host, u.pathname]; } catch { return ['', '/']; } };
const J = JSON.stringify;

const ARROW = `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M3 2 L3 23 L9 17.5 L13 26 L17 24.2 L13 16 L21 16 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`;

function css({ W, H, accent, desktop }) {
  return `
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#000}
*{box-sizing:border-box}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:${FONTS}}
#stage{position:absolute;inset:0;transform-origin:0 0}
.bg{position:absolute;inset:0;background:
  radial-gradient(circle at 18% 22%,color-mix(in srgb,${accent} 30%,transparent),transparent 55%),
  radial-gradient(circle at 85% 80%,color-mix(in srgb,${accent} 22%,transparent),transparent 50%),
  linear-gradient(135deg,color-mix(in srgb,${accent} 12%,#fff),color-mix(in srgb,${accent} 4%,#f4f5f8))}
.win{position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.bar + WIN.h}px;border-radius:14px;overflow:hidden;background:#fff;
  box-shadow:0 30px 80px rgba(16,24,40,.28),0 8px 24px rgba(16,24,40,.14),0 0 0 1px rgba(16,24,40,.08)}
.bar{position:absolute;left:0;top:0;right:0;height:${WIN.bar}px;background:#f1f2f5;border-bottom:1px solid #e2e4e9}
.dot{position:absolute;top:16px;width:12px;height:12px;border-radius:50%}
.pill{position:absolute;left:50%;top:9px;width:560px;margin-left:-280px;height:26px;border-radius:13px;background:#fff;border:1px solid #e2e4e9;
  font-size:14px;line-height:24px;color:#4a5160;text-align:center}
.pill span{position:absolute;inset:0;opacity:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 16px}
.content{position:absolute;left:0;top:${WIN.bar}px;width:${WIN.w}px;height:${WIN.h}px;overflow:hidden;background:#fff}
#take{position:absolute;left:0;top:0;width:${desktop ? WIN.w : W}px;height:${desktop ? WIN.h : H}px;object-fit:cover}
#cursor{position:absolute;left:0;top:0;pointer-events:none;z-index:5}
#cursor svg{display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.touch{width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;background:rgba(255,255,255,.45);border:3px solid rgba(20,20,30,.35);box-shadow:0 4px 14px rgba(0,0,0,.25)}
.ripple{position:absolute;width:${desktop ? 64 : 120}px;height:${desktop ? 64 : 120}px;margin:${desktop ? -32 : -60}px 0 0 ${desktop ? -32 : -60}px;border-radius:50%;
  border:4px solid #fff;box-shadow:0 0 0 2px ${accent},inset 0 0 0 2px ${accent};opacity:0;z-index:4}
.callout{position:absolute;opacity:0;z-index:6}
.callout b{display:block;transform:translateX(-50%);white-space:nowrap;background:${accent};color:#fff;font-weight:600;
  font-size:${desktop ? 22 : 34}px;padding:${desktop ? '8px 18px' : '12px 26px'};border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.chapter{position:absolute;inset:0;opacity:0;z-index:10;display:flex;align-items:center;justify-content:center;
  background:rgba(15,18,30,.28);backdrop-filter:blur(14px)}
.card{background:rgba(255,255,255,.94);color:#121826;border-radius:24px;padding:${desktop ? '34px 64px' : '44px 56px'};max-width:${W - 160}px;text-align:center;
  font-size:${desktop ? 56 : 72}px;font-weight:700;box-shadow:0 24px 70px rgba(0,0,0,.3);border-bottom:6px solid ${accent}}
`;
}

// Pure: direct.json → HyperFrames index.html.
export function buildHtml(d, { format = 'desktop', style = {}, title = 'Demo', url = '' } = {}) {
  const { width: W, height: H } = FORMATS[format].out;
  const desktop = format === 'desktop';
  const accent = color(style.accent);
  const n = (v) => +v.toFixed(3);
  const tl = [];
  const html = [];

  // URL pill: one span per address, toggled by opacity.
  const [h, p0] = parts(url);
  const urls = d.urls?.length ? d.urls : [{ t: 0, path: p0 }];
  const spans = urls.map((u, i) => `<span id="url${i}">${esc(h + (u.path ?? ''))}</span>`).join('');
  urls.forEach((u, i) => {
    tl.push(`tl.set('#url${i}',{opacity:1},${i ? n(u.t) : 0});`);
    if (i) tl.push(`tl.set('#url${i - 1}',{opacity:0},${n(u.t)});`);
  });

  const video = `<video id="take" class="clip" src="take.mp4" muted playsinline data-start="0" data-duration="${d.duration}"></video>`;
  const screen = desktop
    ? `<div class="win"><div class="bar"><i class="dot" style="left:18px;background:#ff5f57"></i><i class="dot" style="left:38px;background:#febc2e"></i><i class="dot" style="left:58px;background:#28c840"></i><div class="pill">${spans}</div></div><div class="content">${video}</div></div>`
    : video;

  // Callouts: above the target, or below when there is no room.
  d.callouts.forEach((c, i) => {
    const b = c.box ?? { x: W / 2, y: H - 200, w: 0, h: 0 };
    const pad = desktop ? 60 : 90;
    const top = b.y - pad >= 16 ? b.y - pad : b.y + b.h + 14;
    const left = Math.min(W - 200, Math.max(200, b.x + b.w / 2));
    html.push(`<div class="callout" id="co${i}" style="left:${n(left)}px;top:${n(top)}px"><b>${esc(c.text)}</b></div>`);
    const out = n(Math.max(c.t + 0.6, c.end - 0.3));
    tl.push(`tl.fromTo('#co${i}',{opacity:0,y:10},{opacity:1,y:0,duration:0.3,ease:'power2.out'},${n(c.t)});`);
    tl.push(`tl.to('#co${i}',{opacity:0,y:-6,duration:0.3,ease:'power2.in'},${out});`);
  });

  // Cursor: one keyframed tween per move, ripple on click.
  const start = { x: W / 2, y: H / 2 };
  tl.push(`tl.set('#cursor',{x:${start.x},y:${start.y}},0);`);
  d.cursor.forEach((m, i) => {
    tl.push(`tl.to('#cursor',{keyframes:${J(m.points.map(({ x, y }) => ({ x, y })))},duration:${n(m.dur)},ease:'power1.inOut'},${n(m.t)});`);
    if (!m.click) return;
    const p = m.points.at(-1);
    html.push(`<div class="ripple" id="rp${i}" style="left:${p.x}px;top:${p.y}px"></div>`);
    tl.push(`tl.fromTo('#rp${i}',{scale:0.3,opacity:1},{scale:1.7,opacity:0,duration:0.55,ease:'power2.out',immediateRender:false},${n(m.t + m.dur)});`);
    tl.push(`tl.to('#cursor',{scale:0.85,duration:0.08,yoyo:true,repeat:1},${n(m.t + m.dur)});`);
  });
  const cursor = desktop ? `<div id="cursor">${ARROW}</div>` : `<div id="cursor"><div class="touch"></div></div>`;

  // Camera moves the whole stage; the final push-in eases gently.
  // Moves never overlap: a key that starts early (e.g. the push-in) waits for the previous one.
  let free = 0;
  for (const k of d.camera) {
    const t = Math.max(k.t, free), dur = n(Math.max(0.5, k.t + k.dur - t));
    const ease = k.dur >= 3 ? 'sine.inOut' : 'power3.inOut';
    tl.push(`tl.to('#stage',{scale:${k.scale},x:${k.x},y:${k.y},duration:${dur},ease:'${ease}'},${n(t)});`);
    free = t + dur;
  }

  // Chapter cards sit outside the camera layer.
  const chapters = d.chapters.map((c, i) => {
    tl.push(`tl.fromTo('#ch${i}',{opacity:0},{opacity:1,duration:0.3},${n(c.t)});`);
    tl.push(`tl.fromTo('#ch${i} .card',{scale:0.94,y:16},{scale:1,y:0,duration:0.4,ease:'power3.out'},${n(c.t)});`);
    tl.push(`tl.to('#ch${i}',{opacity:0,duration:0.3},${n(Math.max(c.t + 0.3, c.end - 0.3))});`);
    return `<div class="chapter" id="ch${i}"><div class="card">${esc(c.title)}</div></div>`;
  });
  tl.push(`tl.set({},{},${d.duration});`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${css({ W, H, accent, desktop })}</style>
<script src="gsap.min.js"></script></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${d.duration}" data-width="${W}" data-height="${H}">
<div id="stage"><div class="bg"></div>${screen}
${html.join('\n')}
${cursor}</div>
${chapters.join('\n')}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${tl.join('\n')}
window.__timelines["main"] = tl;
</script>
</body></html>
`;
}

// Cut raw.mp4 down to the kept segments (re-timed to 30 fps); copy when nothing is cut.
function cutTake(raw, out, keep, duration) {
  if (keep.length === 1 && keep[0].from === 0 && keep[0].to >= duration) return copyFileSync(raw, out);
  const select = keep.map(({ from, to }) => `between(t,${from},${to})`).join('+');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf', `select='${select}',setpts=N/30/TB`, '-r', '30',
    '-an', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out]);
}

// Story fields come from the current scenario, so editing say/callout/camera/title needs no re-take.
export function applyScenario(events, scenario) {
  const scenes = new Map(scenario.scenes.map((s) => [s.id, s]));
  for (const sc of events.scenes) sc.title = scenes.get(sc.id)?.title ?? sc.title;
  for (const b of events.beats) {
    const sb = scenes.get(b.scene)?.beats[b.index];
    if (sb) Object.assign(b, { camera: sb.camera, callout: sb.callout, say: sb.say });
  }
  return events;
}

export function compose(workDir, scenario) {
  const events = applyScenario(JSON.parse(readFileSync(join(workDir, 'events.json'), 'utf8')), scenario);
  const format = events.format ?? scenario.video.format;
  const d = direct(events, { format });
  writeFileSync(join(workDir, 'direct.json'), JSON.stringify(d, null, 2));

  const comp = join(workDir, 'comp');
  mkdirSync(comp, { recursive: true });
  cutTake(join(workDir, 'raw.mp4'), join(comp, 'take.mp4'), d.keep, events.duration);
  copyFileSync(GSAP, join(comp, 'gsap.min.js'));
  const html = buildHtml(d, { format, style: scenario.video.style, title: scenario.video.title ?? scenario.title ?? 'Demo', url: scenario.video.url });
  writeFileSync(join(comp, 'index.html'), html);

  const subs = writeSubtitles(join(workDir, 'out'), d.cues, scenario.video.subtitles ?? []);
  return [join(workDir, 'direct.json'), join(comp, 'index.html'), join(comp, 'take.mp4'), ...subs];
}
