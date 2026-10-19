// Kanade ölçü tablosu üreticisi: VRM (src/assets/kanade/kanade.vrm) → src/sim/stage/kanade/iskelet.js (üretilmiş, elle düzenlenmez). three'siz,
// glb.js ile (yükleyici de aynı okuyucuyu kullanır). Çerçeve F (figür): +z ön, +x figürün solu, y yerden; m.
//   node tools/kanade-iskelet.mjs              # tabloyu yazar
//   node tools/kanade-iskelet.mjs --denetle    # yazılı tablo VRM ile uyuşuyor mu (sha1, kaynak.json, dinlenme konumları ≤ 0.1 mm); uyuşmazsa çıkış 1
// İçerik: kemikler (F), insansı eşleme, kol ve bacak boyları, el tabloları L/R (tek çerçeve: glb.js handFrame), avuç kutusu, topuk, tırnak uçları,
// yen/etek/saç zincirleri ve ikizler, sac.json salınım sınırları (F yönleriyle), kemiğe bağlı beden elipsoitleri, etek konisi, askı bağlantı
// ofsetleri, yüz y maskesi, kafanın dinlenme noktası.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseGlb, accessor, restWorld, posOf, toF, humanoid, handFrame, handTable, FINGERS } from "../src/sim/stage/kanade/glb.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VRM = path.join(ROOT, "src/assets/kanade/kanade.vrm"), KAYNAK = path.join(ROOT, "src/assets/kanade/kaynak.json"), SAC = path.join(ROOT, "src/assets/kanade/sac.json");
const OUT = path.join(ROOT, "src/sim/stage/kanade/iskelet.js");
const r6 = x => +x.toFixed(6), v6 = a => a.map(r6);
// Mankenin parmak ab (yana açılma) ve pa (yastığın avuç yanına açısı) değerleri (figures.js HAND)
const AB = [1.2, 0.6, 0.5, 0.55, 0.6], PA = [1.35, 0.52, 0.52, 0.52, 0.52];
// Askı bağlantı noktaları (F, dinlenme; kollar incelemesi aski-s100: yüzey ızgarası; kalça etek açılımının üstüne, y ≈ 1.04) ve bağlı oldukları kemik
const ASKI = [["gogus", "J_Bip_C_UpperChest", [0.07, 1.33, 0.1015]], ["omuz", "J_Bip_C_UpperChest", [0.075, 1.445, -0.0086]], ["kurek", "J_Bip_C_UpperChest", [0.075, 1.3, -0.0512]],
  ["sirt", "J_Bip_C_Chest", [0, 1.18, -0.0425]], ["bel", "J_Bip_C_Hips", [-0.1, 1.07, -0.1251]], ["kalca", "J_Bip_C_Hips", [-0.18, 1.04, 0.011]], ["karin", "J_Bip_C_Hips", [-0.09, 1.07, 0.1582]]];
// Yüz ifadesi pişirme maskesi (görünüm incelemesi): dinlenme y'si göz ≥ 1.540, ağız ≤ 1.528, arası doğrusal
const YUZ = {goz: 1.54, agiz: 1.528};
// Gitarın göğse dayandığı nokta (kollar incelemesi temas.mjs, F): yaslanma telafisinin referansı (beden.js)
const TEMAS = [-0.01, 1.29, 0.147];

