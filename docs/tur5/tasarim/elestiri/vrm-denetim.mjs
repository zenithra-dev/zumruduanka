// Eleştiri denetimi (salt okur): yen kemikleri yaprak mı, kol ağzı ağırlıkları, yüz alt ağlarının paylaşılan öznitelikleri,
// tırnak ağı, firstPerson/lookAt, blendshape bağları. node vrm-denetim.mjs
import { loadVrm, skinnedPrims } from "../kollar/glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), J = V.json, nm = i => J.nodes[i].name;
const byName = n => J.nodes.findIndex(x => x.name === n);
const out = {};
// 1) Yen kemikleri: çocukları
out.yen = ["J_Sec_L_LowerSleeve", "J_Sec_L_TipSleeve", "J_Sec_R_TipSleeve"].map(n => { const i = byName(n); const ch = J.nodes[i]?.children || [];
  return {n, i, parent: nm(V.parent[i]), children: ch.map(nm), worldPos: V.world[i].slice(12, 15).map(x => +x.toFixed(4))}; });
// 2) Kol ağzı köşeleri: TipSleeve ağırlığı olan köşeler, ağırlık dağılımı
const P = skinnedPrims(V), tipL = byName("J_Sec_L_TipSleeve"), lowL = byName("J_Sec_L_LowerSleeve"), handL = V.hb.leftHand;
let n = 0, wsum = 0, pureTip = 0, mix = {}; 
for (const p of P){ const c = p.pos.length / 3; for (let k = 0; k < c; k++){ let wt = 0; const s = [];
  for (let q = 0; q < 4; q++){ const j = p.jnt[k * 4 + q], w = p.wgt[k * 4 + q]; if (w > 0) s.push([nm(j), w]); if (j === tipL) wt += w; }
  if (wt > 0){ n++; wsum += wt; if (wt > 0.99) pureTip++; const key = s.map(x => x[0]).sort().join("+"); mix[key] = (mix[key] || 0) + 1; } } }
out.kolAgziL = {kose: n, ortAgirlik: +(wsum / Math.max(1, n)).toFixed(3), salt: pureTip, karisim: mix};
// 3) Yüz alt ağları: öznitelik/ hedef accessor paylaşımı
const face = J.meshes.find(m => /face/i.test(m.name));
out.yuz = {ad: face.name, prim: face.primitives.length, posAcc: [...new Set(face.primitives.map(p => p.attributes.POSITION))], idx: face.primitives.map(p => p.indices),
  hedef: face.primitives[0].targets ? face.primitives[0].targets.length : 0, hedefPaylasim: [...new Set(face.primitives.map(p => JSON.stringify((p.targets || []).slice(0, 2))))].length,
  normalVar: face.primitives.some(p => (p.targets || []).some(t => t.NORMAL !== undefined))};
// 4) Ağlar ve malzeme sayısı
out.aglar = J.meshes.map(m => ({ad: m.name, prim: m.primitives.length, mat: m.primitives.map(p => J.materials[p.material].name)}));
// 5) firstPerson / lookAt
const vr = J.extensions.VRM; out.firstPerson = {...vr.firstPerson, meshAnnotations: (vr.firstPerson.meshAnnotations || []).length};
// 6) blendshape bağları (ad → bağ sayısı, hedefler)
out.blend = vr.blendShapeMaster.blendShapeGroups.map(g => ({ad: g.name, preset: g.presetName, bag: (g.binds || []).map(b => `${J.meshes[b.mesh].name}#${b.index}@${b.weight}`).join(" "), mat: (g.materialValues || []).length}));
out.morphAdlari = (face.extras && face.extras.targetNames) || (face.primitives[0].extras && face.primitives[0].extras.targetNames) || null;
console.log(JSON.stringify(out, null, 1));
