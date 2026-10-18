// Kanade için askı bağlantı noktaları (strapAnchors sözleşmesinin 7 kimliği) dinlenme ağı yüzeylerinden, ve bir gitar duruşunda askı yolu boyu.
//   node out/tur5/tasarim/kollar/aski-kanade.mjs '<duruş JSON>'
// Noktalar figür çerçevesinde (strapSide +1: askı figürün solundaki omuzdan); y ve x seçimi aşağıda, z yüzeyden (ön ya da arka). Kemik ofsetleri
// (VRM yerel, kemiğe göre) uygulama için yazılır: p_kemikYerel = R180(p_figür) − kemik.
import fs from "node:fs";
import { pose } from "./yerlesim.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", YJ = JSON.parse(fs.readFileSync(D + "yuzey.json", "utf8")), yb = fs.readFileSync(D + "yuzey.bin");
const YF = new Float32Array(yb.buffer, yb.byteOffset, yb.length / 4), NC = YJ.NX * YJ.NY, GT = JSON.parse(fs.readFileSync(D + "gitar.json", "utf8"));
const cell = (c, s, x, y) => { const i = Math.floor((x - YJ.X0) / YJ.C), j = Math.floor((y - YJ.Y0) / YJ.C); return YF[(c * 2 + s) * NC + j * YJ.NX + i]; };
const surf = (s, x, y) => { let v = NaN; for (const c of [0, 1]) { const w = cell(c, s, x, y); if (!isNaN(w) && (isNaN(v) || (s ? w < v : w > v))) v = w; } return v; };
// omuz üstü: x'te en yüksek y (gövde sınıfı, ön ve arka yüzeyin olduğu en üst hücre)
const top = x => { for (let y = 1.47; y > 1.3; y -= 0.005){ if (!isNaN(cell(0, 0, x, y))) return y; } return NaN; };
const BONES = {upperChest: [0.0005, 1.3185, -0.0188], hips: [-0.0005, 1.0207, 0.0092], chest: [-0.0005, 1.1876, 0.0332], spine: [-0.0005, 1.0736, 0.019]};   // figür çerçevesi
const A = [
  ["gogus", 0.07, 1.33, 0, "upperChest"], ["omuz", 0.075, null, null, "upperChest"], ["kurek", 0.075, 1.30, 1, "upperChest"], ["sirt", 0.0, 1.18, 1, "chest"],
  ["bel", -0.10, 1.07, 1, "hips"], ["kalca", -0.19, 1.00, null, "hips"], ["karin", -0.09, 1.07, 0, "hips"]];
const P = A.map(([id, x, y, s, b]) => { let p;
  if (id === "omuz"){ const yt = top(x); p = [x, yt, (surf(0, x, yt - 0.01) + surf(1, x, yt - 0.01)) / 2]; }
  else if (id === "kalca"){ p = [x, y, (surf(0, x, y) + surf(1, x, y)) / 2]; }
  else p = [x, y, surf(s, x, y)];
  const B = BONES[b]; return {id, p: p.map(v => +v.toFixed(4)), kemik: b, kemikYerelVRM: [-(p[0] - B[0]), p[1] - B[1], -(p[2] - B[2])].map(v => +v.toFixed(4))}; });
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const out = {baglanti: P};
if (process.argv[2]){ const T = pose(JSON.parse(process.argv[2])), up = T.pt(GT.pimler.ust), lo = T.pt(GT.pimler.alt);
  let L = d(up, P[0].p) + d(P[P.length - 1].p, lo); for (let i = 1; i < P.length; i++) L += d(P[i].p, P[i - 1].p);
  out.pimler = {ust: up.map(v => +v.toFixed(4)), alt: lo.map(v => +v.toFixed(4))}; out.yol_m = +L.toFixed(3); out.ustPimGogus_m = +d(up, P[0].p).toFixed(3); out.ustPimOmuz_m = +d(up, P[1].p).toFixed(3); out.altPimKalca_m = +d(lo, P[5].p).toFixed(3); out.altPimKarin_m = +d(lo, P[6].p).toFixed(3); }
console.log(JSON.stringify(out, null, 1));