export function uret(){
  const buf = fs.readFileSync(VRM), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const sha1 = crypto.createHash("sha1").update(buf).digest("hex"), kay = JSON.parse(fs.readFileSync(KAYNAK, "utf8"));
  if (kay.sha1 !== sha1 || kay.bayt !== buf.length) throw new Error(`kaynak.json ile VRM uyuşmuyor: ${kay.sha1}/${kay.bayt} ↔ ${sha1}/${buf.length}`);
  const {json, bin} = parseGlb(ab), {world, parent} = restWorld(json), N = json.nodes, idx = {};
  N.forEach((n, i) => { idx[n.name] = i; });
  const P = n => { if (idx[n] === undefined) throw new Error("kemik yok: " + n); return toF(posOf(world[idx[n]])); };
  const H = humanoid(json), insan = Object.fromEntries(Object.entries(H).map(([k, i]) => [k, N[i].name]));
  const meshNodes = new Set(N.map((n, i) => n.mesh !== undefined ? i : -1).filter(i => i >= 0));
  const kemik = {}; N.forEach((n, i) => { if (meshNodes.has(i) || (n.mesh === undefined && !n.name.startsWith("J_") && n.name !== "Root")) return;
    kemik[n.name] = {p: v6(P(n.name)), ust: parent[i] >= 0 ? N[parent[i]].name : null}; });
  const dist = (a, b) => Math.hypot(...[0, 1, 2].map(k => P(a)[k] - P(b)[k]));
  const kol = Object.fromEntries(["L", "R"].map(s => [s, {l1: r6(dist(`J_Bip_${s}_UpperArm`, `J_Bip_${s}_LowerArm`)), l2: r6(dist(`J_Bip_${s}_LowerArm`, `J_Bip_${s}_Hand`))}]));
  const bacak = Object.fromEntries(["L", "R"].map(s => [s, [r6(dist(`J_Bip_${s}_UpperLeg`, `J_Bip_${s}_LowerLeg`)), r6(dist(`J_Bip_${s}_LowerLeg`, `J_Bip_${s}_Foot`))]]));

  // Deri: Body ağının köşeleri (4 ilkel aynı öznitelikleri paylaşır; ilkel 0 ten, 1 giysi, 2 ayakkabı, 3 arka saç), baskın kemik, F konum
  const skinVerts = meshName => { const mi = json.meshes.findIndex(m => m.name === meshName), m = json.meshes[mi], ni = N.findIndex(n => n.mesh === mi), sk = json.skins[N[ni].skin];
    const A = m.primitives[0].attributes, pos = accessor(json, bin, A.POSITION).array, J = accessor(json, bin, A.JOINTS_0).array, W = accessor(json, bin, A.WEIGHTS_0).array;
    const prim = new Int8Array(pos.length / 3).fill(-1); m.primitives.forEach((p, k) => { const I = accessor(json, bin, p.indices).array; for (let i = 0; i < I.length; i++) prim[I[i]] = k; });
    const V = []; for (let v = 0; v < pos.length / 3; v++){ let bw = -1, bj = 0; for (let c = 0; c < 4; c++) if (W[v * 4 + c] > bw){ bw = W[v * 4 + c]; bj = J[v * 4 + c]; }
      V.push({p: toF([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]), v: [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], b: N[sk.joints[bj]].name, k: prim[v]}); }
    return V; };
  const BODY = skinVerts("Body.baked"), NAIL = skinVerts("Aksesuar_Tirnak"), FACE = skinVerts("Face.baked");
  const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
  // Noktanın a→b ekseninde parametresi u (0 a, 1 b) ve eksene uzaklığı
  const segU = (q, a, b) => { const ab2 = [0, 1, 2].map(k => b[k] - a[k]), l = ab2.reduce((s, x) => s + x * x, 0), u = [0, 1, 2].reduce((s, k) => s + (q[k] - a[k]) * ab2[k], 0) / l, w = Math.max(0, Math.min(1, u));
    return [u, Math.hypot(...[0, 1, 2].map(k => q[k] - a[k] - w * ab2[k])), Math.sqrt(l)]; };

  // El tabloları: b, l, d (glb.js handTable, tek çerçeve) + r (boğum kalınlığı, baskın kemiği o boğum olan ten köşelerinin eksene uzaklığı: kök ve orta
  // boğumda orta %40 kesitin (az köşeliyse bütün boğumun) (p50 + p90) / 2'si, uçta uçtan 4-9 mm gerideki yastık kesitinin p90'ı) + ab/pa (mankenden)
  const el = {}, avuc = {}, topuk = {}, tirnak = {};
  for (const s of ["L", "R"]){
    const sol = s === "L", F = handFrame(P, sol), T = handTable(P, sol);
    el[s] = T.map((t, k) => { const f = FINGERS[k], j = i => `J_Bip_${s}_${f}${i}`, ends = [j(2), j(3), `${j(3)}_end`];
      const r = [1, 2, 3].map(i => { const U = BODY.filter(q => q.k === 0 && q.b === j(i)).map(q => segU(q.p, P(j(i)), P(ends[i - 1])));
        const mid = U.filter(([u]) => u >= 0.3 && u <= 0.7), D = (i < 3 ? (mid.length >= 4 ? mid : U.filter(([u]) => u >= 0 && u <= 1)) : U.filter(([u, , l]) => (1 - u) * l >= 0.004 && (1 - u) * l <= 0.009)).map(x => x[1]);
        return r6(D.length ? (i < 3 ? (pct(D, 0.5) + pct(D, 0.9)) / 2 : pct(D, 0.9)) : 0.006); });
      return {b: v6(t.b), l: v6(t.l), r, d: v6(t.d), ab: AB[k], pa: PA[k]}; });
    const hv = BODY.filter(q => q.k === 0 && q.b === `J_Bip_${s}_Hand`).map(q => F.loc(q.p));
    avuc[s] = {min: [0, 1, 2].map(i => r6(pct(hv.map(p => p[i]), 0.02))), max: [0, 1, 2].map(i => r6(pct(hv.map(p => p[i]), 0.98)))};
    // Topuk (avucun serçe kenarındaki tümsek, palm mute'ta köprüye değer): serçe yanında, bilekten 1.8-3.2 cm, avuç yüzünün p95'i
    const hy = hv.filter(p => p[1] > 0.018 && p[1] < 0.032 && p[0] < -0.01);
    topuk[s] = hy.length ? [r6(pct(hy.map(p => p[0]), 0.5)), 0.025, r6(pct(hy.map(p => p[2]), 0.95))] : [-0.0104, 0.0253, 0.0183];
    // Tırnak ucu: uç boğuma bağlı tırnak köşelerinden boğum yönünde en uzaktaki; uç kemiğin VRM yerelinde (dinlenme dönüşü kimlik) ofset
    tirnak[s] = Object.fromEntries(FINGERS.map(f => { const a = posOf(world[idx[`J_Bip_${s}_${f}3`]]), e = posOf(world[idx[`J_Bip_${s}_${f}3_end`]]), d = [0, 1, 2].map(k => e[k] - a[k]);
      let best = null, bp = -9; for (const q of NAIL) if (q.b === `J_Bip_${s}_${f}3`){ const pr = [0, 1, 2].reduce((t, k) => t + (q.v[k] - a[k]) * d[k], 0); if (pr > bp){ bp = pr; best = q.v; } }
      return [f, best ? v6([0, 1, 2].map(k => best[k] - a[k])) : null]; }));
  }

  // Zincirler: yen, etek, saç (ikiz: <ad>_Govde_<k> ↔ <ad>_<k>)
  const names = N.map(n => n.name), by = re => names.filter(n => re.test(n) && !/_end$/.test(n));
  const yen = Object.fromEntries(["L", "R"].map(s => [s, {LowerSleeve: `J_Sec_${s}_LowerSleeve`, TipSleeve: `J_Sec_${s}_TipSleeve`}]));
  const etek = {}; for (const n of by(/^J_Sec_[LR]_Skirt/)){ const k = n.replace(/\d+$/, ""); (etek[k] = etek[k] || []).push(n); }
  const sac = {}, ikiz = {}; for (const n of by(/^J_Sec_Hair_/)){ const m = /^J_Sec_Hair_([A-Za-z]+\d+)_(Govde_)?(\d+)$/.exec(n); if (!m) continue;
    if (m[2]) ikiz[n] = `J_Sec_Hair_${m[1]}_${m[3]}`; else (sac[m[1]] = sac[m[1]] || []).push(n); }
  // sac.json salınım sınırları: yön adları Blender çerçevesinde (geri +y ...), F yönleriyle; derece
  const SJ = JSON.parse(fs.readFileSync(SAC, "utf8")), Z = SJ.salinim_siniri.zincir, YON = {geri: [0, 0, -1], ileri: [0, 0, 1], sol: [1, 0, 0], sag: [-1, 0, 0]};
  // (yön anahtarı "sol_2" gibi ekliyse yönü adın kökünden)
  const sinir = {yon: YON, zincir: Object.fromEntries(Object.entries(Z).map(([ad, z]) => [ad, Object.fromEntries(["kok", "hepsi"].map(k => [k, Object.fromEntries(Object.entries(z[k]).map(([y, x]) => [y, x.izin_derece]))]))]))};

  // Beden elipsoitleri (giysiyi sarar: ten + giysi köşeleri), kemik başına, köşe kutusu %2-98; merkez kemiğin F ofseti, yarıçaplar. Kollar
  // incelemesinin (govde-ilkel.json) kümesinden farkı: elbisenin göğüs köşeleri Bust kemiklerine (70 köşe, 58'i giysi), bel çevresindekiler etek
  // kök kemiklerine (Skirt*0/1, y ≥ 0.94'te 16 giysi köşesi) bağlı: onlarsız üst göğüs ve kalça giysiyi kaçırır; y < 0.94 etek konisine kalır.
  // Kutuya içten oturan elipsoit köşegenleri kaçırır (govde.js v0 sınırı: önde ~3 cm içeride); gövde-askı kolu yeniden uydurur.
  const ELIPS = {hips: [/^J_Bip_C_Hips$|Skirt.*[01]$/], spine: [/^J_Bip_C_Spine$/], chest: [/^J_Bip_C_Chest$/], upperChest: [/^J_Bip_C_UpperChest$|Bust/], neck: [/^J_Bip_C_Neck$/],
    shoulderL: [/^J_Bip_L_Shoulder$/], shoulderR: [/^J_Bip_R_Shoulder$/], upperLegL: [/^J_Bip_L_UpperLeg$/], upperLegR: [/^J_Bip_R_UpperLeg$/], lowerLegL: [/^J_Bip_L_LowerLeg$/], lowerLegR: [/^J_Bip_R_LowerLeg$/]};
  const KEM = {hips: "J_Bip_C_Hips", spine: "J_Bip_C_Spine", chest: "J_Bip_C_Chest", upperChest: "J_Bip_C_UpperChest", neck: "J_Bip_C_Neck", shoulderL: "J_Bip_L_Shoulder", shoulderR: "J_Bip_R_Shoulder",
    upperLegL: "J_Bip_L_UpperLeg", upperLegR: "J_Bip_R_UpperLeg", lowerLegL: "J_Bip_L_LowerLeg", lowerLegR: "J_Bip_R_LowerLeg"};
  const elipsoit = Object.fromEntries(Object.entries(ELIPS).map(([k, [re]]) => { const Q = BODY.filter(q => (q.k === 0 || q.k === 1) && re.test(q.b) && !(k === "hips" && q.p[1] < 0.94)).map(q => q.p), o = P(KEM[k]);
    const lo = [0, 1, 2].map(i => pct(Q.map(p => p[i]), 0.02)), hi = [0, 1, 2].map(i => pct(Q.map(p => p[i]), 0.98));
    return [k, {kemik: KEM[k], m: v6([0, 1, 2].map(i => (lo[i] + hi[i]) / 2 - o[i])), r: v6([0, 1, 2].map(i => Math.max(0.01, (hi[i] - lo[i]) / 2))), n: Q.length}]; }));
  // Etek konisi (kalçaya bağlı kesik koni): elbisenin (giysi ilkeli) kalçanın ve etek kemiklerinin taşıdığı köşelerinden iki bantta yan, ön ve arka yarı genişlik (p98)
  const band = (y0, y1) => { const Q = BODY.filter(q => q.k === 1 && /C_Hips|Skirt/.test(q.b) && q.p[1] >= y0 && q.p[1] <= y1).map(q => q.p), hc = P("J_Bip_C_Hips");
    return {y: r6((y0 + y1) / 2), yan: r6(pct(Q.map(p => Math.abs(p[0] - hc[0])), 0.98)), on: r6(pct(Q.map(p => p[2] - hc[2]), 0.98)), arka: r6(pct(Q.map(p => hc[2] - p[2]), 0.98)), n: Q.length}; };
  const etekKoni = {ust: band(0.97, 1.01), alt: band(0.58, 0.64)};
  // Askı bağlantı ofsetleri: noktanın bağlı kemiğe göre F ofseti (dinlenme)
  const aski = ASKI.map(([id, k, p]) => ({id, kemik: k, m: v6(p.map((x, i) => x - P(k)[i]))}));
  // Kafanın dinlenme noktası (yönetmen kadrajı; mankende kafa küresinin merkezi): yüz ağının y sınırlarının ortası, x = z = 0
  const fy = FACE.map(q => q.p[1]), restHead = v6([0, (Math.min(...fy) + Math.max(...fy)) / 2, 0]);
  return {vrm: {bayt: buf.length, sha1}, insan, kemik, kol, bacak, el, avuc, topuk, tirnak, zincir: {yen, etek, sac, ikiz}, sinir, elipsoit, etekKoni, aski, yuz: YUZ, temas: TEMAS, restHead};
}

