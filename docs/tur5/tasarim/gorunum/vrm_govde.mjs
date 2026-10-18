// Gövde/etek profili: y bantlarında önün (VRM -z) en uç noktası, etek ağırlıklı köşeler, saç uçları
import fs from "node:fs";
const P = "C:/work/karakter/cikti/karakter.vrm", buf = fs.readFileSync(P), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const TA = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array}, NC = {SCALAR: 1, VEC3: 3, VEC4: 4};
const acc = i => { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], n = NC[a.type], off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return {d: new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)), norm: a.normalized ? (T === Uint8Array ? 255 : 65535) : 1}; };
const joints = J.skins[0].joints.map(j => J.nodes[j].name);
function prim(mi, pi){ const p = J.meshes[mi].primitives[pi]; return {P: acc(p.attributes.POSITION).d, Jn: acc(p.attributes.JOINTS_0).d, W: acc(p.attributes.WEIGHTS_0), used: [...new Set(acc(p.indices).d)]}; }
const body = prim(1, 0), tops = prim(1, 1), hair = prim(2, 1);
const wOf = (pr, v, re) => { let s = 0; for (let k = 0; k < 4; k++){ const w = pr.W.d[v * 4 + k] / pr.W.norm; if (w > 0 && re.test(joints[pr.Jn[v * 4 + k]])) s += w; } return s; };
const mode = process.argv[2] || "profil";
if (mode === "profil"){
  console.log("y     | Tops ön z(min) x@ | Body ön z | Tops arka z(max) | Tops yarıgenişlik |x|<0.35 | etek köşe (w>.3) | etek ön min z");
  for (let y = 0.54; y <= 1.46; y += 0.04){
    let tz = 9, tx = 0, bz = 9, tb = -9, hw = 0, ek = 0, ez = 9;
    for (const v of tops.used){ const X = tops.P[3 * v], Y = tops.P[3 * v + 1], Z = tops.P[3 * v + 2]; if (Math.abs(Y - y) > 0.02 || Math.abs(X) > 0.35) continue;
      if (Z < tz){ tz = Z; tx = X; } tb = Math.max(tb, Z); hw = Math.max(hw, Math.abs(X)); const w = wOf(tops, v, /Skirt/); if (w > 0.3){ ek++; ez = Math.min(ez, Z); } }
    for (const v of body.used){ const X = body.P[3 * v], Y = body.P[3 * v + 1], Z = body.P[3 * v + 2]; if (Math.abs(Y - y) > 0.02 || Math.abs(X) > 0.2) continue; bz = Math.min(bz, Z); }
    console.log(y.toFixed(2), "|", tz.toFixed(3), tx.toFixed(3), "|", bz.toFixed(3), "|", tb.toFixed(3), "|", hw.toFixed(3), "|", ek, "|", ez < 9 ? ez.toFixed(3) : "-");
  }
}
if (mode === "etek"){
  // etek ağırlığı olan köşelerin y aralığı ve her zincire en çok ağırlık
  const by = {}; let n = 0, ymin = 9, ymax = -9;
  for (const v of tops.used){ for (let k = 0; k < 4; k++){ const w = tops.W.d[v * 4 + k] / tops.W.norm, nm = joints[tops.Jn[v * 4 + k]]; if (w > 0.01 && /Skirt/.test(nm)){ by[nm] = (by[nm] || 0) + 1; } }
    if (wOf(tops, v, /Skirt/) > 0.01){ n++; ymin = Math.min(ymin, tops.P[3 * v + 1]); ymax = Math.max(ymax, tops.P[3 * v + 1]); } }
  console.log("etek ağırlıklı köşe", n, "y", ymin.toFixed(3), ymax.toFixed(3)); console.log(by);
  // Tops'ta y<0.98 olup etek ağırlığı olmayan köşeler (uyluk/kalça ağırlıklı etek?)
  const other = {}; let m = 0;
  for (const v of tops.used){ if (tops.P[3 * v + 1] > 0.95 || wOf(tops, v, /Skirt/) > 0.01) continue; m++; for (let k = 0; k < 4; k++){ const w = tops.W.d[v * 4 + k] / tops.W.norm; if (w > 0.01){ const nm = joints[tops.Jn[v * 4 + k]]; other[nm] = (other[nm] || 0) + 1; } } }
  console.log("y<0.95 etek ağırlıksız Tops köşesi", m, other);
}
if (mode === "sac"){
  // her zincirin köşe sayısı (baş zinciri / gövde ikizi), uç köşelerin en alt y'si
  const ch = {};
  for (const v of hair.used){ for (let k = 0; k < 4; k++){ const w = hair.W.d[v * 4 + k] / hair.W.norm, nm = joints[hair.Jn[v * 4 + k]]; if (w < 0.01) continue;
    const m = nm.match(/^J_Sec_Hair_([A-Za-z]+\d+)(_Govde)?_(\d)$/); if (!m) continue; const key = m[1] + (m[2] ? "G" : ""); const c = ch[key] = ch[key] || {n: 0, ymin: 9, w: 0}; c.n++; c.ymin = Math.min(c.ymin, hair.P[3 * v + 1]); c.w += w; } }
  for (const [k, c] of Object.entries(ch).sort()) console.log(k.padEnd(12), "köşe", c.n, "en alt y", c.ymin.toFixed(3), "toplam ağırlık", c.w.toFixed(0));
  let mx = 0; for (const v of hair.used){ let n = 0; for (let k = 0; k < 4; k++) if (hair.W.d[v * 4 + k] > 0) n++; mx = Math.max(mx, n); } console.log("köşe başına en çok etki", mx);
}
