// MASK/BLEND dokularda kullanılan UV'lerde alfa dağılımı: üçgenlerin örnek noktalarında (köşe + ağırlık merkezi) alfa < 0.5 oranı
import fs from "node:fs"; import zlib from "node:zlib";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const src = fs.readFileSync(new URL("./doku_olc.mjs", import.meta.url), "utf8");
function png(b){ let p = 8, w, h, ct, bd, idat = []; while (p < b.length){ const n = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.slice(p + 8, p + 8 + n);
  if (t === "IHDR"){ w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } else if (t === "IDAT") idat.push(d); else if (t === "IEND") break; p += 12 + n; }
  const ch = {6: 4, 2: 3}[ct], bpp = ch, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * ch), st = w * bpp;
  for (let y = 0; y < h; y++){ const f = raw[y * (st + 1)], s = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++){ const a = x >= bpp ? out[y * st + x - bpp] : 0, u = y ? out[(y - 1) * st + x] : 0, c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      let v = s[x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4){ const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      out[y * st + x] = v & 255; } } return {w, h, ch, d: out}; }
const TA = {5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const acc = i => { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], n = {SCALAR: 1, VEC2: 2, VEC3: 3}[a.type], off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)); };
for (const [mi, pi] of [[2, 1], [2, 0], [1, 3], [1, 0], [1, 1], [1, 2], [0, 5], [0, 3], [0, 2], [0, 4], [4, 0]]){
  const pr = J.meshes[mi].primitives[pi], mat = J.materials[pr.material], ti = mat.pbrMetallicRoughness.baseColorTexture && mat.pbrMetallicRoughness.baseColorTexture.index;
  if (ti === undefined){ console.log(mat.name, "dokusuz"); continue; }
  const im = J.images[J.textures[ti].source], bv = J.bufferViews[im.bufferView], I = png(buf.slice(BIN + (bv.byteOffset || 0), BIN + (bv.byteOffset || 0) + bv.byteLength));
  const uv = acc(pr.attributes.TEXCOORD_0), idx = acc(pr.indices);
  const A = (u, v) => { const x = Math.min(I.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * I.w))), y = Math.min(I.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * I.h))); return I.ch === 4 ? I.d[(y * I.w + x) * 4 + 3] / 255 : 1; };
  let n = 0, low = 0, mid = 0, triAllLow = 0;
  for (let t = 0; t < idx.length; t += 3){ let lc = 0;
    const P = [0, 1, 2].map(k => [uv[2 * idx[t + k]], uv[2 * idx[t + k] + 1]]);
    for (const [a, b, c] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]){
      const al = A(a * P[0][0] + b * P[1][0] + c * P[2][0], a * P[0][1] + b * P[1][1] + c * P[2][1]); n++; if (al < 0.5){ low++; lc++; } if (al > 0.02 && al < 0.98) mid++; }
    if (lc === 7) triAllLow++; }
  console.log(`${mat.name.padEnd(34)} ${mat.alphaMode || "OPAQUE"} örnek=${n} alfa<0.5 %=${(100 * low / n).toFixed(1)} yarısaydam(0.02-0.98) %=${(100 * mid / n).toFixed(1)} tamamen kesik üçgen=${triAllLow}/${idx.length / 3}`);
}
