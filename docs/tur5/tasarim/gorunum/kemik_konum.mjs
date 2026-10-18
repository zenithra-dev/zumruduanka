import fs from "node:fs";
import * as THREE from "../../../../src/vendor/three/build/three.module.js";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const parent = new Array(J.nodes.length).fill(-1); J.nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
const W = i => { const n = J.nodes[i], t = new THREE.Vector3(...(n.translation || [0, 0, 0])); return parent[i] < 0 ? t : W(parent[i]).add(t); };
const f3 = v => `(${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)})`;
const names = J.nodes.map(n => n.name);
for (const re of [/Skirt(Front|Side|Back)\d$/, /Hair_Arka04_\d$/, /Hair_Arka04_Govde_\d$/, /Hair_On01_\d$/, /Hair_Percem03_\d$/, /Hair_Orgu01_\d$/, /Hair_Capraz01_\d$/])
  console.log(names.map((n, i) => [n, i]).filter(([n]) => re.test(n)).map(([n, i]) => `${n.replace("J_Sec_", "")}${f3(W(i))}`).join("  "));
// saç köşelerinin kemik dizinine göre ağırlık toplamı (zincirde hangi kemik taşıyor)
const TA = {5121: Uint8Array, 5123: Uint16Array, 5126: Float32Array};
const acc = i => { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], n = {VEC4: 4}[a.type], off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return {d: new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)), norm: a.normalized ? (T === Uint8Array ? 255 : 65535) : 1}; };
const joints = J.skins[0].joints.map(j => names[j]);
for (const [mi, pi, re] of [[2, 1, /Hair_[A-Za-z]+\d+(_Govde)?_(\d)$/], [1, 1, /Skirt[A-Za-z]+(\d)$/]]){
  const p = J.meshes[mi].primitives[pi], Jn = acc(p.attributes.JOINTS_0).d, Wt = acc(p.attributes.WEIGHTS_0), by = {};
  for (let v = 0; v < Jn.length / 4; v++) for (let k = 0; k < 4; k++){ const w = Wt.d[4 * v + k] / Wt.norm, m = joints[Jn[4 * v + k]].match(re); if (w > 0 && m){ const key = m[m.length - 1] + (m[1] && mi === 2 ? "G" : ""); by[key] = (by[key] || 0) + w; } }
  console.log(mi === 2 ? "saç kemik dizini başına ağırlık:" : "etek kemik dizini başına ağırlık:", Object.entries(by).sort().map(([k, v]) => `${k}:${v.toFixed(0)}`).join(" "));
}
