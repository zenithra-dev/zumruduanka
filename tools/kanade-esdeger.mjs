// Kıyafet eşdeğerliği (node, tarayıcısız): eski tek dosyalı kanade.vrm (ESKI_SRC ağacının vrm.js'iyle) ↔ taban + varsayılan kıyafet (bu ağaç).
// Aynı hash pozlarında (gövde, kollar, parmaklar, kıvrık yen) her malzemenin köşeleri deri + morph ile dünyada hesaplanır; köşeler bağ pozu
// konumu + uv ile eşlenir. Kabul: en büyük fark ≤ 0.5 mm, eşlenmeyen köşe yok.
//   ESKI_SRC=C:/work/zk-temel node tools/kanade-esdeger.mjs   (eski ağaçta src/assets/kanade/kanade.vrm olmalı)
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), ESKI = path.resolve(process.env.ESKI_SRC || "C:/work/zk-temel");
const THREE_URL = pathToFileURL(path.join(ROOT, "src/vendor/three/build/three.module.js")).href;
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n){ if (s === "three") return {url: ${JSON.stringify(THREE_URL)}, shortCircuit: true}; return n(s, c); }`));
const THREE = await import("three");
const imp = (kok, p) => import(pathToFileURL(path.join(kok, p)).href);
const oku = f => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };

async function kur(kok, yeni){
  const V = await imp(kok, "src/sim/stage/kanade/vrm.js"), F = await imp(kok, "src/sim/stage/kanade/vekil.js");
  let a;
  if (yeni){ const AS = path.join(kok, "src/assets/kanade"), M = JSON.parse(fs.readFileSync(path.join(AS, "kiyafetler.json"), "utf8")), K = (await imp(kok, "src/sim/stage/kanade/kiyafet.js")).kiyafetCoz(M, {});
    a = await V.parseKanade(oku(path.join(AS, M.taban.dosya)), {doku: false, kiyafet: {ab: oku(path.join(AS, K.tanim.dosya)), tanim: K.tanim, ad: K.ad, spec: K.spec}}); }
  else a = await V.parseKanade(oku(path.join(kok, "src/assets/kanade/kanade.vrm")), {doku: false});
  V.setKanadeAsset(a);
  const fig = F.kanadeFigure(new THREE.Scene(), {x: 0.2, z: -0.19, sway: 0.5}); fig.blinks = []; fig.F = await imp(kok, "src/sim/stage/figures.js"); return fig;
}
const h = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };
function poz(fig, k){
  const {poseArm, bendFinger} = fig.F;
  const c = s => h(k, s) - 0.5;
  fig.life({br: c(1) * 2, rx: 0.15 + 0.3 * c(2), rz: 0.1 * c(3), ry: 0.2 * c(4), drop: 0.04 * h(k, 5), nod: 0.8 * c(6), look: 0.3 * c(7), spread: 0.1 * h(k, 8)});
  fig.g.updateMatrixWorld(true);
  [0, 1].forEach(i => { const S = fig.up.localToWorld(fig.sh[i].clone()), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(6.28 * h(k, 10 + i), 6.28 * h(k, 12 + i), 6.28 * h(k, 14 + i)));
    const T = S.clone().add(new THREE.Vector3((i ? -1 : 1) * (0.05 + 0.3 * h(k, 16 + i)), -0.1 - 0.25 * h(k, 18 + i), 0.05 + 0.3 * h(k, 20 + i)));
    poseArm(fig, i, T, null, {q, off: new THREE.Vector3(0, 0.07, 0)});
    for (let f = 0; f < 5; f++) bendFinger(fig.hands[i], f, 0.4 * c(30 + f + 5 * i), [1.4 * h(k, 40 + f), 1.5 * h(k, 50 + f), 1.1 * h(k, 60 + f)]); });
  fig.yen = [h(k, 70), h(k, 71)];
  fig.commit(k, k); fig.vrm.holder.updateMatrixWorld(true);
}
// Malzeme adı → Map(anahtar (bağ konumu + uv) → dünya konumu (deri + morph))
function noktalar(fig){
  const out = new Map(), v = new THREE.Vector3(), s = new THREE.Vector3(), t = new THREE.Vector3(), M = new THREE.Matrix4();
  for (const m of fig.vrm.meshes){ if (m.userData.gizli) continue;
    const g = m.geometry, P = g.attributes.position, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, I = g.index.array, ad = [].concat(m.material)[0].name;
    const D = g.morphAttributes.position || [], W = m.morphTargetInfluences || [], B = m.skeleton.bones, BI = m.skeleton.boneInverses;
    const mp = out.get(ad) || new Map(); out.set(ad, mp);
    for (const i of new Set(I)){ v.fromBufferAttribute(P, i); const key = [v.x, v.y, v.z, UV.getX(i), UV.getY(i)].map(x => x.toFixed(5)).join(",");
      for (let k = 0; k < D.length; k++) if (W[k]) v.addScaledVector(t.fromBufferAttribute(D[k], i), W[k]);
      v.applyMatrix4(m.bindMatrix); s.set(0, 0, 0);
      for (let c = 0; c < 4; c++){ const w = SW.array[4 * i + c]; if (!w) continue; M.multiplyMatrices(B[SI.array[4 * i + c]].matrixWorld, BI[SI.array[4 * i + c]]); s.addScaledVector(t.copy(v).applyMatrix4(M), w); }
      mp.set(key, s.applyMatrix4(m.bindMatrixInverse).applyMatrix4(m.matrixWorld).clone()); } }
  return out;
}
const eski = await kur(ESKI, false), yeni = await kur(ROOT, true);
const R = {poz: 0, mm: 0, eslenmeyen: 0, gizliEksik: 0, malzeme: {}};
for (let k = 0; k < 12; k++){
  poz(eski, k); poz(yeni, k);
  const A = noktalar(eski), B = noktalar(yeni);
  for (const [ad, ma] of A){ const mb = B.get(ad) || new Map(); let mx = 0, yok = 0;
    for (const [key, p] of ma){ const q = mb.get(key); if (!q){ yok++; continue; } mx = Math.max(mx, p.distanceTo(q)); }
    const r = R.malzeme[ad] = R.malzeme[ad] || {kose: ma.size, mm: 0, eslenmeyen: 0}; r.mm = Math.max(r.mm, +(mx * 1000).toFixed(5)); r.eslenmeyen = Math.max(r.eslenmeyen, yok);
    R.mm = Math.max(R.mm, mx * 1000);
    if (/_SKIN$/.test(ad) && ad.startsWith("F00_002")) R.gizliEksik = Math.max(R.gizliEksik, yok); else R.eslenmeyen = Math.max(R.eslenmeyen, yok); }
  R.poz++;
}
R.mm = +R.mm.toFixed(5); R.kabul = R.mm <= 0.5 && R.eslenmeyen === 0;
// Ten: gizli deri yalnız üçgen çıkarır; köşe farkı = örtülü üçgenlerin yalnız onlara ait köşeleri (eşlenmeyen olarak sayılır, bilgi)
console.log(JSON.stringify(R, null, 1));
process.exit(R.kabul ? 0 : 1);
