// VRM 0.0 (glTF ikili) okuyucu: three'siz, node'da ve tarayıcıda aynı. Üretici araç (tools/kanade-iskelet.mjs) ile yükleyici (vrm.js) paylaşır.
//   parseGlb(ab) → {json, bin}; accessor(json, bin, i) → {array, itemSize, count}; restWorld(json) → {world, parent} (düğüm başına 16'lık sütun
//   matrisi); humanoid(json) → {kemik adı: düğüm dizini}; handFrame(P, sol) → el çerçevesi; toF(v) → figür çerçevesi.
// Figür çerçevesi F: +z ön, +x figürün solu, y yerden. VRM 0.0 -z'ye bakar (sol -X): F = R_y(π)·V, yani (x, y, z) → (-x, y, -z).

const CT = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const NC = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
const NORM = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535};

export function parseGlb(ab){
  const dv = new DataView(ab);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("glb değil");
  let off = 12, json = null, bin = null;
  while (off + 8 <= ab.byteLength){
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, off + 8, len)));
    else if (type === 0x004e4942) bin = new Uint8Array(ab, off + 8, len);
    off += 8 + len;
  }
  if (!json || !bin) throw new Error("glb: JSON ya da BIN yığını yok");
  return {json, bin};
}
// Erişimci (accessor) okuması: aralıklı (byteStride) ve normalize tamsayı dahil; döner kopya
export function accessor(json, bin, i){
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type], sz = T.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || n * sz, base = (bv.byteOffset || 0) + (a.byteOffset || 0), dv = new DataView(bin.buffer, bin.byteOffset + base);
  const rd = {5120: o => dv.getInt8(o), 5121: o => dv.getUint8(o), 5122: o => dv.getInt16(o, true), 5123: o => dv.getUint16(o, true), 5125: o => dv.getUint32(o, true), 5126: o => dv.getFloat32(o, true)}[a.componentType];
  const out = a.normalized && T !== Float32Array ? new Float32Array(a.count * n) : new T(a.count * n), k = a.normalized && NORM[a.componentType] ? 1 / NORM[a.componentType] : 1;
  for (let v = 0; v < a.count; v++) for (let c = 0; c < n; c++) out[v * n + c] = rd(v * stride + c * sz) * k;
  return {array: out, itemSize: n, count: a.count};
}
// Dinlenme dünya matrisleri (TRS, sütun öncelikli) ve ebeveynler
const trs = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) => { const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0, 2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
    2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1]; };
const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
export function restWorld(json){
  const N = json.nodes, parent = new Array(N.length).fill(-1), world = new Array(N.length);
  N.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const W = i => world[i] || (world[i] = (L => parent[i] < 0 ? L : mul(W(parent[i]), L))(N[i].matrix ? N[i].matrix.slice() : trs(N[i].translation, N[i].rotation, N[i].scale)));
  N.forEach((_, i) => W(i));
  return {world, parent};
}
export const posOf = m => [m[12], m[13], m[14]];
export const toF = v => [-v[0], v[1], -v[2]];
export function humanoid(json){
  const o = {}, V = json.extensions && json.extensions.VRM;
  if (!V) throw new Error("VRM uzantısı yok");
  for (const b of V.humanoid.humanBones) o[b.bone] = b.node;
  return o;
}

/* ---------- El çerçevesi (tek tanım: üretici araç da çalışma zamanı kalibrasyonu da bunu çağırır) ---------- */
// P(ad) → eklemin konumu [x, y, z] (hangi çerçevede olursa: tanım dönmeye göre eşdeğişkin). y = Middle1 − Hand (orta parmak kökü),
// z = (Index1 − Little1) × y (avucun baktığı yan; sağ el), x = y × z (başparmak yanı). Sol el (sol = true) sağ elin x aynasıdır (mankendeki gibi
// scale.x = −1 vekil): z = y × (Index1 − Little1), x = z × y; taban sol ellidir (det −1), tablolar sağ el gibi okunur.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function handFrame(P, sol){
  const s = sol ? "L" : "R", o = P(`J_Bip_${s}_Hand`), y = nrm(sub(P(`J_Bip_${s}_Middle1`), o)), t = sub(P(`J_Bip_${s}_Index1`), P(`J_Bip_${s}_Little1`));
  let z = sol ? crs(y, t) : crs(t, y); z = nrm(sub(z, y.map(c => c * dot(z, y))));
  const x = sol ? crs(z, y) : crs(y, z);
  return {o, x, y, z, loc: p => { const d = sub(p, o); return [dot(d, x), dot(d, y), dot(d, z)]; }, dir: d => [dot(d, x), dot(d, y), dot(d, z)]};
}
export const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"];
// El tablosu (HAND biçimi, figures.js makeHand): parmak başına b kök eklemi, l boğum boyları (VRM ofsetleri birebir; uç = *_end), d kökten orta
// ekleme dinlenme yönü; hepsi handFrame çerçevesinde. r, ab, pa ölçüden ya da mankenden gelir (çağıran ekler).
export function handTable(P, sol){
  const s = sol ? "L" : "R", F = handFrame(P, sol);
  return FINGERS.map(f => { const n = k => P(`J_Bip_${s}_${f}${k}`), e = P(`J_Bip_${s}_${f}3_end`);
    return {b: F.loc(n(1)), l: [[n(1), n(2)], [n(2), n(3)], [n(3), e]].map(([a, b]) => Math.hypot(...sub(b, a))), d: F.dir(nrm(sub(n(2), n(1))))}; });
}
