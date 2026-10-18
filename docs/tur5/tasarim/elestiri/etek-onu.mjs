// Eleştiri denetimi: üç incelemenin "ön yüz / etek önü" sayıları farklı (y≈0.96'da 0.19 / 0.215 / 0.229). Dinlenme ağında (skin = kimlik)
// figür çerçevesinde (x_F = -x_V, z_F = -z_V) önden (+z_F) atılan ışının Body ağı (deri, Tops, ayakkabı) ile ilk kesişimi.
// Köşe tabanlı ölçüm etek gibi seyrek ağda yanıltır (deneyim defteri), bu yüzden üçgen-ışın. node etek-onu.mjs
import { loadVrm } from "../kollar/glb.mjs";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), J = V.json;
const tris = [];
for (const name of ["Body.baked"]){ const me = J.meshes.find(m => m.name === name);
  me.primitives.forEach((p, pi) => { if (pi === 3) return; const pos = V.acc(p.attributes.POSITION), idx = V.acc(p.indices);
    for (let t = 0; t < idx.length; t += 3){ const T = [0, 1, 2].map(k => { const i = idx[t + k]; return [-pos[3 * i], pos[3 * i + 1], -pos[3 * i + 2]]; }); tris.push([T, pi]); } }); }
// ışın: (x, y, +2) → -z ; Möller-Trumbore, yalnız z yönü: düzlemde xy noktası üçgenin içinde mi
function front(x, y){ let best = -9, who = -1;
  for (const [[a, b, c], pi] of tris){
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-14) continue;
    const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue; const z = l1 * a[2] + l2 * b[2] + l3 * c[2]; if (z > best){ best = z; who = pi; } }
  return [best, who]; }
const ys = [0.90, 0.95, 0.975, 1.00, 1.05, 1.10, 1.20, 1.29], xs = [-0.20, -0.12, -0.08, -0.04, 0, 0.06, 0.12], ad = ["deri", "tops", "ayak"];
console.log("on yuz z_F (m); satir y, sutun x_F (figurun solu +)");
console.log("y".padEnd(7) + xs.map(x => String(x).padStart(12)).join(""));
for (const y of ys) console.log(String(y).padEnd(7) + xs.map(x => { const [z, w] = front(x, y); return (z > -9 ? z.toFixed(3) + " " + ad[w] : "-").padStart(12); }).join(""));
