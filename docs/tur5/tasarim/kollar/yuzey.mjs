// Kanade'nin dinlenme ağından ön/arka yüzey yükseklik haritaları (figür çerçevesi: +x figürün solu, +z ön, y yerden), 1 cm ızgara.
// Üçgenler 4 mm aralıkla örneklenir (köşe seyrek: etek üçgenleri büyük). Sınıflar: govde (deri + üst giysi, etek kemikleri hariç), etek
// (J_Sec_*Skirt* kemiklerine baskın giysi), sac. Kollar (UpperArm altındaki her kemik, yen kemikleri dahil) hariç.
//   node out/tur5/tasarim/kollar/yuzey.mjs → yuzey.json + yuzey.bin (Float32: [sınıf][ön|arka][j][i], boş = NaN)
import fs from "node:fs";
import { loadVrm, skinnedPrims } from "./glb.mjs";
const OUT = "C:/work/zumruduanka/out/tur5/tasarim/kollar/";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), H = V.hb;
const desc = (i, acc = new Set()) => { acc.add(i); (V.nodes[i].children || []).forEach(c => desc(c, acc)); return acc; };
const ARM = new Set([...desc(H.rightUpperArm), ...desc(H.leftUpperArm)]);
export const G = {X0: -0.36, X1: 0.36, Y0: 0.30, Y1: 1.76, C: 0.01};
G.NX = Math.round((G.X1 - G.X0) / G.C); G.NY = Math.round((G.Y1 - G.Y0) / G.C);
const CLS = ["govde", "etek", "sac"], NC = G.NX * G.NY;
const F = new Float32Array(CLS.length * 2 * NC).fill(NaN);
let ntri = 0;
for (const pr of skinnedPrims(V)){
  const mat = V.json.materials[pr.mat].name, A = V.json.meshes[V.nodes[pr.node].mesh].primitives[pr.prim], idx = V.acc(A.indices);
  const isHair = /HAIR/.test(mat), isBody = /Body_00_SKIN|Tops/.test(mat); if (!isHair && !isBody) continue;
  const dom = i => { let bj = -1, bw = -1; for (let k = 0; k < 4; k++){ const w = pr.wgt[i * 4 + k]; if (w > bw){ bw = w; bj = pr.jnt[i * 4 + k]; } } return bj; };
  for (let t = 0; t < idx.length; t += 3){
    const I = [idx[t], idx[t + 1], idx[t + 2]], D = I.map(dom);
    if (D.some(j => ARM.has(j))) continue;
    const cls = isHair ? 2 : D.some(j => /Skirt/.test(V.nodes[j].name)) ? 1 : 0;
    const P = I.map(i => [-pr.pos[i * 3], pr.pos[i * 3 + 1], -pr.pos[i * 3 + 2]]);   // figür çerçevesi
    const e = Math.max(Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), Math.hypot(P[2][0] - P[0][0], P[2][1] - P[0][1]), Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]));
    const n = Math.max(1, Math.ceil(e / 0.004)); ntri++;
    for (let a = 0; a <= n; a++) for (let b = 0; a + b <= n; b++){ const u = a / n, v = b / n, w = 1 - u - v;
      const x = w * P[0][0] + u * P[1][0] + v * P[2][0], y = w * P[0][1] + u * P[1][1] + v * P[2][1], z = w * P[0][2] + u * P[1][2] + v * P[2][2];
      const i = Math.floor((x - G.X0) / G.C), j = Math.floor((y - G.Y0) / G.C); if (i < 0 || j < 0 || i >= G.NX || j >= G.NY) continue;
      const fo = (cls * 2) * NC + j * G.NX + i, bo = (cls * 2 + 1) * NC + j * G.NX + i;
      if (!(F[fo] >= z)) F[fo] = z; if (!(F[bo] <= z)) F[bo] = z; } }
}
fs.writeFileSync(OUT + "yuzey.bin", Buffer.from(F.buffer));
fs.writeFileSync(OUT + "yuzey.json", JSON.stringify({...G, siniflar: CLS, duzen: "[sınıf][ön, arka][j (y)][i (x)]", ucgen: ntri}, null, 1));
// özet: y dilimlerinde en öndeki z (gövde, etek, saç) ve x genişliği
const at = (c, s, i, j) => F[(c * 2 + s) * NC + j * G.NX + i];
console.log("üçgen", ntri);
for (let y = 1.70; y >= 0.40; y -= 0.04){ const j = Math.floor((y - G.Y0) / G.C), row = c => { let mz = -9, xi = 99, xa = -99, mb = 9; for (let i = 0; i < G.NX; i++){ const v = at(c, 0, i, j); if (!isNaN(v)){ mz = Math.max(mz, v); xi = Math.min(xi, i); xa = Math.max(xa, i); mb = Math.min(mb, at(c, 1, i, j)); } }
    return mz > -9 ? `ön ${(mz * 100).toFixed(1).padStart(5)} arka ${(mb * 100).toFixed(1).padStart(6)} x ${((G.X0 + xi * G.C) * 100).toFixed(0)}..${((G.X0 + (xa + 1) * G.C) * 100).toFixed(0)}` : "-".padEnd(30); };
  console.log(`y ${y.toFixed(2)} | gövde ${row(0)} | etek ${row(1)} | saç ${row(2)}`); }