function yaz(K){
  const head = `// ÜRETİLMİŞ (node tools/kanade-iskelet.mjs): Kanade VRM'inin ölçü tablosu. Elle düzenleme; VRM değişince araç yeniden koşulur, --denetle uyuşmayı yakalar.
// Çerçeve F (figür): +z ön, +x figürün solu, y yerden, metre. El tabloları glb.js handFrame çerçevesinde (sol el sağın x aynası); tırnak uçları uç
// kemiğin VRM yerelinde; elipsoit ve askı ofsetleri kemiğe göre F'de.
`;
  return head + "export const KANADE = " + JSON.stringify(K) + ";\n";
}

if (import.meta.url === pathToFileURL(process.argv[1]).href){
  const K = uret();
  if (process.argv.includes("--denetle")){
    const {KANADE: Y} = await import(pathToFileURL(OUT).href + "?" + Date.now());
    let mx = 0, eksik = []; for (const [n, b] of Object.entries(K.kemik)){ const y = Y.kemik[n]; if (!y){ eksik.push(n); continue; } mx = Math.max(mx, ...b.p.map((x, i) => Math.abs(x - y.p[i]))); }
    const ayni = JSON.stringify(Y) === JSON.stringify(K), ok = Y.vrm.sha1 === K.vrm.sha1 && Y.vrm.bayt === K.vrm.bayt && !eksik.length && mx <= 1e-4;
    console.log(JSON.stringify({sha1: Y.vrm.sha1 === K.vrm.sha1, bayt: Y.vrm.bayt === K.vrm.bayt, kemik: Object.keys(K.kemik).length, eksik: eksik.length, dinlenmeFarki_mm: +(mx * 1000).toFixed(4), tabloAyni: ayni, karar: ok ? "geçti" : "UYUŞMUYOR: node tools/kanade-iskelet.mjs"}));
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(OUT, yaz(K));
  console.log(`${path.relative(ROOT, OUT)}: ${Object.keys(K.kemik).length} kemik, kol L ${K.kol.L.l1}/${K.kol.L.l2}, bacak ${K.bacak.L}, restHead ${K.restHead}, etek ${JSON.stringify(K.etekKoni)}`);
}
