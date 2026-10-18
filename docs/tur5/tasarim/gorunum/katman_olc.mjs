// Yüz katmanlarının alttaki yüzeye uzaklığı (mm): katman köşesinden alttaki primitive üçgenine en yakın uzaklık (dinlenme), medyan ve p10
import fs from "node:fs";
import * as THREE from "../../../../src/vendor/three/build/three.module.js";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const TA = {5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const acc = i => { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], n = {SCALAR: 1, VEC3: 3}[a.type], off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)); };
const P = acc(J.meshes[0].primitives[0].attributes.POSITION), prim = k => acc(J.meshes[0].primitives[k].indices);
const v = i => new THREE.Vector3(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
const tri = new THREE.Triangle(), q = new THREE.Vector3();
function dist(top, under){ const T = prim(top), U = prim(under), vs = [...new Set(T)], out = [];
  const tris = []; for (let t = 0; t < U.length; t += 3) tris.push([v(U[t]), v(U[t + 1]), v(U[t + 2])]);
  for (const i of vs){ const p = v(i); let best = 9; for (const [a, b, c] of tris){ tri.set(a, b, c); tri.closestPointToPoint(p, q); best = Math.min(best, q.distanceTo(p)); } if (best < 0.01) out.push(best * 1000); }
  out.sort((a, b) => a - b); const at = f => out.length ? out[Math.floor(f * (out.length - 1))].toFixed(2) : "-"; return `n=${out.length} p10=${at(0.1)} medyan=${at(0.5)} p90=${at(0.9)} mm`; }
const N = {0: "Ağız", 1: "GözAkı", 2: "GözÇizgisi", 3: "Kirpik", 4: "Kaş", 5: "İris", 6: "Parıltı", 7: "Deri", 8: "GözEkstra"};
for (const [a, b] of [[5, 1], [6, 5], [2, 7], [4, 7], [2, 1], [0, 7]]) console.log(`${N[a]} → ${N[b]}:`, dist(a, b));
// gözlük camı ↔ iris/göz çizgisi
