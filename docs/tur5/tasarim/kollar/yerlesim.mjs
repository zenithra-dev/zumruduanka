// Kanade için gitar yerleşimi fizibilitesi: bugünkü kodun el talepleri (talep.bin, gitar yerel) Kanade'nin el boyuna uyarlanır, aday gitar duruşlarında
// Kanade'nin omuzlarından iki kemikli IK ile erişim, dirsek iç açısı, bilek bükümü, gitar ↔ beden (dinlenme ağı yüzeyleri), kol ↔ beden, ön kol ↔ gövde ölçülür.
//   node out/tur5/tasarim/kollar/yerlesim.mjs [ara|olc] [JSON aday]
// Çerçeve: Kanade figür yereli (zemin y 0, +z ön, +x figürün solu = sap tarafı). Gitar duruşu G = {o: [x,y,z], a, psi, phi, s, d}: gitarın yerel P0 = (0.62, 0, 0)
// noktası (gövde arkası, köprü manyetiğinin altı: karına dayanan yer) figürde o'da; a sapın yükselişi (manken 0.6), psi sapın öne dönüşü (dikey eksen, kafa
// öne), phi kapağın yukarı yatışı (alt kenar öne), s ölçek (1 = L 0.648), d köprücük öne çekişi (omuz eklemi +z, m).
import fs from "node:fs";
import { talep, st } from "./talep-oku.mjs";
const D = "C:/work/zumruduanka/out/tur5/tasarim/kollar/", GT = JSON.parse(fs.readFileSync(D + "gitar.json", "utf8")), TU = JSON.parse(fs.readFileSync(D + "tutus.json", "utf8"));
const YJ = JSON.parse(fs.readFileSync(D + "yuzey.json", "utf8")), yb = fs.readFileSync(D + "yuzey.bin"), YF = new Float32Array(yb.buffer, yb.byteOffset, yb.length / 4), NCc = YJ.NX * YJ.NY;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => sc(a, 1 / len(a)), crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Kanade (VRM; figür çerçevesi = VRM (−x, y, −z))
export const KAN = {SL: [0.1082, 1.3909, -0.0033], SR: [-0.1092, 1.3909, -0.0033], a: 0.2193, b: 0.2143, KN: 0.064, G0: TU.kanade.G0, G1: TU.kanade.G1, rUst: 0.04, rOn: 0.03, rYen: 0.075};
const P0 = [0.62, 0, 0];
// gitar yerel → figür: R = Ry(−psi) · Rx(−phi) · M(a) (M aynalı: x (−cos a, −sin a, 0), y (−sin a, cos a, 0), z (0, 0, 1))
export function pose(G){
  const ca = Math.cos(G.a), sa = Math.sin(G.a), X0 = [-ca, -sa, 0], Y0 = [-sa, ca, 0], Z0 = [0, 0, 1];
  const rx = v => { const c = Math.cos(-G.phi), s = Math.sin(-G.phi); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
  const ry = v => { const c = Math.cos(-G.psi), s = Math.sin(-G.psi); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
  const X = ry(rx(X0)), Y = ry(rx(Y0)), Z = ry(rx(Z0)), s = G.s || 1;
  const dir = v => [X[0] * v[0] + Y[0] * v[1] + Z[0] * v[2], X[1] * v[0] + Y[1] * v[1] + Z[1] * v[2], X[2] * v[0] + Y[2] * v[1] + Z[2] * v[2]];
  const pt = p => add(G.o, dir(sc(sub(p, P0), s)));
  const inv = q => { const d = sub(q, G.o); return add(P0, sc([dot(d, X), dot(d, Y), dot(d, Z)], 1 / s)); };
  return {X, Y, Z, dir, pt, inv, s};
}
// yüzey sorgusu: sınıf c (0 gövde, 1 etek, 2 saç), ön (0) / arka (1); hücre yoksa NaN. Komşuluk: 3×3'ün en öndeki/arkadaki
const cellAt = (c, sd, x, y) => { const i = Math.floor((x - YJ.X0) / YJ.C), j = Math.floor((y - YJ.Y0) / YJ.C); if (i < 0 || j < 0 || i >= YJ.NX || j >= YJ.NY) return NaN; return YF[(c * 2 + sd) * NCc + j * YJ.NX + i]; };
function front(c, x, y){ let m = NaN; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){ const v = cellAt(c, 0, x + di * YJ.C, y + dj * YJ.C); if (!(m >= v)) m = isNaN(m) || v > m ? v : m; } return m; }
function back(c, x, y){ let m = NaN; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++){ const v = cellAt(c, 1, x + di * YJ.C, y + dj * YJ.C); if (!isNaN(v) && (isNaN(m) || v < m)) m = v; } return m; }
// noktanın gövde hacmine girişi (yükseklik haritasında z boyunca; dışarıda eksi = boşluk)
function bodyPen(p, r, c = 0){ const f = front(c, p[0], p[1]), b = back(c, p[0], p[1]); if (isNaN(f)) return -1; if (p[2] > f) return r - (p[2] - f); if (p[2] < b) return r - (b - p[2]); return r + Math.min(f - p[2], p[2] - b); }
// gitar gövde katısı (gitar yerel): dış hat + bevel, z 0..TOP
const Q = GT.govde.Q, BEV = GT.govde.bev;
function inPoly(x, y){ let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function edge(x, y){ let d = 9; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey; if (l < 1e-12) continue;
  const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l)); d = Math.min(d, Math.hypot(x - a[0] - u * ex, y - a[1] - u * ey)); } return d; }
