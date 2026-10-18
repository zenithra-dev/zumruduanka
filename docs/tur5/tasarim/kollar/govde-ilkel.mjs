// Kanade bodySdFn için kemiğe bağlı ilkeller: her gövde kemiğinin baskın olduğu (deri + giysi) köşelerden eksen hizalı elipsoit (kemik dinlenme
// çerçevesi = VRM eksenleri; figür çerçevesine (−x, y, −z) çevrilmiş), %2-%98 aralığı. Etek: J_Sec_*Skirt* köşelerinin y dilimlerinde ön/yan yarıçapı.
// Ayrıca ilkel birleşiminin dinlenme ağına uyumu: ağ köşelerinin işaretli uzaklığı (dışarıda kalan köşe = ilkel yüzeyi içeride kalmış).
//   node out/tur5/tasarim/kollar/govde-ilkel.mjs → govde-ilkel.json
import fs from "node:fs";
import { loadVrm, skinnedPrims, m4 } from "./glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), H = V.hb, P = i => m4.pt(V.world[i], [0, 0, 0]);
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const desc = (i, acc = new Set()) => { acc.add(i); (V.nodes[i].children || []).forEach(c => desc(c, acc)); return acc; };
const ARM = new Set([...desc(H.rightUpperArm), ...desc(H.leftUpperArm)]), HEAD = desc(H.head);
const verts = [];
for (const pr of skinnedPrims(V)){ const mat = V.json.materials[pr.mat].name; if (!/Body_00_SKIN|Tops/.test(mat)) continue;
  const A = V.json.meshes[V.nodes[pr.node].mesh].primitives[pr.prim];
  for (const i of new Set(V.acc(A.indices))){ let bj = -1, bw = -1; for (let k = 0; k < 4; k++){ const w = pr.wgt[i * 4 + k]; if (w > bw){ bw = w; bj = pr.jnt[i * 4 + k]; } }
    verts.push({p: [-pr.pos[i * 3], pr.pos[i * 3 + 1], -pr.pos[i * 3 + 2]], j: bj, mat}); } }
const fig = i => { const p = P(i); return [-p[0], p[1], -p[2]]; };
const groups = {hips: [H.hips], spine: [H.spine], chest: [H.chest], upperChest: [H.upperChest], neck: [H.neck], omuzL: [H.leftShoulder], omuzR: [H.rightShoulder],
  uylukL: [H.leftUpperLeg], uylukR: [H.rightUpperLeg], baldirL: [H.leftLowerLeg], baldirR: [H.rightLowerLeg]};
const out = {ilkel: {}};
for (const [k, J] of Object.entries(groups)){ const S = new Set(J), pts = verts.filter(v => S.has(v.j)).map(v => v.p); if (!pts.length) continue;
  const lo = [0, 1, 2].map(a => q(pts.map(p => p[a]), 0.02)), hi = [0, 1, 2].map(a => q(pts.map(p => p[a]), 0.98));
  const c = lo.map((l, a) => +((l + hi[a]) / 2).toFixed(4)), r = lo.map((l, a) => +((hi[a] - l) / 2).toFixed(4)), b = fig(J[0]);
  out.ilkel[k] = {kemik: V.nodes[J[0]].name, kemikFigur: b.map(x => +x.toFixed(4)), merkezFigur: c, merkezKemikYerel: c.map((x, a) => +(x - b[a]).toFixed(4)), yaricap: r, kose: pts.length}; }
// etek: y dilimlerinde (2 cm) ön (+z), arka, yan yarıçap ve merkez
const sk = verts.filter(v => /Skirt/.test(V.nodes[v.j].name)), rows = [];
for (let y = 1.12; y >= 0.5; y -= 0.04){ const S = sk.filter(v => Math.abs(v.p[1] - y) < 0.02).map(v => v.p); if (!S.length) continue;
  rows.push({y: +y.toFixed(2), on: +Math.max(...S.map(p => p[2])).toFixed(3), arka: +Math.min(...S.map(p => p[2])).toFixed(3), yan: +Math.max(...S.map(p => Math.abs(p[0]))).toFixed(3), n: S.length}); }
out.etek = rows;
// etek kemikleri: kök kemiklerin adları ve figürdeki yerleri
out.etekKemikleri = V.nodes.map((n, i) => /Skirt/.test(n.name) && !/Skirt\w*\d_end/.test(n.name) && /1$/.test(n.name) ? {ad: n.name, yer: fig(i).map(x => +x.toFixed(3))} : null).filter(Boolean);
out.sacKemikSayisi = V.nodes.filter(n => /J_Sec_Hair/.test(n.name)).length;
out.yenKemikleri = V.nodes.map((n, i) => /Sleeve/.test(n.name) ? {ad: n.name, ebeveyn: V.nodes[V.parent[i]].name, yer: fig(i).map(x => +x.toFixed(3))} : null).filter(Boolean);
fs.writeFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/govde-ilkel.json", JSON.stringify(out, null, 1));
for (const [k, o] of Object.entries(out.ilkel)) console.log(k.padEnd(10), "kemik", o.kemikFigur, "merkez", o.merkezFigur, "yarıçap", o.yaricap, "köşe", o.kose);
console.log("etek:"); for (const r of rows) console.log(" ", JSON.stringify(r));
console.log("etek kök kemikleri", out.etekKemikleri.length, JSON.stringify(out.etekKemikleri.slice(0, 12)));
console.log("yen kemikleri", JSON.stringify(out.yenKemikleri));
