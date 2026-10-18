// VRM 0.0 (glTF ikili) ayrıştırıcı: düğüm hiyerarşisi, dinlenme dünya matrisleri, insansı kemik eşlemesi, skin'li ağların köşeleri (konum, eklem, ağırlık).
// Bağımlılıksız (three yok). Kullanım: import { loadVrm } from "./glb.mjs"
import fs from "node:fs";

const CT = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const NC = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};

export const m4 = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b){ const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]){
    const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    return [(1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
      2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
      2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
  },
  pt(m, p){ return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
  dir(m, p){ return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; }
};

export function loadVrm(file){
  const buf = fs.readFileSync(file), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("glb değil");
  let off = 12, json = null, bin = null;
  while (off < buf.length){ const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), d = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(d.toString("utf8")); else if (type === 0x004e4942) bin = d; off += 8 + len; }
  const acc = i => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type];
    const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new T(a.count * n);
    const src = new DataView(bin.buffer, bin.byteOffset + base, bv.byteLength - (a.byteOffset || 0));
    const rd = {5120: (o) => src.getInt8(o), 5121: (o) => src.getUint8(o), 5122: (o) => src.getInt16(o, true), 5123: (o) => src.getUint16(o, true), 5125: (o) => src.getUint32(o, true), 5126: (o) => src.getFloat32(o, true)}[a.componentType];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = rd(i * stride + k * T.BYTES_PER_ELEMENT);
    if (a.normalized && T !== Float32Array){ const mx = {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}[a.componentType]; return Float32Array.from(out, v => v / mx); }
    return out; };
  const N = json.nodes, parent = new Array(N.length).fill(-1);
  N.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const local = N.map(n => n.matrix ? n.matrix.slice() : m4.trs(n.translation, n.rotation, n.scale));
  const world = new Array(N.length);
  const W = i => world[i] || (world[i] = parent[i] < 0 ? local[i] : m4.mul(W(parent[i]), local[i]));
  N.forEach((_, i) => W(i));
  const vrm = json.extensions && json.extensions.VRM, hb = {};
  if (vrm) for (const b of vrm.humanoid.humanBones) hb[b.bone] = b.node;
  return {json, bin, acc, nodes: N, parent, local, world, hb, name: i => N[i].name};
}
// Skin'li bütün ilkeller: [{mesh, node, skin, pos, jnt, wgt}] ; jnt düğüm indeksine çevrilmiş
export function skinnedPrims(V){
  const out = [];
  V.nodes.forEach((n, ni) => { if (n.mesh === undefined || n.skin === undefined) return;
    const sk = V.json.skins[n.skin], mesh = V.json.meshes[n.mesh];
    mesh.primitives.forEach((p, pi) => { const A = p.attributes; if (A.JOINTS_0 === undefined) return;
      const pos = V.acc(A.POSITION), j = V.acc(A.JOINTS_0), w = V.acc(A.WEIGHTS_0), jn = new Int32Array(j.length);
      for (let k = 0; k < j.length; k++) jn[k] = sk.joints[j[k]];
      out.push({mesh: mesh.name, prim: pi, node: ni, skin: n.skin, pos, jnt: jn, wgt: w, mat: p.material, ibm: sk.inverseBindMatrices !== undefined ? V.acc(sk.inverseBindMatrices) : null, joints: sk.joints}); }); });
  return out;
}
