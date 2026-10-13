# Yazılım kulak: YAMNet (AudioSet, 521 sınıf) ile bir ses dosyasının sınıf olasılıkları. Kurulum: bash tools/ear/setup.sh
# Kullanım: python score.py dosya1.wav dosya2.wav ...   → her dosya için ilgili sınıfların ortalama puanı ve en yüksek 5 sınıf
import sys, wave, csv, numpy as np, onnxruntime as ort
HERE = __import__("os").path.dirname(__import__("os").path.abspath(__file__))
names = {int(r[0]): r[2] for r in list(csv.reader(open(HERE + "/model/yamnet_class_map.csv")))[1:]}
sess = ort.InferenceSession(HERE + "/model/yamnet.onnx", providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0]; outs = [o.name for o in sess.get_outputs()]
WATCH = ["Electric guitar", "Guitar", "Acoustic guitar", "Bass guitar", "Distortion", "Synthesizer", "Plucked string instrument", "Zither", "Banjo", "Music", "Drum kit", "Singing"]
def load16k(path):
    w = wave.open(path); sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
    raw = w.readframes(n); w.close()
    a = np.frombuffer(raw, dtype={1: np.int8, 2: np.int16, 4: np.int32}[sw]).astype(np.float32) / (2 ** (8 * sw - 1))
    if ch > 1: a = a.reshape(-1, ch).mean(axis=1)
    if sr != 16000:
        t_old = np.arange(len(a)) / sr; t_new = np.arange(int(len(a) * 16000 / sr)) / 16000
        # basit düşürme: önce kaba alçak geçiren (hareketli ortalama) sonra doğrusal ara değer
        k = max(1, int(sr / 16000)); a = np.convolve(a, np.ones(k) / k, mode="same"); a = np.interp(t_new, t_old, a)
    return a.astype(np.float32)
def score(path):
    a = load16k(path)
    r = sess.run(outs, {inp.name: a}); scores = r[0]  # [frames, 521]; kare 0.96 sn, adım 0.48 sn
    # sessiz kareleri at: her karenin RMS'i -45 dBFS üstünde olmalı
    hop, win = 7680, 15360; keep = []
    for f in range(scores.shape[0]):
        seg = a[f * hop: f * hop + win]
        if len(seg) and 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) > -45: keep.append(f)
    sel = scores[keep] if keep else scores
    m = sel.mean(axis=0); top = np.argsort(m)[::-1][:6]
    return {names[i]: float(m[i]) for i in range(521)}, [(names[i], float(m[i])) for i in top], len(keep), scores.shape[0]
if __name__ == "__main__":
    if len(sys.argv) == 1: print("girdi:", inp.name, inp.shape, inp.type, "çıktılar:", outs); sys.exit()
    for p in sys.argv[1:]:
        allc, top, kept, total = score(p)
        print(f"{p.split('/')[-1]}  ({kept}/{total} kare sesli)")
        print("   izlenen: " + "  ".join(f"{k}={allc[k]*100:.0f}" for k in WATCH if k in allc))
        print("   en yüksek: " + ", ".join(f"{k} {v*100:.0f}%" for k, v in top))
