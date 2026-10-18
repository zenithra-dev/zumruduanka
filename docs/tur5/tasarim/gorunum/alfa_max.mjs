import fs from "node:fs"; import zlib from "node:zlib";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
function png(b){ let p = 8, w, h, ct, idat = []; while (p < b.length){ const n = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.slice(p + 8, p + 8 + n);
  if (t === "IHDR"){ w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === "IDAT") idat.push(d); else if (t === "IEND") break; p += 12 + n; }
  const ch = {6: 4, 2: 3}[ct], raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * ch), st = w * ch;
  for (let y = 0; y < h; y++){ const f = raw[y * (st + 1)], s = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++){ const a = x >= ch ? out[y * st + x - ch] : 0, u = y ? out[(y - 1) * st + x] : 0, c = x >= ch && y ? out[(y - 1) * st + x - ch] : 0;
      let v = s[x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4){ const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[y * st + x] = v & 255; } } return {w, h, ch, d: out}; }
for (const ti of [6, 9, 26, 13, 4, 7]){ const im = J.images[J.textures[ti].source], bv = J.bufferViews[im.bufferView], I = png(buf.slice(BIN + (bv.byteOffset || 0), BIN + (bv.byteOffset || 0) + bv.byteLength));
  let mx = 0, nz = 0, sumRGB = [0, 0, 0], sa = 0; for (let k = 0; k < I.w * I.h; k++){ const a = I.d[k * 4 + 3]; if (a > mx) mx = a; if (a > 5){ nz++; sa += a; for (let c = 0; c < 3; c++) sumRGB[c] += I.d[k * 4 + c] * a; } }
  console.log(im.name.padEnd(26), "max alfa", mx, "alfa>5 piksel", nz, "alfa ağırlıklı ort sRGB", sumRGB.map(x => (x / Math.max(1, sa)).toFixed(0)).join(","), "ort alfa(>5)", (sa / Math.max(1, nz) / 255).toFixed(3)); }
