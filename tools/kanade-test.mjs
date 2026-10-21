// Kanade temel denetimi (node, tarayıcısız; VRM dokusuz ayrıştırılır): ölçü tablosu (iskelet.js) ↔ VRM, çalışma zamanı kalibrasyonu ↔ tablo ve
// vekil → VRM aktarım hatası rastgele (hash) pozlarda. Kabul: tablo ve kalibrasyon ≤ 0.1 mm, aktarım ≤ 0.5 mm (30 parmak eklemi + 10 uç, kollar,
// zincir). Kıyafet (taban + varsayılan kıyafet, kiyafetler.json): kıyafetsiz yükleme hata, tek iskelet, yen_kivrik kıyafette, Body morfsuz, gizli
// deri, varyant çözümü, bilinmeyen kıyafet hata. Morph bekçisi: 10 hedef isteyen grupta ifade.js active() kırpmadan önceki sayıyı (10) verir, r128'e 8 gider. Çıkış kodu 1: kabul dışı.
//   node tools/kanade-test.mjs            # OUT=out/tur5/temel/kanade-test.json yazar (verilirse)
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THREE_URL = pathToFileURL(path.join(ROOT, "src/vendor/three/build/three.module.js")).href;
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n){ if (s === "three") return {url: ${JSON.stringify(THREE_URL)}, shortCircuit: true}; return n(s, c); }`));
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const THREE = await import("three");
const { parseKanade, setKanadeAsset } = await imp("src/sim/stage/kanade/vrm.js");
const { KANADE: K } = await imp("src/sim/stage/kanade/iskelet.js");
const { kanadeFigure } = await imp("src/sim/stage/kanade/vekil.js");
const { poseArm, bendFinger } = await imp("src/sim/stage/figures.js");

const { kiyafetCoz, kiyafetSecimi, tonPiksel } = await imp("src/sim/stage/kanade/kiyafet.js");
const AS = path.join(ROOT, "src/assets/kanade"), MAN = JSON.parse(fs.readFileSync(path.join(AS, "kiyafetler.json"), "utf8"));
const oku = f => { const b = fs.readFileSync(path.join(AS, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const ab = oku(MAN.taban.dosya), KS = kiyafetCoz(MAN, kiyafetSecimi(null, {}));
const t0 = performance.now(), asset = await parseKanade(ab, {doku: false, kiyafet: {ab: oku(KS.tanim.dosya), tanim: KS.tanim, ad: KS.ad, varyant: KS.varyant, spec: KS.spec}}), tParse = performance.now() - t0;
// Kıyafet sözleşmesi
const hata = async f => { try { await f(); return null; } catch (e){ return e.message; } };
const kAg = asset.meshes.filter(m => m.userData.kiyafet), body = asset.meshes.filter(m => m.userData.node === "Body");
const kiy = {ad: KS.ad, varyant: KS.varyant, ag: kAg.length, kiyafetsiz: await hata(() => parseKanade(ab, {doku: false})),
  bilinmeyen: await hata(() => kiyafetCoz(MAN, {kiyafet: "yok"})), varyantYok: await hata(() => kiyafetCoz(MAN, {kiyafet: "gotik", varyant: "yok"})),
  bordo: !!kiyafetCoz(MAN, kiyafetSecimi({kiyafet: "gotik", kiyafet_varyant: "bordo"})).spec, sarkiSecimi: kiyafetSecimi({kiyafet: "gotik", kiyafet_varyant: "bordo"}, {kiyafet_varyant: "asil"}).varyant,
  tekIskelet: asset.meshes.every(m => m.skeleton === asset.skeleton), culled: asset.meshes.some(m => m.frustumCulled),
  yen: (asset.groups.yen_kivrik_L || []).map(b => b.node), bodyMorph: body.some(m => m.morphTargetInfluences && m.morphTargetInfluences.length),
  kMorph: kAg.map(m => (m.morphTargetInfluences || []).length), n0: asset.meshes.filter(m => m.userData.n0 !== undefined).map(m => m.userData.node + ":" + m.userData.n0),
  gizli: body.reduce((s, m) => s + (m.userData.gizliUcgen || 0), 0), morfluMalzeme: kAg.every(m => [].concat(m.material).every(x => x.morphTargets && x.skinning)),
  ton: Array.from(tonPiksel(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128]), {koyu: "#800000", dantel: "#00ff00"}))};
// 1) Tablo ↔ VRM (three ile ayrıştırılmış, dinlenme): kemik konumları F'de
asset.root.updateMatrixWorld(true);
let tablo = 0; for (const [n, b] of Object.entries(K.kemik)){ const o = asset.bones.get(n); if (!o) continue; const w = o.getWorldPosition(new THREE.Vector3());
  tablo = Math.max(tablo, Math.hypot(-w.x - b.p[0], w.y - b.p[1], -w.z - b.p[2])); }
// 2) Figür + kalibrasyon (vekil.js attach): tablo ile kurulan vekil elin eklemleri ↔ VRM dinlenme eklemleri
setKanadeAsset(asset);
const scene = new THREE.Scene(), fig = kanadeFigure(scene, {x: 0.2, z: -0.19, sway: 0.5});
// 3) Aktarım: hash'li pozlar (gövde dili L, kol hedefleri, el yönleri, parmak bükümleri) → commit → VRM ↔ vekil
const h = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };
const R = {mm: 0, kol_mm: 0, parmak_mm: 0, zincir_mm: 0}, sure = [];
fig.blinks = [];
for (let k = 0; k < 60; k++){
  const c = s => h(k, s) - 0.5;
  fig.life({br: c(1) * 2, rx: 0.15 + 0.3 * c(2), rz: 0.1 * c(3), ry: 0.2 * c(4), drop: 0.04 * h(k, 5), nod: 0.8 * c(6), look: 0.3 * c(7), spread: 0.1 * h(k, 8)});
  fig.g.updateMatrixWorld(true);
  [0, 1].forEach(i => {
    const S = fig.up.localToWorld(fig.sh[i].clone()), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(6.28 * h(k, 10 + i), 6.28 * h(k, 12 + i), 6.28 * h(k, 14 + i)));
    const T = S.clone().add(new THREE.Vector3((i ? -1 : 1) * (0.05 + 0.3 * h(k, 16 + i)), -0.1 - 0.25 * h(k, 18 + i), 0.05 + 0.3 * h(k, 20 + i)));
    poseArm(fig, i, T, null, {q, off: new THREE.Vector3(0, 0.07, 0)});
    for (let f = 0; f < 5; f++) bendFinger(fig.hands[i], f, 0.4 * c(30 + f + 5 * i), [1.4 * h(k, 40 + f), 1.5 * h(k, 50 + f), 1.1 * h(k, 60 + f)]);
  });
  const a = performance.now(); fig.commit(k, k); sure.push(performance.now() - a);
  const e = fig.vrm.err(); for (const x of Object.keys(R)) R[x] = Math.max(R[x], e[x]);
}
// 4) Morph bekçisi (ifade.js): istenen etkin hedef sayısı kırpmadan önce sayılır; kırpma son savunma
const { createIfade } = await imp("src/sim/stage/kanade/ifade.js");
const BM = {userData: {node: "X"}, morphTargetInfluences: new Array(12).fill(0)}, BE = createIfade({meshes: [BM], groups: {g: [...Array(10)].map((_, i) => ({node: "X", index: i, w: 1}))}});
BE.reset(); BE.set("g", 0.5); BE.apply();
const bekci = {istenen: BE.active(), cizilen: BM.morphTargetInfluences.filter(v => v > 0).length, kirpilan: BE.kirpilan()};
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
const out = {vrm: K.vrm, ayristirma_ms: +tParse.toFixed(0), tablo_mm: +(tablo * 1000).toFixed(4), kalibrasyon_mm: +fig.vrm.kalibrasyon_mm.toFixed(4),
  aktarim: Object.fromEntries(Object.entries(R).map(([k, v]) => [k, +v.toFixed(4)])), poz: sure.length, commit_ms_med: +med(sure).toFixed(3),
  morph_etkin: fig.expr.active(), morph_bekci: bekci, kiyafet: kiy,
  kabul: {tablo: tablo * 1000 <= 0.1, kalibrasyon: fig.vrm.kalibrasyon_mm <= 0.1, aktarim: R.mm <= 0.5, morph: fig.expr.active() <= 8, bekci: bekci.istenen === 10 && bekci.cizilen === 8 && bekci.kirpilan === 2,
    kiyafet: kiy.ag > 0 && /kıyafetsiz/.test(kiy.kiyafetsiz || "") && !!kiy.bilinmeyen && !!kiy.varyantYok && kiy.bordo && kiy.sarkiSecimi === "asil" && kiy.tekIskelet && !kiy.culled &&
      kiy.yen.length > 0 && kiy.yen.every(n => /^Kiyafet_/.test(n)) && !kiy.bodyMorph && kiy.kMorph.every(n => n === 2) && kiy.gizli === KS.tanim.gizli_deri.ucgen && kiy.morfluMalzeme &&
      kiy.n0.some(x => /^Kiyafet_/.test(x)) && kiy.ton[1] === 255 && kiy.ton[0] === 0 && kiy.ton[4] === 0 && kiy.ton[7] === 128}};
console.log(JSON.stringify(out, null, 1));
if (process.env.OUT){ fs.mkdirSync(path.dirname(path.resolve(ROOT, process.env.OUT)), {recursive: true}); fs.writeFileSync(path.resolve(ROOT, process.env.OUT), JSON.stringify(out, null, 1)); }
process.exit(Object.values(out.kabul).every(Boolean) ? 0 : 1);
