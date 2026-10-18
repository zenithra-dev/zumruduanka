// Kol ağzı (J_Sec_*_TipSleeve, ebeveyni el kemiği) ↔ gitar: yen bileği saran ve avuç yanına sarkan bir halka; bir duruşta perde ve pena elinin
// talep karelerinde (Kanade el boyu, nominal el yönü) halkanın sap/klavye/gövde katılarına girişi. Ölçüler olc-yen.mjs'ten: halka bilekten el ekseni
// boyunca 0..0.047 m, yarıçap 0.06..0.10, avuç yanına sarkma ~0.03.
//   node out/tur5/tasarim/kollar/yen-kontrol.mjs '<duruş JSON>' [yarıçap] [boy]
import fs from "node:fs";
import { talep, st } from "./talep-oku.mjs";
import { pose, guitarSd, KAN } from "./yerlesim.mjs";
const GT = JSON.parse(fs.readFileSync("C:/work/zumruduanka/out/tur5/tasarim/kollar/gitar.json", "utf8"));
const G = JSON.parse(process.argv[2]), RAD = +(process.argv[3] || 0.085), LEN = +(process.argv[4] || 0.047), DROOP = 0.03, T = pose(G), {F} = talep();
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = a => { const l = Math.hypot(...a); return sc(a, 1 / l); }, crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const halfFb = x => 0.0215 + 0.007 * x / 0.47;
// sap + klavye katısı (gitar yerel): kutu y ±0.025 z 0.031..0.053, klavye y ±halfFb z ..0.0565, x −0.005..0.49
function neckSd(q){ const x0 = -0.005, x1 = 0.49; const hw = Math.max(0.025, halfFb(Math.min(Math.max(q[0], 0), 0.49))), z0 = GT.sap[0][2], z1 = 0.0565;
  const dx = Math.max(x0 - q[0], q[0] - x1), dy = Math.abs(q[1]) - hw, dz = Math.max(z0 - q[2], q[2] - z1);
  return dx > 0 || dy > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) : Math.max(dx, dy, dz); }
const res = {perde: [], pena: []}, TU = KAN;
for (const f of F){
  for (const [k, on] of [["perde", f.home < 0.5], ["pena", true]]){ if (!on) continue;
    const y = nrm(T.dir(k === "perde" ? f.fy : f.py)), z = nrm(T.dir(k === "perde" ? f.fz : f.pz)), x = crs(y, z);
    let W; if (k === "perde") W = sub(T.pt(f.fk), sc(y, TU.KN)); else { const Gp = add(sc(TU.G0, 1 - f.mu), sc(TU.G1, f.mu)); W = sub(T.pt(f.pk), add(add(sc(x, Gp[0]), sc(y, Gp[1])), sc(z, Gp[2]))); }
    let worst = -1;
    for (let s = 0; s <= 1.0001; s += 0.5) for (let a = 0; a < 360; a += 20){ const ph = a * Math.PI / 180, r = RAD * (0.75 + 0.25 * s);
      const p = add(add(W, sc(y, LEN * s)), add(sc(x, r * Math.cos(ph)), sc(z, r * Math.sin(ph) + DROOP * s)));
      const q = T.inv(p), d = Math.min(neckSd(q), guitarSd(q)) * T.s; worst = Math.max(worst, -d); }
    res[k].push(worst); } }
const pc = a => +(100 * a.filter(v => v > 0.005).length / a.length).toFixed(1);
console.log(JSON.stringify({yaricap: RAD, boy: LEN, perde: {giris_mm: st(res.perde.map(v => v * 1000)), gt5mm_yuzde: pc(res.perde)}, pena: {giris_mm: st(res.pena.map(v => v * 1000)), gt5mm_yuzde: pc(res.pena)}}));
