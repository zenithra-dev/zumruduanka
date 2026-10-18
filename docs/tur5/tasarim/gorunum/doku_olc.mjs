// VRM içindeki PNG'leri çöz (zlib), dokuların alfa ağırlıklı ortalama rengini ve yüzdeliklerini ölç (sRGB 0-255 ve lineer)
import fs from "node:fs"; import zlib from "node:zlib";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
function png(b){
  let p = 8, w, h, ct, bd, idat = [];
  while (p < b.length){ const n = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.slice(p + 8, p + 8 + n);
    if (t === "IHDR"){ w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } else if (t === "IDAT") idat.push(d); else if (t === "IEND") break; p += 12 + n; }
  const ch = {6: 4, 2: 3, 0: 1, 4: 2}[ct], bpp = ch * bd / 8, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * ch), st = w * bpp;
  for (let y = 0; y < h; y++){ const f = raw[y * (st + 1)], s = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++){ const a = x >= bpp ? out[y * st + x - bpp] : 0, u = y ? out[(y - 1) * st + x] : 0, c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      let v = s[x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4){ const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[y * st + x] = v & 255; } }
  return {w, h, ch, d: out};
}
const lin = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const which = process.argv.slice(2).map(Number);
for (const ti of which.length ? which : [0,3,4,5,6,7,8,9,10,13,14,16,17,18,20,21,23,24,25,26,27]){
  const im = J.images[J.textures[ti].source], bv = J.bufferViews[im.bufferView], b = buf.slice(BIN + (bv.byteOffset || 0), BIN + (bv.byteOffset || 0) + bv.byteLength), I = png(b);
  let n = 0, s = [0, 0, 0], sl = [0, 0, 0], lum = [], an = 0, a0 = 0;
  for (let k = 0; k < I.w * I.h; k++){ const a = I.ch === 4 ? I.d[k * 4 + 3] / 255 : 1; if (a < 0.5){ a0++; continue; } an++;
    const r = I.d[k * I.ch], g = I.d[k * I.ch + 1], bb = I.d[k * I.ch + 2]; s[0] += r; s[1] += g; s[2] += bb; const l = [lin(r), lin(g), lin(bb)]; sl[0] += l[0]; sl[1] += l[1]; sl[2] += l[2]; lum.push(0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]); }
  lum.sort((a, b) => a - b); const q = f => lum.length ? lum[Math.floor(f * (lum.length - 1))].toFixed(3) : "-";
  console.log(`${String(ti).padStart(2)} ${im.name.padEnd(24)} ${I.w}x${I.h} opak%=${(100 * an / (I.w * I.h)).toFixed(0)} ort sRGB=(${s.map(x => (x / an).toFixed(0))}) ort lin=(${sl.map(x => (x / an).toFixed(3))}) lumLin p10/50/90/99=${q(.1)}/${q(.5)}/${q(.9)}/${q(.99)} max=${q(1)}`);
}
