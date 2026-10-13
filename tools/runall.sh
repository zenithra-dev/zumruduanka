#!/bin/bash
# Bir şarkıyı videoya çeker: 3 işçi kareleri paylaşır, ffmpeg ses ve kareleri birleştirir.
#   tools/runall.sh <şarkı indeksi|id> [çıktı.mp4]       → varsayılan çıktı: out/zumruduanka-<şarkı>.mp4
#   SEED=7 tools/runall.sh kaf                            → farklı tohum, farklı doğaçlama/varyasyon
set -euo pipefail
cd "$(dirname "$0")/.."
SONG="${1:-${SONG:-0}}"
WORK="${WORK:-out/work}"
mkdir -p "$WORK/frames"; rm -f "$WORK"/frames/*.jpg "$WORK"/render*.log "$WORK"/name.txt
pids=()
for w in 0 1 2; do
  SONG="$SONG" W=$w N=3 OUT="$WORK" node tools/render.js > "$WORK/render$w.log" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do
  wait "$p" || { echo "render işçisi hata verdi; $WORK/render*.log dosyalarına bak" >&2; exit 1; }
done
NAME=$(cat "$WORK/name.txt")
OUTFILE="${2:-out/$NAME.mp4}"
ffmpeg -y -loglevel error -framerate 30 -i "$WORK/frames/f%04d.jpg" -i "$WORK/audio.wav" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 192k -shortest -movflags +faststart "$OUTFILE"
echo "DONE $OUTFILE"
