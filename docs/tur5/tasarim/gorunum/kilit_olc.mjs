// Çene ↔ choker kilidi: kamera yüksekliği ve baş eğimine göre kilit merkezinin görünürlüğü (yüz derisi + saç üçgenlerine ışın testi), LBS ile.
// VRM yerel (ön -Z). Baş eğimi θ: boyun 0.4θ (pivot neck), baş 0.6θ (pivot head); kilit köşeleri kendi Neck/Head/UpperChest ağırlıklarıyla.
import fs from "node:fs";
import * as THREE from "../../../../src/vendor/three/build/three.module.js";
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const TA = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array}, NC = {SCALAR: 1, VEC3: 3, VEC4: 4};
const acc = i => { const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0);
  return {d: new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * NC[a.type] * T.BYTES_PER_ELEMENT)), norm: a.normalized ? (T === Uint8Array ? 255 : 65535) : 1}; };
const joints = J.skins[0].joints.map(j => J.nodes[j].name);
const pr = (mi, pi) => { const p = J.meshes[mi].primitives[pi]; return {P: acc(p.attributes.POSITION).d, Jn: acc(p.attributes.JOINTS_0).d, W: acc(p.attributes.WEIGHTS_0), I: acc(p.indices).d}; };
const NECK = new THREE.Vector3(0, 1.433, 0.015), HEAD = new THREE.Vector3(0, 1.510, 0.005);
function mats(th){ const Rn = new THREE.Matrix4().makeRotationX(-0.4 * th), Rh = new THREE.Matrix4().makeRotationX(-0.6 * th);   // -x dönüş: VRM'de ön -Z, öne eğilme
  const about = (R, p) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  const Mn = about(Rn, NECK), Mh = Mn.clone().multiply(about(Rh, HEAD)); return {J_Bip_C_Neck: Mn, J_Bip_C_Head: Mh, J_Bip_C_UpperChest: new THREE.Matrix4()}; }
function pose(p, th, k){ const M = mats(th), v = new THREE.Vector3(p.P[3 * k], p.P[3 * k + 1], p.P[3 * k + 2]), o = new THREE.Vector3(), t = new THREE.Vector3();
  for (let j = 0; j < 4; j++){ const w = p.W.d[4 * k + j] / p.W.norm; if (!w) continue; const m = M[joints[p.Jn[4 * k + j]]] || new THREE.Matrix4(); o.addScaledVector(t.copy(v).applyMatrix4(m), w); } return o; }
const face = pr(0, 7), lock = pr(5, 1), hair = pr(2, 1);
// test noktaları: kilidin ön yüzündeki köşelerin ortası ve kalp sarkacının alt ucu
const lockIdx = [...new Set(lock.I)];
// sınırlı yüz kümesi: çene bölgesi (y < 1.53) yüz derisi
const tris = (p, filt) => { const out = []; for (let t = 0; t < p.I.length; t += 3){ const a = p.I[t], b = p.I[t + 1], c = p.I[t + 2]; if (filt(p.P[3 * a + 1], p.P[3 * a + 2])) out.push([a, b, c]); } return out; };
const faceT = tris(face, (y, z) => y < 1.56), hairT = tris(hair, (y, z) => y < 1.56 && z < 0.0);
const ray = new THREE.Ray(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), hit = new THREE.Vector3();
function visible(cam, th){
  const cache = new Map(), P = (p, k) => { const key = (p === face ? "f" : "h") + k; let v = cache.get(key); if (!v){ v = pose(p, th, k); cache.set(key, v); } return v; };
  const pts = lockIdx.map(k => pose(lock, th, k)), front = pts.filter(q => q.z < -0.040);
  let vis = 0;
  for (const q of front){ ray.origin.copy(cam); ray.direction.subVectors(q, cam); const dist = ray.direction.length(); ray.direction.normalize(); let blocked = false;
    for (const [p, T] of [[face, faceT], [hair, hairT]]){ for (const [a, b, c] of T){ if (ray.intersectTriangle(P(p, a), P(p, b), P(p, c), false, hit) && hit.distanceTo(cam) < dist - 0.002){ blocked = true; break; } } if (blocked) break; }
    if (!blocked) vis++; }
  return vis / front.length;
}
const ref = new THREE.Vector3(0, 1.549, -0.022);
const shots = {close: [1.55, 0.42, -0.12, 0.05], medium: [1.95, 0.5, -0.38, 0.08], guitar: [1.63, 0.6, -0.68, 0.36], hero: [2.6, 0.34, -0.4, -0.22], hero_oda: [2.05, 0.34, -0.4, -0.22],
  hero_K: [2.4, 0.34, -0.36, -0.12], hero_K2: [2.4, 0.34, -0.36, -0.06]};
console.log("çekim       kamera y(zemin)  kilide yükseliş°  görünür oranı θ=0/10/20/27°   (u=0 ve u=1 ortalaması, sağ ve sol)");
for (const [n, [d0, lat, look, rise]] of Object.entries(shots)){
  const hy = look + rise * d0; const r = [];
  for (const th of [0, 10, 20, 27].map(x => x * Math.PI / 180)){ let s = 0, c = 0;
    for (const u of [0, 1]) for (const sg of [-1, 1]){ const d = d0 * (1.07 - 0.12 * u), cam = new THREE.Vector3(sg * (lat + 0.12 * u) * d, ref.y + hy, ref.z - d); s += visible(cam, th); c++; }
    r.push((s / c).toFixed(2)); }
  const camY = ref.y + hy, el = Math.atan2(1.466 - camY, d0) * 180 / Math.PI;
  console.log(n.padEnd(10), camY.toFixed(3).padStart(8), el.toFixed(1).padStart(10), "   ", r.join(" / "));
}
// sahne kamerası (kulüp orbit: hedef dünya (0.27, 0.09, 0), r 1.3, phi 1.3): Kanade kökü (0.2, -0.95, -0.19), 180° dönük → VRM yerelinde
for (const [n, phi] of [["stage φ1.30", 1.3], ["stage φ1.45", 1.45], ["stage φ1.55", 1.55]]){ const r = [];
  for (const th of [0, 10, 20, 27].map(x => x * Math.PI / 180)){ let s = 0, c = 0;
    for (const theta of [0.5, 0.2, -0.1]){ const wx = 0.27 + 1.3 * Math.sin(phi) * Math.sin(theta), wy = 0.09 - 1.3 * Math.cos(phi), wz = 0 + 1.3 * Math.sin(phi) * Math.cos(theta);
      const cam = new THREE.Vector3(-(wx - 0.2), wy + 0.95, -(wz + 0.19)); s += visible(cam, th); c++; }
    r.push((s / c).toFixed(2)); }
  console.log(n.padEnd(12), (0.09 - 1.3 * Math.cos(phi) + 0.95).toFixed(3), "            ", r.join(" / "));
}
console.log("\ngöğüs hizası kamera (y=1.30) uzaklığa göre: yükseliş° ve görünür oranı θ=0/10/20/27°");
for (const [y, d] of [[1.30, 0.3], [1.30, 0.45], [1.30, 0.6], [1.30, 0.9], [1.30, 1.3], [1.15, 0.6], [1.0, 0.6], [1.0, 1.0]]){ const r = [];
  for (const th of [0, 10, 20, 27].map(x => x * Math.PI / 180)) r.push(visible(new THREE.Vector3(0, y, -0.045 - d), th).toFixed(2));
  console.log(`y=${y} d=${d}`.padEnd(14), (Math.atan2(1.466 - y, d) * 180 / Math.PI).toFixed(1).padStart(6), "  ", r.join(" / ")); }
