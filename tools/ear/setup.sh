#!/bin/bash
# Yazılım kulak kurulumu: Python sanal ortamı, onnxruntime ve YAMNet (AudioSet sınıflandırıcısı, Apache-2.0, 16 MB).
#   bash tools/ear/setup.sh
#   tools/ear/venv/bin/python tools/ear/score.py out/guitar/riff-v6.wav
set -e
cd "$(dirname "$0")"
python3 -m venv venv
./venv/bin/pip install -q onnxruntime numpy
mkdir -p model
curl -sS -L -o model/yamnet.onnx "https://huggingface.co/audiomagic/yamnet-onnx/resolve/main/yamnet.onnx"
curl -sS -L -o model/yamnet_class_map.csv "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv"
echo "hazır: $(pwd)/venv/bin/python score.py <dosya.wav>"
