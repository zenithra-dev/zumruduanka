// Salt okur ölçüm: VRM'in iskeleti, zincirleri, ağ sınırları, ağırlıklar, morph hedefleri. node vrm_olc.mjs [bolum]
import fs from "node:fs";
import * as THREE from "../../../../src/vendor/three/build/three.module.js";
const P = "C:/work/karakter/cikti/karakter.vrm";
const buf = fs.readFileSync(P), L = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + L)), BIN = 20 + L + 8;
const what = process.argv[2] || "iskelet";
const TA = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const NC = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
function acc(i){
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView], T = TA[a.componentType], n = NC[a.type];
  const off = BIN + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
  const out = new T(a.count * n);
  if (stride === n * T.BYTES_PER_ELEMENT){ const src = new T(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)); out.set(src); }
  else for (let k = 0; k < a.count; k++){ const s = new T(buf.buffer.slice(buf.byteOffset + off + k * stride, buf.byteOffset + off + k * stride + n * T.BYTES_PER_ELEMENT)); out.set(s, k * n); }
  let norm = 1; if (a.normalized){ norm = T === Uint8Array ? 255 : T === Uint16Array ? 65535 : 1; }
  return {data: out, n, count: a.count, norm, min: a.min, max: a.max};
}
// Dünya matrisleri (dinlenme)
const parent = new Array(J.nodes.length).fill(-1);
J.nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
const local = J.nodes.map(n => { const m = new THREE.Matrix4();
  if (n.matrix) m.fromArray(n.matrix); else m.compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1]))); return m; });
const world = []; const W = i => { if (world[i]) return world[i]; const m = parent[i] < 0 ? local[i].clone() : W(parent[i]).clone().multiply(local[i]); world[i] = m; return m; };
J.nodes.forEach((_, i) => W(i));
const pos = i => new THREE.Vector3().setFromMatrixPosition(world[i]);
const name = i => J.nodes[i].name;
const byName = Object.fromEntries(J.nodes.map((n, i) => [n.name, i]));
const f3 = v => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
const depth = i => { let d = 0; while (parent[i] >= 0){ i = parent[i]; d++; } return d; };
const V = J.extensions.VRM;
const HB = Object.fromEntries(V.humanoid.humanBones.map(h => [h.bone, h.node]));