export function guitarSd(q){
  if (q[0] < 0.25 || q[0] > 0.95 || Math.abs(q[1]) > 0.25 || q[2] > 0.2 || q[2] < -0.15) return 0.1;
  const e = edge(q[0], q[1]), dxy = (inPoly(q[0], q[1]) ? -e : e) - BEV, dz = Math.max(GT.govde.z0 - q[2], q[2] - GT.govde.z1);
  return dxy > 0 || dz > 0 ? Math.hypot(Math.max(dxy, 0), Math.max(dz, 0)) : Math.max(dxy, dz);
}
// gitarın arka yüzü ve sap sırtı örnekleri (gitar yerel)
const BACK = [];
for (let x = 0.32; x <= 0.87; x += 0.01) for (let y = -0.16; y <= 0.16; y += 0.01) if (inPoly(x, y) || edge(x, y) < BEV) BACK.push([x, y, 0]);
for (let x = 0.32; x <= 0.87; x += 0.01) for (let y = -0.16; y <= 0.16; y += 0.01) if (!inPoly(x, y) && edge(x, y) < 0.012) BACK.push([x, y, GT.govde.z1 / 2]);   // kenar
for (let x = -0.005; x <= 0.33; x += 0.01) for (const y of [-0.025, 0, 0.025]) BACK.push([x, y, GT.sap[0][2]]);
for (let x = -0.21; x <= -0.01; x += 0.02) for (const y of [-0.03, 0, 0.04]) BACK.push([x, y, 0.034]);   // kafa
// İki kemikli IK: omuz S, hedef W, kutup yönü pl → dirsek E (figures.js poseArm ile aynı)
function ik(S, W, pl, a, b){
  let d = sub(W, S), L = len(d); const dir = sc(d, 1 / (L || 1)); L = Math.min(Math.max(L, 0.05), a + b - 0.002);
  let pp = sub(pl, sc(dir, dot(pl, dir))); pp = nrm(pp); const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(a * a - x * x, 0));
  return add(add(S, sc(dir, x)), sc(pp, h));
}
const angle = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * 180 / Math.PI;
// En alçak serbest dirsek: döngü açısı 10° adımla; ön kol (bilekten dirseğe 5 örnek) gitar gövdesine rOn'dan yakın değil, üst kol ve ön kol bedene girmiyor
export function swivelLow(S, W, a, b, T, K){
  const d = sub(W, S), L = len(d), dir = sc(d, 1 / L), t = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u1 = nrm(crs(dir, t)), u2 = crs(dir, u1);
  let best = null;
  for (let k = 0; k < 36; k++){ const th = k * Math.PI / 18, pl = add(sc(u1, Math.cos(th)), sc(u2, Math.sin(th))), E = ik(S, W, pl, a, b);
    let ok = true; for (let i = 0; i <= 4 && ok; i++){ const p2 = add(E, sc(sub(W, E), i / 4)); if (K.rOn - guitarSd(T.inv(p2)) * T.s > 0.003 || bodyPen(p2, K.rOn) > 0.003) ok = false;
      const p1 = add(S, sc(sub(E, S), 0.35 + 0.65 * i / 4)); if (bodyPen(p1, K.rUst) > 0.003 || K.rUst - guitarSd(T.inv(p1)) * T.s > 0.003) ok = false; }
    if (!ok) continue; const el = angle(sub(E, S), [0, -1, 0]); if (!best || el < best.el) best = {el, E}; }
  return best;
}
// koni örnekleri: u0 çevresinde yarı açısı beta olan 13 yön
function cone(u0, beta){ const t = Math.abs(u0[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = nrm(crs(u0, t)), e2 = crs(u0, e1), out = [u0];
  for (const f of [0.5, 1]) for (let k = 0; k < 6; k++){ const ph = k * Math.PI / 3 + (f === 1 ? Math.PI / 6 : 0), b = beta * f; out.push(nrm(add(sc(u0, Math.cos(b)), add(sc(e1, Math.sin(b) * Math.cos(ph)), sc(e2, Math.sin(b) * Math.sin(ph)))))); }
  return out; }
const LO = 70, HI = 110, BETA = 25 * Math.PI / 180, BETA_P = 15 * Math.PI / 180;
const POLE_P = nrm([-0.2, -1, 1.2]);
const band = th => Math.max(0, LO - th) ** 2 + Math.max(0, th - HI) ** 2;
// Bir duruşu talep karelerinde değerlendir. detay: kol ↔ beden/gövde örnekleri de
export function evaluate(G, F, K = KAN, detay = false){
  const T = pose(G), SL = add(K.SL, [0, 0, G.d || 0]), SR = add(K.SR, [0, 0, G.d || 0]), a = K.a * (G.kol || 1), b = K.b * (G.kol || 1), reach = (a + b) / 2;
  const R = {fOut: 0, pOut: 0, nf: 0, np: 0, fTh: [], pTh: [], fWr: [], pWr: [], cost: 0, armBody: [], foreGtr: [], sleeveGtr: [], pForeGtr: [], fByP: {}};
  const triL = (S, W, E) => angle(sub(S, E), sub(W, E));
  for (const f of F){
    // perde eli
    if (f.home < 0.5){ R.nf++;
      const Kp = T.pt(f.fk), u0 = nrm(T.dir(f.fy)); let best = null;
      for (const u of cone(u0, BETA)){ const W = sub(Kp, sc(u, K.KN * T.s)), d = len(sub(W, SL)), out = d > a + b - 0.002, th = out ? 180 : Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)))) * 180 / Math.PI;
        const c = (out ? 1e4 : band(th)) + 2 * angle(u, u0); if (!best || c < best.c) best = {c, W, th, out, u}; }
      if (best.out) R.fOut++;
      let pl = sub(sub(best.W, sc(best.u, reach)), SL); if (pl[2] < 0) pl[2] = 0;
      const E = ik(SL, best.W, pl, a, b), th = triL(SL, best.W, E), wr = angle(sub(best.W, E), best.u);
      R.fTh.push(th); R.fWr.push(wr); (R.fUA = R.fUA || []).push(angle(sub(E, SL), [0, -1, 0])); { const sw = detay ? swivelLow(SL, best.W, a, b, T, K) : null; (R.fUAmin = R.fUAmin || []).push(sw ? sw.el : 180); } (R.fEz = R.fEz || []).push(E[2]); (R.fUc = R.fUc || []).push(triL(SL, add(best.W, sc(best.u, 0.045)), E)); R.cost += best.c; (R.fByP[f.p + (f.r > 0.5 ? "H" : "L")] = R.fByP[f.p + (f.r > 0.5 ? "H" : "L")] || []).push(th);
      { const n = detay ? 10 : 4; let ab = -1, fg = -1, sg = -1;   // üst kol omuz ekleminin içinden başlar: %35'ten sonrası sayılır
        for (let k = 0; k <= n; k++){ const u = k / n, p1 = add(SL, sc(sub(E, SL), 0.35 + 0.65 * u)), p2 = add(E, sc(sub(best.W, E), u)); ab = Math.max(ab, bodyPen(p1, K.rUst), bodyPen(p2, K.rOn));
          const q = T.inv(p2), sd = guitarSd(q) * T.s; fg = Math.max(fg, K.rOn - sd); if (u > 0.5) sg = Math.max(sg, K.rYen - sd); }
        R.armBody.push(ab); R.foreGtr.push(fg); R.sleeveGtr.push(sg); if (detay){ (R.fE = R.fE || []).push(E); (R.fW = R.fW || []).push(best.W); } } }
    // pena eli
    R.np++;
    const mu = f.mu, Gp = add(sc(K.G0, 1 - mu), sc(K.G1, mu)), y = nrm(T.dir(f.py)), z = nrm(T.dir(f.pz)), x = crs(y, z), Pk = T.pt(f.pk);
    const off = add(add(sc(x, Gp[0]), sc(y, Gp[1])), sc(z, Gp[2])); let best = null;
    for (const o of cone(nrm(off), BETA_P)){ const W = sub(Pk, sc(o, len(off))), d = len(sub(W, SR)), out = d > a + b - 0.002, th = out ? 180 : Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)))) * 180 / Math.PI;
      const c = (out ? 1e4 : band(th)) + 2 * angle(o, nrm(off)); if (!best || c < best.c) best = {c, W, th, out, o}; }
    if (best.out) R.pOut++;
    const yh = best.o === off ? y : y;   // el yönü koninin dönüşüyle yaklaşık (yalnız kutup için)
    let hp = sub(sub(best.W, sc(yh, reach)), SR); if (hp[2] < 0) hp[2] = 0; hp = nrm(hp);
    let pl = nrm(add(sc(hp, 1 - mu), sc(POLE_P, mu))); pl = [pl[0], pl[1], pl[2] + 1.5 * 4 * mu * (1 - mu)];
    const E = ik(SR, best.W, pl, a, b), th = triL(SR, best.W, E);
    R.pTh.push(th); R.cost += best.c; (R.pUA = R.pUA || []).push(angle(sub(E, SR), [0, -1, 0])); { const sw = detay ? swivelLow(SR, best.W, a, b, T, K) : null; (R.pUAmin = R.pUAmin || []).push(sw ? sw.el : 180); } (R.pEz = R.pEz || []).push(E[2]); (R.pUc = R.pUc || []).push(triL(SR, add(best.W, sc(y, 0.045)), E));
    { const n = detay ? 10 : 4; let ab = -1, fg = -1; for (let k = 0; k <= n; k++){ const u = k / n, p1 = add(SR, sc(sub(E, SR), 0.35 + 0.65 * u)), p2 = add(E, sc(sub(best.W, E), u)); ab = Math.max(ab, bodyPen(p1, K.rUst), bodyPen(p2, K.rOn));
      fg = Math.max(fg, K.rOn - guitarSd(T.inv(p2)) * T.s); } R.armBody.push(ab); R.pForeGtr.push(fg); if (detay){ (R.pE = R.pE || []).push(E); (R.pW = R.pW || []).push(best.W); } }
  }
  // gitar ↔ beden
  let gb = -9, ge = -9, gs = -9, gap = 9;
  for (const p of BACK){ const w = T.pt(p), f0 = front(0, w[0], w[1]); if (!isNaN(f0)){ gb = Math.max(gb, f0 - w[2]); gap = Math.min(gap, w[2] - f0); }
    const f1 = front(1, w[0], w[1]); if (!isNaN(f1)) ge = Math.max(ge, f1 - w[2]); const f2 = front(2, w[0], w[1]); if (!isNaN(f2)) gs = Math.max(gs, f2 - w[2]); }
  R.govdeGiris = gb; R.etekGiris = ge; R.sacGiris = gs; R.bosluk = gap;
  return R;
}
export function score(R, G){
  const fo = R.fOut / Math.max(1, R.nf), po = R.pOut / R.np, inb = a => a.filter(t => t >= 60 && t <= 120).length / Math.max(1, a.length);
  const q95 = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(0.95 * (s.length - 1))] : -1; }, pos = x => Math.max(0, x);
  // çarpışma: kol ↔ beden, ön kol ↔ gövde (p95 ve en kötü); duruş gerçekçiliği: kapak yatışı 3-15°, sap öne 6-23°
  const col = 4e5 * (pos(q95(R.armBody)) ** 2 + pos(q95(R.foreGtr)) ** 2 + pos(q95(R.pForeGtr)) ** 2) + 4e4 * (pos(Math.max(...R.armBody, -1)) ** 2 + pos(Math.max(...R.pForeGtr, -1) - 0.003) ** 2);
  const real = 40 * (pos(0.05 - G.phi) + pos(G.phi - 0.26)) + 20 * (pos(0.1 - G.psi) + pos(G.psi - 0.4));
  const mean = a => a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, nat = (G.dogal === 0 ? 0 : 20) * (mean((R.fUA || []).map(u => pos(u - 50) / 10).map(v => v * v)) + mean((R.pUA || []).map(u => pos(u - 55) / 10).map(v => v * v)) + mean((R.fEz || []).map(z => pos(-0.06 - z) / 0.02).map(v => v * v)));
  return nat + 2e4 * (fo + po) + R.cost / (R.nf + R.np) + 4e5 * Math.max(0, R.govdeGiris + 0.005) ** 2 + 4e5 * Math.max(0, R.bosluk - 0.02) ** 2 + 30 * (2 - inb(R.fTh) - inb(R.pTh)) + col + real;
}
export function report(R){
  const pc = (a, b) => +(100 * a / Math.max(1, b)).toFixed(2), inb = (a, lo = 60, hi = 120) => pc(a.filter(t => t >= lo && t <= hi).length, a.length), mm = a => a.length ? st(a.map(x => x * 1000)) : null;
  const byP = Object.fromEntries(Object.entries(R.fByP).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, a]) => [k, +st(a).med.toFixed(1)]));
  return {perde: {erisimDisi_yuzde: pc(R.fOut, R.nf), dirsek: st(R.fTh), aralik60_120_yuzde: inb(R.fTh), dirsekUc_syncCheck: st(R.fUc), dirsekUc60_120_yuzde: inb(R.fUc), bilekBukum: st(R.fWr), ustKolDuseyden: st(R.fUA || [0]), ustKolDuseydenEnAlcakDirsek: st(R.fUAmin || [0]), dirsekZ: st(R.fEz || [0]), pencereDirsekMed: byP},
    pena: {erisimDisi_yuzde: pc(R.pOut, R.np), dirsek: st(R.pTh), aralik60_120_yuzde: inb(R.pTh), dirsekUc_syncCheck: st(R.pUc), dirsekUc60_120_yuzde: inb(R.pUc), ustKolDuseyden: st(R.pUA || [0]), ustKolDuseydenEnAlcakDirsek: st(R.pUAmin || [0]), dirsekZ: st(R.pEz || [0])},
    gitarBeden_mm: {govdeGiris: +(R.govdeGiris * 1000).toFixed(1), enKucukBosluk: +(R.bosluk * 1000).toFixed(1), etekGiris: +(R.etekGiris * 1000).toFixed(1), sacGiris: +(R.sacGiris * 1000).toFixed(1)},
    kolBeden_mm: mm(R.armBody), perdeOnKolGovde_mm: mm(R.foreGtr), perdeYenGovde_mm: mm(R.sleeveGtr), penaOnKolGovde_mm: mm(R.pForeGtr),
    ...(R.fE ? {konum_med: Object.fromEntries([["perdeDirsek", R.fE], ["perdeBilek", R.fW], ["penaDirsek", R.pE], ["penaBilek", R.pW]].map(([k, A]) => [k, [0, 1, 2].map(i => +st(A.map(v => v[i])).med.toFixed(3))]))} : {})};
}
// Arama: koordinat inişi + rastgele yeniden başlatma (tohumlu, Math.random yok)
function lcg(s){ return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
export function search(F, base, fix = {}, iters = 6, seed = 7){
  const rnd = lcg(seed), keys = [["ox", 0.02], ["oy", 0.02], ["oz", 0.01], ["a", 0.05], ["psi", 0.05], ["phi", 0.04]].filter(([k]) => !(k in fix));
  const get = (G, k) => k[0] === "o" && k.length === 2 ? G.o["xyz".indexOf(k[1])] : G[k], set = (G, k, v) => { const H = {...G, o: G.o.slice()}; if (k[0] === "o" && k.length === 2) H.o["xyz".indexOf(k[1])] = v; else H[k] = v; return H; };
  const lim = {a: [0.2, 1.1], psi: [0, 0.6], phi: [-0.1, 0.5]};
  const sc0 = G => score(evaluate(G, F), G);
  let best = {...base, ...fix, o: base.o.slice()}, bs = sc0(best);
  for (let r = 0; r < iters; r++){
    let G = r ? set(set(set(best, "ox", best.o[0] + (rnd() - 0.5) * 0.08), "oy", best.o[1] + (rnd() - 0.5) * 0.08), "a", Math.min(1.1, Math.max(0.2, best.a + (rnd() - 0.5) * 0.3))) : best, s = sc0(G);
    for (let pass = 0; pass < 4; pass++) for (const [k, st0] of keys) for (let step = st0; step >= st0 / 4; step /= 2){
      for (const sg of [1, -1]){ let v = get(G, k) + sg * step; if (lim[k]) v = Math.min(lim[k][1], Math.max(lim[k][0], v)); const H = set(G, k, v), hs = sc0(H); if (hs < s){ G = H; s = hs; } } }
    if (s < bs){ best = G; bs = s; }
  }
  return {G: best, s: bs};
}
if (process.argv[1] && process.argv[1].split(/[\\/]/).pop() === "yerlesim.mjs"){
  const {F} = talep(), mode = process.argv[2] || "ara", sub4 = F.filter((_, i) => i % 6 === 0);
  const r3 = G => ({...G, o: G.o.map(x => +x.toFixed(4)), a: +G.a.toFixed(4), psi: +G.psi.toFixed(4), phi: +G.phi.toFixed(4)});
  if (mode === "olc"){ const G = JSON.parse(process.argv[3]), T = pose(G), p3 = v => v.map(x => +x.toFixed(4));
    console.log(JSON.stringify(r3(G)), JSON.stringify(report(evaluate(G, F, KAN, true)), null, 1));
    console.log("gitar noktaları (figür):", JSON.stringify({esik: p3(T.pt([0, 0, 0])), perde12: p3(T.pt([0.324, 0, 0.0565])), kopru: p3(T.pt([0.648, 0, 0.0595])), pena: p3(T.pt([0.575, 0, 0.0595])),
      ustPim: p3(T.pt(GT.pimler.ust)), altPim: p3(T.pt(GT.pimler.alt)), X: p3(T.X), Y: p3(T.Y), Z: p3(T.Z)})); }
  else {
    // manken duruşunun Kanade'ye aynen uygulanışı (karşılaştırma): manken'in karın noktası (−0.1117, 0.92, 0.12), a 0.6
    const MK = {o: [-0.1117, 0.92, 0.12], a: 0.6, psi: 0, phi: 0, s: 1, d: 0};
    console.log("MANKEN DURUŞU (aynen):", JSON.stringify(report(evaluate(MK, F, KAN, true))));
    const runs = (process.argv[3] ? JSON.parse(process.argv[3]) : [{s: 1, d: 0}, {s: 1, d: 0.03}, {s: 0.94, d: 0.03}, {s: 1, d: 0.03, kol: 1.1}]);
    for (const fx of runs){ const start = {o: [-0.06, 1.05, 0.15], a: 0.6, psi: 0.2, phi: 0.1, s: 1, d: 0, ...fx};
      const t0 = Date.now(), {G, s} = search(sub4, start, {s: fx.s, d: fx.d, ...(fx.kol ? {kol: fx.kol} : {})}, 5);
      console.log(`\n=== s ${fx.s} d ${fx.d}${fx.kol ? " kol ×" + fx.kol : ""}: skor ${s.toFixed(2)} (${((Date.now() - t0) / 1000).toFixed(1)} sn)`, JSON.stringify(r3(G)));
      console.log(JSON.stringify(report(evaluate(G, F, KAN, true)))); }
  }
}
