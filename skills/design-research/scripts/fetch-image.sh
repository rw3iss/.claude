#!/usr/bin/env bash
# Download one image URL, verify it is a real image, and print "OK <file> <WxH> <bytes>".
# Usage: fetch-image.sh <url> <output-path-without-extension> [min-short-side-px]
# Exit 1 (and remove the file) when the download is not an image or is too small.
set -uo pipefail
url="$1"; out="$2"; min="${3:-600}"
tmp="$(mktemp)"
curl -sSL --max-time 30 --retry 1 -A "Mozilla/5.0 (X11; Linux x86_64) design-research/1.0" \
    -H "Accept: image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" \
    -e "$(printf '%s' "$url" | sed -E 's#^(https?://[^/]+).*#\1/#')" \
    -o "$tmp" "$url" || { rm -f "$tmp"; echo "FAIL download $url"; exit 1; }
mime="$(file -b --mime-type "$tmp")"
case "$mime" in
    image/jpeg) ext=jpg ;; image/png) ext=png ;; image/webp) ext=webp ;;
    image/avif) ext=avif ;; image/gif) ext=gif ;; image/svg+xml) ext=svg ;;
    *) rm -f "$tmp"; echo "FAIL not-image ($mime) $url"; exit 1 ;;
esac
dims="$(identify -format '%w %h' "$tmp[0]" 2>/dev/null)" || dims="0 0"
read -r w h <<<"$dims"
short=$(( w < h ? w : h ))
if [ "$ext" != svg ] && [ "$short" -lt "$min" ]; then
    rm -f "$tmp"; echo "FAIL too-small (${w}x${h}) $url"; exit 1
fi
mkdir -p "$(dirname "$out")"
mv "$tmp" "$out.$ext"
echo "OK $out.$ext ${w}x${h} $(stat -c %s "$out.$ext")"
