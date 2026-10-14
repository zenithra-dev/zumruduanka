#!/bin/bash
# Bir şarkıyı videoya çeker: işçiler kareleri paylaşır, ffmpeg ses ve kareleri birleştirir.
#   tools/runall.sh <şarkı indeksi|id> [çıktı.mp4]       → varsayılan çıktı: out/zumruduanka-<şarkı>.mp4
#   SEED=7 tools/runall.sh kaf                            → farklı tohum, farklı doğaçlama/varyasyon
#   WORKERS=4 FPS=30 WORK=out/work IMG=png|jpg ...
#   T0=0 T1=1 WORKERS=1 tools/runall.sh dagkrali out/parca.mp4   → yalnız bu saniyeler (ses aynı yerden kesilir)
# Video BT.709, sınırlı aralık (tv) olarak kodlanır ve etiketlenir; oynatıcılar HD içeriği böyle varsayar.
set -euo pipefail
cd "$(dirname "$0")/.."
SONG="${1:-${SONG:-0}}"
WORK="${WORK:-out/work}"
WORKERS="${WORKERS:-3}"
FPS="${FPS:-30}"
EXT="${IMG:-png}"
mkdir -p "$WORK/frames"; rm -f "$WORK"/frames/*.jpg "$WORK"/frames/*.png "$WORK"/render*.log "$WORK"/name.txt
pids=()
for ((w = 0; w < WORKERS; w++)); do
  SONG="$SONG" W=$w N="$WORKERS" FPS="$FPS" OUT="$WORK" IMG="$EXT" node tools/render.js > "$WORK/render$w.log" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do
  wait "$p" || { echo "render işçisi hata verdi; $WORK/render*.log dosyalarına bak" >&2; exit 1; }
done
NAME=$(cat "$WORK/name.txt")
OUTFILE="${2:-out/$NAME.mp4}"
FIRST=$(ls "$WORK/frames" | grep -m1 -E "^f[0-9]{4}\.$EXT$" || true)
[ -n "$FIRST" ] || { echo "kare bulunamadı: $WORK/frames/*.$EXT" >&2; exit 1; }
START=$((10#${FIRST:1:4}))
SS=$(awk -v s="$START" -v f="$FPS" 'BEGIN{printf "%.6f", s / f}')
ffmpeg -y -loglevel error -framerate "$FPS" -start_number "$START" -i "$WORK/frames/f%04d.$EXT" -ss "$SS" -i "$WORK/audio.wav" \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:v libx264 -crf 16 -preset medium -c:a aac -b:a 192k -shortest -movflags +faststart "$OUTFILE"
echo "DONE $OUTFILE"
