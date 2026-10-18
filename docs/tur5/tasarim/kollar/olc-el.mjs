// Kanade'nin eli, kolu ve gövde önü: VRM dinlenme ağından (T duruşu; kemik dönüşleri birim) ölçüm.
//   node out/tur5/tasarim/kollar/olc-el.mjs  → ekrana özet + out/tur5/tasarim/kollar/kanade-olcu.json
// Çerçeveler: VRM yerel (model -Z'ye bakar, sol -X). "Figür" çerçevesi = 180° çevrilmiş: (x, y, z) → (−x, y, −z): +z ön, +x figürün solu.
// El çerçevesi (figures.js makeHand sözleşmesi): +y parmaklar (bilekten orta parmak köküne), +z avucun baktığı yan, +x = y × z (sağ elde başparmak yanı).
import fs from "node:fs";
import { loadVrm, skinnedPrims, m4 } from "./glb.mjs";
const OUT = "C:/work/zumruduanka/out/tur5/tasarim/kollar/";
const V = loadVrm("C:/work/karakter/cikti/karakter.vrm"), H = V.hb, P = i => m4.pt(V.world[i], [0, 0, 0]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = a => Math.hypot(...a), nrm = a => sc(a, 1 / len(a)), crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r4 = x => +x.toFixed(4), v4 = a => a.map(r4), q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const nodeByName = n => V.nodes.findIndex(x => x.name === n);

// Köşeler: her ilkel için indeksten köşe kümesi; baskın eklem (en büyük ağırlık) ve ağırlığı
const prims = skinnedPrims(V), matName = p => V.json.materials[p.mat].name;
const verts = [];   // {p, j (baskın düğüm), w, mat, mesh}
for (const pr of prims){
  const A = V.json.meshes[V.nodes[pr.node].mesh].primitives[pr.prim], idx = A.indices !== undefined ? V.acc(A.indices) : null, seen = new Set(idx || []);
  for (const i of seen){ let bj = -1, bw = -1; for (let k = 0; k < 4; k++){ const w = pr.wgt[i * 4 + k]; if (w > bw){ bw = w; bj = pr.jnt[i * 4 + k]; } }
    verts.push({p: [pr.pos[i * 3], pr.pos[i * 3 + 1], pr.pos[i * 3 + 2]], j: bj, w: bw, mat: matName(pr), mesh: pr.mesh}); }
}
const SKIN = v => /Body_00_SKIN/.test(v.mat), TOPS = v => /Tops/.test(v.mat), NAIL = v => /Tirnak/.test(v.mesh);
const desc = (i, acc = new Set()) => { acc.add(i); (V.nodes[i].children || []).forEach(c => desc(c, acc)); return acc; };

// ---------- El ----------
const FN = ["Thumb", "Index", "Middle", "Ring", "Little"], AD = ["başparmak", "işaret", "orta", "yüzük", "serçe"];
function hand(side){   // side "R" | "L" (VRM adı)
  const S = side === "R" ? "right" : "left", h = H[S + "Hand"], W = P(h);
  const J = FN.map(f => [1, 2, 3].map(k => nodeByName(`J_Bip_${side}_${f}${k}`)).concat([nodeByName(`J_Bip_${side}_${f}3_end`)]));
  const y = nrm(sub(P(J[2][0]), W));
  // avuç normali: elin baskın köşelerinin (deri) en küçük yayılım ekseni; işareti: VRM −Y (T duruşunda avuç aşağı)
  const hv = verts.filter(v => SKIN(v) && v.j === h && v.w > 0.5).map(v => v.p);
  const c = sc(hv.reduce(add, [0, 0, 0]), 1 / hv.length), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of hv){ const d = sub(p, c); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
  let z = [0, -1, 0]; for (let it = 0; it < 60; it++){   // en küçük özvektör: (tr·I − C) üzerinde kuvvet yinelemesi
    const tr = C[0][0] + C[1][1] + C[2][2], Mz = [0, 1, 2].map(a => tr * z[a] - (C[a][0] * z[0] + C[a][1] * z[1] + C[a][2] * z[2])); z = nrm(Mz); }
  z = nrm(sub(z, sc(y, dot(z, y)))); if (z[1] > 0) z = sc(z, -1);
  const x = crs(y, z), toH = p => { const d = sub(p, W); return [dot(d, x), dot(d, y), dot(d, z)]; };
  // sağ elde x başparmak yanı olmalı; sol elde (figures.js aynası) başparmak −x
  const thumbSide = Math.sign(toH(P(J[0][1]))[0]);
  const fingers = J.map((C4, k) => {
    const pts = C4.map(P), b = toH(pts[0]), l = [0, 1, 2].map(s => len(sub(pts[s + 1], pts[s])));
    const seg = [0, 1, 2].map(s => {   // boğumun ağ yarıçapı: baskın kemiği bu olan deri köşelerinin eksene dik uzaklığı (yanal ve avuç yönünde ayrı)
      const a = pts[s], e = nrm(sub(pts[s + 1], a)), lat = nrm(crs(e, z)), pal = crs(lat, e), R = [], RL = [], RP = [], U = [];
      for (const v of verts){ if (!SKIN(v) || v.j !== C4[s] || v.w < 0.5) continue; const d = sub(v.p, a), u = dot(d, e), o = sub(d, sc(e, u));
        R.push(len(o)); RL.push(Math.abs(dot(o, lat))); RP.push(Math.abs(dot(o, pal))); U.push(u); }
      return {n: R.length, r_med: r4(q(R, 0.5)), r_p90: r4(q(R, 0.9)), yanal_p90: r4(q(RL, 0.9)), avuc_p90: r4(q(RP, 0.9)), u_max: r4(Math.max(...U)), u_min: r4(Math.min(...U))}; });
    // uç: uç boğumun deri + tırnak köşelerinin eksen boyunca en uzağı
    const a = pts[2], e = nrm(sub(pts[3], a)); let tipU = 0, nailU = 0, nailN = 0; const nailOff = [];
    for (const v of verts){ if (v.j !== C4[2] || v.w < 0.5) continue; const u = dot(sub(v.p, a), e);
      if (SKIN(v)) tipU = Math.max(tipU, u); if (NAIL(v)){ nailU = Math.max(nailU, u); nailN++; const o = sub(sub(v.p, a), sc(e, u)); nailOff.push(dot(o, z)); } }
    const d = toH(pts[1]); const dn = nrm(sub(d, b));
    return {ad: AD[k], dugum: C4.map(i => V.name(i)), b: v4(b), l: v4(l), uc_deri: r4(tipU), uc_tirnak: r4(nailU), tirnakKose: nailN, tirnakAvucYonu_med: nailN ? r4(q(nailOff, 0.5)) : null, d: v4(dn), seg};
  });
  // avuç kutusu (el çerçevesi): bilek kemiğine baskın deri köşeleri
  const hp = hv.map(toH), bb = [0, 1, 2].map(a => [r4(Math.min(...hp.map(p => p[a]))), r4(Math.max(...hp.map(p => p[a])))]);
  // hipotenar topuk: avuç yüzündeki (z en büyük %20) köşelerden serçe yanı (thumbSide'ın tersi) ve bileğe yakın (y < 0.035) olanların ortası
  const zc = q(hp.map(p => p[2]), 0.8), heelPts = hp.filter(p => p[2] >= zc && Math.sign(p[0]) === -thumbSide && p[1] > 0.008 && p[1] < 0.04);
  const heel = heelPts.length ? sc(heelPts.reduce(add, [0, 0, 0]), 1 / heelPts.length) : null;
  // kol kemikleri
  const ua = H[S + "UpperArm"], la = H[S + "LowerArm"];
  return {kenar: S, bilekVRM: v4(W), elCercevesiVRM: {x: v4(x), y: v4(y), z: v4(z)}, basparmakYani: thumbSide, avucKutusu: bb, avucKoseSayisi: hv.length, topuk: heel && v4(heel), topukKose: heelPts.length,
    ustKol: r4(len(sub(P(la), P(ua)))), onKol: r4(len(sub(W, P(la)))), omuzVRM: v4(P(ua)), dirsekVRM: v4(P(la)), fingers, J};
}
const R = hand("R"), L = hand("L");

// ---------- Kol ve yen: yarıçap kemik ekseni boyunca ----------
function armProfile(side){
  const S = side === "R" ? "right" : "left", ua = H[S + "UpperArm"], la = H[S + "LowerArm"], h = H[S + "Hand"], A = P(ua), E = P(la), W = P(h);
  const D = desc(ua), out = [];
  const axisLen = len(sub(E, A)) + len(sub(W, E));
  const at = s => s <= len(sub(E, A)) ? add(A, sc(nrm(sub(E, A)), s)) : add(E, sc(nrm(sub(W, E)), s - len(sub(E, A))));
  const dirAt = s => s <= len(sub(E, A)) ? nrm(sub(E, A)) : nrm(sub(W, E));
  const bins = new Map();
  for (const v of verts){ if (!D.has(v.j) || v.w < 0.3) continue; if (!(SKIN(v) || TOPS(v))) continue;
    // ekseni boyunca konum: omuzdan uzaklık (eksene izdüşüm, parça parça)
    let best = null; for (let s = -0.06; s <= axisLen + 0.1; s += 0.01){ const c = at(Math.min(axisLen, Math.max(0, s))), e = dirAt(Math.min(axisLen, Math.max(0, s)));
      const d = sub(v.p, c), u = dot(d, e); if (Math.abs(u) <= 0.005 + (s < 0 || s > axisLen ? 0.06 : 0)){ const r = len(sub(d, sc(e, u))); if (!best || Math.abs(u) < best.u) best = {s: s + (s < 0 || s > axisLen ? u : 0), u: Math.abs(u), r, d: sub(d, sc(e, u))}; } }
    if (!best) continue; const k = Math.round(best.s / 0.02) * 0.02, key = k.toFixed(2) + (SKIN(v) ? "d" : "y");
    if (!bins.has(key)) bins.set(key, {s: k, t: SKIN(v) ? "deri" : "yen", r: [], down: [], fwd: []});
    const B = bins.get(key); B.r.push(best.r); B.down.push(-best.d[1]); B.fwd.push(-best.d[2]);
  }
  for (const B of [...bins.values()].sort((a, b) => a.s - b.s || a.t.localeCompare(b.t))) out.push({s: r4(B.s), t: B.t, n: B.r.length, r_p50: r4(q(B.r, 0.5)), r_max: r4(Math.max(...B.r)), asagi_max: r4(Math.max(...B.down)), yukari_max: r4(-Math.min(...B.down)), on_max: r4(Math.max(...B.fwd)), arka_max: r4(-Math.min(...B.fwd))});
  return {ustKol: r4(len(sub(E, A))), onKol: r4(len(sub(W, E))), profil: out};
}
const armR = armProfile("R"), armL = armProfile("L");

// ---------- Gövde önü ve etek (figür çerçevesi): y dilimlerinde x sütunlarının en öndeki yüzeyi ----------
const ARMSET = new Set([...desc(H.rightUpperArm), ...desc(H.leftUpperArm)]), HEAD = desc(H.neck);
const front = {}, back = {}, wid = {};
for (const v of verts){ if (ARMSET.has(v.j) && v.w > 0.5) continue; if (!(SKIN(v) || TOPS(v) || /HairBack|Hair_00/.test(v.mat))) continue;
  const fx = -v.p[0], fy = v.p[1], fz = -v.p[2], ky = Math.round(fy / 0.02), kx = Math.round(fx / 0.02), key = ky + "," + kx, cls = SKIN(v) || TOPS(v) ? "g" : "s";
  if (fy < 0.5 || fy > 1.6) continue;
  const K = key + cls; if (front[K] === undefined || fz > front[K]) front[K] = fz; if (back[K] === undefined || fz < back[K]) back[K] = fz; }
const prof = []; for (let ky = 25; ky <= 80; ky++){ const row = {y: r4(ky * 0.02), on: [], saconu: []}; for (let kx = -15; kx <= 15; kx++){ const g = front[ky + "," + kx + "g"], s = front[ky + "," + kx + "s"];
  row.on.push(g === undefined ? null : r4(g)); row.saconu.push(s === undefined ? null : r4(s)); } prof.push(row); }

// ---------- boy, ayak ----------
const ys = verts.filter(v => SKIN(v) || /Shoes/.test(v.mat)).map(v => v.p[1]), yh = verts.map(v => v.p[1]);
const boy = {ayakTabani: r4(Math.min(...ys)), tepe_sac: r4(Math.max(...yh)), tepe_deri: r4(Math.max(...verts.filter(v => SKIN(v) || /FACE|SKIN/.test(v.mat)).map(v => v.p[1])))};

const res = {boy, el: {R, L}, kol: {R: armR, L: armL}, govdeOnu: {not: "figür çerçevesi (x figürün solu, z ön); her satır y diliminin x = −0.30..0.30 (0.02 adım) sütunlarında en öndeki z: on = deri+giysi (kollar hariç), saconu = saç", satirlar: prof}};
fs.writeFileSync(OUT + "kanade-olcu.json", JSON.stringify(res, null, 1));
// özet
console.log("boy:", boy);
for (const E of [R, L]){ console.log(`\n${E.kenar} el: bilek ${E.bilekVRM}, çerçeve x ${E.elCercevesiVRM.x} y ${E.elCercevesiVRM.y} z ${E.elCercevesiVRM.z}, başparmak yanı ${E.basparmakYani}, üst kol ${E.ustKol} ön kol ${E.onKol}`);
  console.log(`  avuç kutusu x ${E.avucKutusu[0]} y ${E.avucKutusu[1]} z ${E.avucKutusu[2]} (${E.avucKoseSayisi} köşe), topuk ${E.topuk} (${E.topukKose})`);
  for (const f of E.fingers) console.log(`  ${f.ad.padEnd(9)} b ${f.b} l ${f.l} uç deri ${f.uc_deri} tırnak ${f.uc_tirnak} (${f.tirnakKose}) d ${f.d} | r ${f.seg.map(s => `${s.r_med}/${s.r_p90} (yan ${s.yanal_p90} avuç ${s.avuc_p90}, n${s.n}, u ${s.u_min}..${s.u_max})`).join(" ; ")}`); }
for (const [n, A] of [["R", armR], ["L", armL]]){ console.log(`\nkol ${n}: üst ${A.ustKol}, ön ${A.onKol}`); for (const p of A.profil) console.log(`  s ${p.s.toFixed(2)} ${p.t.padEnd(4)} n${String(p.n).padStart(4)} r med ${p.r_p50} max ${p.r_max} aşağı ${p.asagi_max} yukarı ${p.yukari_max} ön ${p.on_max} arka ${p.arka_max}`); }
