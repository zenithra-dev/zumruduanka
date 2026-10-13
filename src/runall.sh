#!/bin/bash
cd "$(dirname "$0")"
OUT=$1
export NODE_PATH=$(npm root -g)
rm -f frames/*.jpg
for w in 0 1 2; do SONG=$SONG W=$w N=3 node render.js > render$w.log 2>&1 & done
wait
ffmpeg -y -loglevel error -framerate 30 -i frames/f%04d.jpg -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT" && echo DONE
