// El tablosunun ({b, l, r, d, ab, pa}) ileri kinematiği: figures.js setChain/plane/bendFinger ve claude.js gripAt'ın aynısı, saf three.
// Manken tablosuyla claude.js'in tutuş noktası (talep.json grip) yeniden üretilir (doğrulama), sonra Kanade tablosuyla aynı yumruk açıları.
//   node --import ./out/tur5/tasarim/kollar/three-hook.mjs out/tur5/tasarim/kollar/el-fk.mjs
import fs from "node:fs";
import * as THREE from "three";
export const HAND_M = [
  {b: [0.021, 0.017, 0.009], l: [0.036, 0.03, 0.025], r: [0.0105, 0.0082, 0.0072], d: [0.62, 0.62, 0.48], ab: 1.2, pa: 1.35},
  {b: [0.025, 0.081, 0], l: [0.039, 0.024, 0.019], r: [0.0068, 0.0062, 0.0057], d: [0.08, 1, 0], ab: 0.6, pa: 0.52},
  {b: [0.0085, 0.085, 0], l: [0.043, 0.027, 0.02], r: [0.0071, 0.0064, 0.0058], d: [0, 1, 0], ab: 0.5, pa: 0.52},
  {b: [-0.0085, 0.082, 0], l: [0.04, 0.025, 0.019], r: [0.0067, 0.006, 0.0055], d: [-0.06, 1, 0], ab: 0.55, pa: 0.52},
  {b: [-0.025, 0.073, 0], l: [0.031, 0.019, 0.017], r: [0.006, 0.0054, 0.005], d: [-0.15, 1, 0], ab: 0.6, pa: 0.52}];
// Kanade (VRM dinlenme ağından; kanade-olcu.json, olc-yen.mjs): b kök eklemi el çerçevesinde, l: iki boğum eklem arası, üçüncüsü uç kürenin merkezine
// (deri ucu − yastık yarıçapı), r: [kök, orta] boğum orta kesitinin (p50+p90)/2'si, uç: yastık kesiti p90; d: kök → orta eklem yönü (dinlenme)
export const HAND_K = [
  {b: [0.0171, 0.0027, 0.007], l: [0.046, 0.0284, 0.0171], r: [0.0150, 0.0110, 0.0050], d: [0.636, 0.756, 0.158], ab: 1.2, pa: 1.35},
  {b: [0.0166, 0.0655, 0.0028], l: [0.0332, 0.0204, 0.0189], r: [0.0093, 0.0082, 0.0050], d: [0.078, 0.990, 0.118], ab: 0.6, pa: 0.52},
  {b: [0, 0.0667, 0], l: [0.037, 0.0228, 0.0201], r: [0.0098, 0.0088, 0.0050], d: [-0.015, 0.989, 0.146], ab: 0.5, pa: 0.52},
  {b: [-0.0157, 0.0661, -0.0004], l: [0.0343, 0.0198, 0.0165], r: [0.0096, 0.0078, 0.0046], d: [-0.075, 0.989, 0.125], ab: 0.55, pa: 0.52},
  {b: [-0.0314, 0.0609, 0.0033], l: [0.0314, 0.0181, 0.0149], r: [0.0088, 0.0070, 0.0042], d: [-0.079, 0.990, 0.119], ab: 0.6, pa: 0.52}];
const XA = new THREE.Vector3(1, 0, 0), ZA = new THREE.Vector3(0, 0, 1);
// zincir: [{p (el çerçevesi), q}] üç boğumun eklem konumu ve yönü
export function chain(HAND, k, ph, t, v = ZA){
  const S = HAND[k], r0 = new THREE.Vector3().fromArray(S.d); r0.addScaledVector(v, -r0.dot(v)).normalize();
  const u = r0.clone().multiplyScalar(Math.cos(ph)).addScaledVector(new THREE.Vector3().crossVectors(v, r0), Math.sin(ph));
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(u, v), u, v);
  const q0 = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(XA, t[0]));
  const p0 = new THREE.Vector3().fromArray(S.b), q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(XA, t[1]));
  const p1 = p0.clone().add(new THREE.Vector3(0, S.l[0], 0).applyQuaternion(q0)), q2 = q1.clone().multiply(new THREE.Quaternion().setFromAxisAngle(XA, t[2]));
  const p2 = p1.clone().add(new THREE.Vector3(0, S.l[1], 0).applyQuaternion(q1));
  return [{p: p0, q: q0}, {p: p1, q: q1}, {p: p2, q: q2}];
}
const FIST = [[0, [1.0, 1.35, 0.5]], [0, [1.25, 1.5, 0.75]], [0.05, [1.35, 1.55, 0.75]], [0.1, [1.45, 1.5, 0.7]]];
const FIST_M = [[0, [1.7594, 1.2978, 0.5796]], ...FIST.slice(1).map(([ph, t]) => [ph, t.map(a => a + 0.3016)])];
const GRIP_AT = 0.8, PICK_HALF = 0.0006;
export function grip(HAND, mu){
  const t = FIST[0][1].map((a, i) => a + (FIST_M[0][1][i] - a) * mu), C = chain(HAND, 1, 0, t), D = C[2], S = HAND[1];
  const X = new THREE.Vector3(1, 0, 0).applyQuaternion(D.q), r = S.r[2] * (1 - (1 - 0.92) * GRIP_AT);
  return {G: D.p.clone().add(new THREE.Vector3(0, S.l[2] * GRIP_AT, 0).applyQuaternion(D.q)).addScaledVector(X, r + PICK_HALF), X};
}
// el çerçevesinde bütün boğum uçları (düz el, ph 0, açılar t): avuç-parmak ölçüsü karşılaştırması
export function tips(HAND, t = [0, 0, 0]){ return HAND.map((S, k) => { const C = chain(HAND, k, 0, t); return C[2].p.clone().add(new THREE.Vector3(0, S.l[2], 0).applyQuaternion(C[2].q)); }); }
if (process.argv[1] && process.argv[1].endsWith("el-fk.mjs")){
  const meta = JSON.parse(fs.readFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/talep.json", "utf8"));
  const f = v => v.toArray().map(x => x.toFixed(4)).join(", ");
  const gm0 = grip(HAND_M, 0), gm1 = grip(HAND_M, 1), gk0 = grip(HAND_K, 0), gk1 = grip(HAND_K, 1);
  console.log("manken tutuş mu0", f(gm0.G), "kod:", meta.grip.G0.map(x => x.toFixed(4)).join(", "), "| mu1", f(gm1.G), "kod:", meta.grip.G1.map(x => x.toFixed(4)).join(", "));
  console.log("Kanade tutuş mu0", f(gk0.G), "|", gk0.G.length().toFixed(4), " mu1", f(gk1.G), "|", gk1.G.length().toFixed(4), " (manken", gm0.G.length().toFixed(4), gm1.G.length().toFixed(4), ")");
  console.log("düz el uçları manken", tips(HAND_M).map(v => v.y.toFixed(4)).join(" "), " Kanade", tips(HAND_K).map(v => v.y.toFixed(4)).join(" "));
  fs.writeFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/tutus.json", JSON.stringify({manken: {G0: gm0.G.toArray(), G1: gm1.G.toArray()}, kanade: {G0: gk0.G.toArray(), G1: gk1.G.toArray(), X0: gk0.X.toArray(), X1: gk1.X.toArray()}}));
}
