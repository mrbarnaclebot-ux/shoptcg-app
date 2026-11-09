#!/bin/sh
# After `pnpm build`: the buyer pages must ship no Sileo and no motion, and
# their own JS (beyond the framework's root chunks) stays under 70 KB gzipped.
# The dashboard route is checked too, as proof the grep still finds both.
set -eu
cd "$(dirname "$0")/../.next"
LIMIT_KB=70

chunks() {
  grep -o '/_next/static/chunks/[^"]*\.js' "server/app/$1/page_client-reference-manifest.js" | sort -u | sed 's|^/_next/||'
}
has() { # pattern, route
  for f in $(chunks "$2"); do grep -l "$1" "$f"; done | wc -l
}
root=$(node -p 'require("./build-manifest.json").rootMainFiles.join("\n")')

[ "$(has sileo dashboard)" -gt 0 ] || { echo "check is blind: no sileo in dashboard"; exit 1; }
status=0
for r in "[slug]" "[slug]/item/[id]"; do
  s=$(has sileo "$r")
  m=$(has 'MotionConfig\|useAnimate' "$r")
  own=0
  for f in $(chunks "$r"); do
    echo "$root" | grep -qx "$f" || own=$((own + $(gzip -c "$f" | wc -c)))
  done
  all=$own
  for f in $root; do all=$((all + $(gzip -c "$f" | wc -c))); done
  echo "/$r: route JS $((own / 1024)) KB gz, first load $((all / 1024)) KB gz, sileo chunks $s, motion chunks $m"
  [ "$s" -eq 0 ] && [ "$m" -eq 0 ] && [ $((own / 1024)) -le $LIMIT_KB ] || status=1
done
exit $status
