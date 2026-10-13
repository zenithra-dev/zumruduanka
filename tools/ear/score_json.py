import sys, json, numpy as np
from score import score, load16k
out = {}
for p in sys.argv[1:]:
    allc, top, kept, total = score(p)
    a = load16k(p); n = 8192; cs = []
    for o in range(0, len(a) - n, n):
        m = np.abs(np.fft.rfft(a[o:o + n] * np.hanning(n))) ** 2; f = np.fft.rfftfreq(n, 1 / 16000)
        if m.sum() > 1e-6: cs.append(float((f * m).sum() / m.sum()))
    allc["_centroid"] = float(np.median(cs)) if cs else 0.0
    out[p] = allc
print(json.dumps(out))