if (what === "iskelet"){
  const rot = J.nodes.filter(n => n.rotation && (Math.abs(n.rotation[3]) < 0.99999)).length;
  console.log("dönüşlü düğüm sayısı (dinlenmede rotation≠birim):", rot, " ölçekli:", J.nodes.filter(n => n.scale && n.scale.some(x => Math.abs(x - 1) > 1e-6)).length);
  console.log("kök düğümler:", J.scenes[0].nodes.map(name).join(", "));
  for (const b of ["hips", "spine", "chest", "upperChest", "neck", "head", "leftEye", "rightEye", "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand", "rightUpperArm", "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes", "rightUpperLeg", "leftIndexProximal", "leftThumbProximal", "jaw"]) if (HB[b] !== undefined) console.log(b.padEnd(18), name(HB[b]).padEnd(24), f3(pos(HB[b])), "rot", JSON.stringify(J.nodes[HB[b]].rotation || null));
  console.log("humanoid kemik sayısı", V.humanoid.humanBones.length, "jaw?", HB.jaw !== undefined);
}
if (what === "zincir"){
  const sec = J.nodes.map((n, i) => i).filter(i => /^J_Sec_/.test(name(i)));
  console.log("J_Sec_ düğüm sayısı", sec.length);
  // zincir kökleri: ebeveyni J_Sec_ olmayanlar
  const roots = sec.filter(i => !/^J_Sec_/.test(name(parent[i])));
  const cls = {};
  for (const r of roots){
    const ch = []; let k = r; for (;;){ ch.push(k); const c = (J.nodes[k].children || []).filter(x => /^J_Sec_/.test(name(x))); if (!c.length) break; if (c.length > 1) ch.push("dal" + c.length); k = c[0]; }
    const len = ch.filter(x => typeof x === "number").slice(1).reduce((s, x, j, A) => s + pos(x).distanceTo(pos(j ? A[j - 1] : r)), 0);
    const key = name(r).replace(/_?\d+$/, "").replace(/(Back|Front|Side)\d*$/, "$1");
    (cls[name(parent[r])] = cls[name(parent[r])] || []).push(`${name(r)}[${ch.length}] ${f3(pos(r))}→${f3(pos(ch.filter(x => typeof x === "number").pop()))} L=${len.toFixed(3)}`);
  }
  for (const [p, a] of Object.entries(cls)){ console.log("EBEVEYN", p, a.length); a.forEach(s => console.log("   ", s)); }
}
if (what === "agirlik"){
  // primitive başına: etkileyen eklemler (ağırlık > 0.01) sınıflara göre köşe sayısı
  const skinJ = J.skins.map(s => s.joints);
  J.meshes.forEach((m, mi) => {
    const ni = J.nodes.findIndex(n => n.mesh === mi), sk = J.nodes[ni].skin, joints = skinJ[sk];
    m.primitives.forEach((p, pi) => {
      const I = acc(p.attributes.JOINTS_0), Wt = acc(p.attributes.WEIGHTS_0), idx = acc(p.indices).data, used = new Set(idx);
      const cnt = {}, P0 = acc(p.attributes.POSITION);
      for (const v of used){ let best = ""; const seen = new Set();
        for (let k = 0; k < 4; k++){ const w = Wt.data[v * 4 + k] / Wt.norm; if (w > 0.01){ const nm = name(joints[I.data[v * 4 + k]]); const c = /Hair.*Govde/.test(nm) ? "sacGovde" : /Hair/.test(nm) ? "sac" : /Skirt/.test(nm) ? "etek" : /Sleeve/.test(nm) ? "kol_sec" : /Bust/.test(nm) ? "gogus_sec" : /Sec/.test(nm) ? "sec" : nm.replace(/^J_(Bip|Adj)_/, ""); seen.add(c); } }
        for (const c of seen) cnt[c] = (cnt[c] || 0) + 1; }
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(" ");
      console.log(`${m.name}/${pi} ${J.materials[p.material].name} kullanılan köşe=${used.size} | ${top}`);
    });
  });
  // IBM'ler aynı mı
  const ib = J.skins.map(s => acc(s.inverseBindMatrices).data);
  let maxd = 0; for (let s = 1; s < ib.length; s++) for (let k = 0; k < ib[0].length; k++) maxd = Math.max(maxd, Math.abs(ib[s][k] - ib[0][k]));
  const same = J.skins.every(s => s.joints.join() === J.skins[0].joints.join());
  // IBM · dünya(dinlenme) ≈ birim mi
  let maxe = 0; J.skins[0].joints.forEach((j, k) => { const m = new THREE.Matrix4().fromArray(ib[0], k * 16), r = world[j].clone().multiply(m).elements; r.forEach((x, q) => { maxe = Math.max(maxe, Math.abs(x - (q % 5 === 0 ? 1 : 0))); }); });
  console.log("eklem listeleri aynı:", same, " IBM farkı en çok:", maxd.toExponential(2), " dünya·IBM − I en çok:", maxe.toExponential(2));
  console.log("mesh düğüm matrisleri:", J.nodes.filter(n => n.mesh !== undefined).map(n => `${n.name} T=${JSON.stringify(n.translation || 0)} R=${JSON.stringify(n.rotation || 0)}`).join(" | "));
}
if (what === "sinir"){
  // Bağlama pozunda (dinlenme) primitive sınırları: mesh düğümü birimse yerel = dünya
  J.meshes.forEach((m, mi) => m.primitives.forEach((p, pi) => {
    const Pp = acc(p.attributes.POSITION).data, idx = acc(p.indices).data, used = new Set(idx), b = new THREE.Box3();
    const v = new THREE.Vector3(); for (const k of used) b.expandByPoint(v.set(Pp[3 * k], Pp[3 * k + 1], Pp[3 * k + 2]));
    console.log(`${m.name}/${pi} ${J.materials[p.material].name.padEnd(32)} min ${f3(b.min)} max ${f3(b.max)}`);
  }));
}
if (what === "morph"){
  const m = J.meshes[0], names = m.extras.targetNames, prim = m.primitives;
  const sets = prim.map(p => new Set(acc(p.indices).data));
  const base = acc(prim[0].attributes.POSITION).data;
  names.forEach((nm, t) => {
    const d = acc(prim[0].targets[t].POSITION).data; let n = 0, mx = 0, mxi = -1; const per = prim.map(() => 0);
    for (let k = 0; k < d.length / 3; k++){ const l = Math.hypot(d[3 * k], d[3 * k + 1], d[3 * k + 2]); if (l > 1e-5){ n++; if (l > mx){ mx = l; mxi = k; } prim.forEach((p, pi) => { if (sets[pi].has(k)) per[pi]++; }); } }
    const same = prim.every(p => p.targets[t].POSITION === prim[0].targets[t].POSITION);
    console.log(`${String(t).padStart(2)} ${nm.replace("Face.M_F00_000_00_", "").padEnd(24)} köşe=${String(n).padStart(4)} enÇok=${(mx * 1000).toFixed(1)}mm @(${mxi >= 0 ? [base[3 * mxi], base[3 * mxi + 1], base[3 * mxi + 2]].map(x => x.toFixed(3)) : ""}) prim:${per.map((x, i) => x ? i + "=" + x : "").filter(Boolean).join(",")} ortakAcc=${same}`);
  });
}
