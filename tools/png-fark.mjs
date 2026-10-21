// İki PNG'nin piksel farkı (headless Chromium'da çözülür; yeni bağımlılık yok): node tools/png-fark.mjs a.png b.png [a2.png b2.png ...]
// Her çift için: farklı piksel oranı (kanal farkı > 8/255), en büyük kanal farkı, ortalama mutlak fark.
import fs from "node:fs";
import { chromium } from "playwright";
const A = process.argv.slice(2), br = await chromium.launch(), pg = await br.newPage(), out = [];
for (let i = 0; i < A.length; i += 2){
  const [a, b] = [A[i], A[i + 1]].map(f => "data:image/png;base64," + fs.readFileSync(f).toString("base64"));
  out.push(Object.assign({a: A[i], b: A[i + 1]}, await pg.evaluate(async ([a, b]) => {
    const px = async u => { const im = new Image(); im.src = u; await im.decode(); const c = Object.assign(document.createElement("canvas"), {width: im.width, height: im.height}), x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const P = await px(a), Q = await px(b); let n = 0, mx = 0, s = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const W = (await (async () => { const im = new Image(); im.src = a; await im.decode(); return im.width; })());
    for (let i = 0; i < P.length; i += 4){ let d = 0; for (let c = 0; c < 3; c++){ const e = Math.abs(P[i + c] - Q[i + c]); d = Math.max(d, e); s += e; } mx = Math.max(mx, d); if (d > 8){ n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    return {farkli_oran: n / (P.length / 4), en_buyuk: mx, ortalama: s / (P.length * 0.75), kutu: n ? [x0, y0, x1, y1] : null}; }, [a, b])));
}
console.log(JSON.stringify(out, null, 1)); await br.close();
