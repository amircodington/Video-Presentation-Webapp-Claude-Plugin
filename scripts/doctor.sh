#!/usr/bin/env bash
# demo-director doctor: checks system tools and installs the plugin's own dependencies.
# Usage: bash scripts/doctor.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0
ok()   { printf '  \342\234\223 %s\n' "$1"; }
bad()  { printf '  \342\234\227 %s\n      fix: %s\n' "$1" "$2"; FAIL=1; }
have() { command -v "$1" >/dev/null 2>&1; }

if [ "$(uname -s)" = "Darwin" ]; then
  FIX_FFMPEG="brew install ffmpeg"
  FIX_NODE="brew install node@22"
  FIX_VAZIR="brew install --cask font-vazirmatn"
  FIX_EMOJI="brew install --cask font-noto-color-emoji"
else
  FIX_FFMPEG="sudo apt-get install -y ffmpeg"
  FIX_NODE="curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
  FIX_VAZIR="sudo apt-get install -y fonts-vazirmatn && fc-cache -f"
  FIX_EMOJI="sudo apt-get install -y fonts-noto-color-emoji && fc-cache -f"
fi

echo "System"
if have node; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -ge 22 ]; then ok "Node $(node -v)"; else bad "Node $(node -v) is older than 22" "$FIX_NODE"; fi
else
  bad "Node not found" "$FIX_NODE"
fi
if have ffmpeg;  then ok "ffmpeg";  else bad "ffmpeg not found"  "$FIX_FFMPEG"; fi
if have ffprobe; then ok "ffprobe"; else bad "ffprobe not found" "$FIX_FFMPEG"; fi

echo "Fonts"
if have fc-list; then
  if fc-list | grep -qi vazirmatn; then ok "Vazirmatn"; else bad "Vazirmatn missing (Persian renders as boxes)" "$FIX_VAZIR"; fi
  if fc-list | grep -qi "Noto Color Emoji"; then ok "Noto Color Emoji"; else bad "Noto Color Emoji missing (icons render as boxes)" "$FIX_EMOJI"; fi
else
  bad "fc-list not found (fontconfig)" "sudo apt-get install -y fontconfig"
fi

if [ "$FAIL" -ne 0 ] && ! have node; then
  echo; echo "Fix the items above, then run doctor again."; exit 1
fi

echo "Plugin dependencies ($ROOT)"
cd "$ROOT" || exit 1
if [ -d node_modules ]; then
  ok "node_modules present"
else
  echo "  … npm ci --omit=dev"
  if npm ci --omit=dev --no-audit --no-fund; then ok "npm dependencies installed"; else bad "npm ci failed" "cd \"$ROOT\" && npm ci --omit=dev"; fi
fi

if [ -d node_modules/playwright ]; then
  echo "  … npx playwright install chromium"
  if npx --no-install playwright install chromium >/dev/null; then ok "Playwright Chromium"; else bad "Playwright Chromium install failed" "cd \"$ROOT\" && npx playwright install chromium"; fi

  if node -e "import('playwright').then(async ({chromium}) => { const b = await chromium.launch(); await b.close(); })" >/dev/null 2>&1; then
    ok "Chromium launches headless"
  else
    bad "Chromium does not launch (missing system libraries?)" "cd \"$ROOT\" && sudo npx playwright install --with-deps chromium"
  fi
fi

HF="node_modules/hyperframes/bin/hyperframes.mjs"
if [ -f "$HF" ]; then
  echo "  … hyperframes browser ensure"
  if node "$HF" browser ensure >/dev/null; then ok "HyperFrames browser"; else bad "HyperFrames browser missing" "cd \"$ROOT\" && node $HF browser ensure"; fi
else
  bad "hyperframes package missing" "cd \"$ROOT\" && npm ci --omit=dev"
fi

echo
if [ "$FAIL" -ne 0 ]; then echo "Some checks failed. Run the fix commands above, then run doctor again."; exit 1; fi
echo "All good. Next: /demo-director:new <url>"
