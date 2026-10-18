// Kanade temel ölçümü (tarayıcı, swiftshader): ön-yükleme ve ilk kare süresi, bütün şarkı boyunca aktarım hatası (VRM eklemi ↔ vekil: kollar,
// 30 parmak eklemi + 10 uç, gövde zinciri), etkin morph sayısı, commit süresi; sap kamerası gizlemesi (yüz/saç gizli, gövdede yalnız perde ön kolu
// aralığı). Kabul (tur 5 T0): aktarim_mm ≤ 0.5, morph ≤ 8, ön-yükleme ≤ 3 s, ilk kare ≤ 6 s, commit ≤ 1 ms/kare.
//   SONG=dagkrali OUT=out/tur5/temel/kanade-olcum.json node tools/olcum/kanade.mjs      (FPS=30, T0/T1 aralık)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openHarness, st, r3 } from "./ortak.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const E = process.env, SONG = E.SONG || "dagkrali", FPS = +(E.FPS || 30), OUT = path.resolve(ROOT, E.OUT || "out/tur5/temel/kanade-olcum.json");
const h = await openHarness();
const res = {meta: {SONG, FPS, tarih: new Date().toISOString()}};
try {
  // 1) Ön-yükleme (browser.js ready ölçtü: fetch + ayrıştırma + dokular) ve ilk kare (sim kurulumu, yükleme, ilk çizim: doku yükleme, derleme)
  for (let k = 0; k < 2; k++){
    await h.fresh();
    const r = await h.page.evaluate(async ([SONG]) => {
      const V = await import(new URL("sim/stage/kanade/vrm.js", location.href).href), a = V.kanadeAsset(), gl = () => sim.renderer.getContext(), px = new Uint8Array(4);
      const t0 = performance.now(), sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 88200, 44100), manual: true, seed: 1});
      sim.setCamera("director"); sim.load(window.findSong(SONG)); const t1 = performance.now();
      sim.frame(30, 30); gl().readPixels(0, 0, 1, 1, gl().RGBA, gl().UNSIGNED_BYTE, px); const t2 = performance.now();
      sim.frame(30.1, 30.1); gl().readPixels(0, 0, 1, 1, gl().RGBA, gl().UNSIGNED_BYTE, px); const t3 = performance.now();
      return {onYukleme: a.sure, kurulum_ms: t1 - t0, ilkKare_ms: t2 - t1, ikinciKare_ms: t3 - t2, kalibrasyon_mm: sim.FIG.claude.vrm.kalibrasyon_mm};
    }, [SONG]);
    (res.sure = res.sure || []).push(r);
  }
  // 2) Bütün şarkı: aktarım hatası, etkin morph, commit süresi; sap kamerası karelerinde gizleme
  await h.fresh();
  res.sarki = await h.page.evaluate(([SONG, FPS]) => {
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 88200, 44100), manual: true, seed: 1});
    sim.setCamera("director"); const p = sim.load(window.findSong(SONG)), f = sim.FIG.claude, M = f.vrm.meshes;
    const A = {n: 0, mm: 0, kol: 0, parmak: 0, zincir: 0, enKotu: null, morph: 0, commit: [], sap: {kare: 0, ihlal: 0}};
    for (let k = Math.ceil(p.t0 * FPS - 1e-9); k / FPS < p.end; k++){
      const t = k / FPS; sim.update(t, t); A.n++;
      const e = f.vrm.err(); if (e.mm > A.mm){ A.mm = e.mm; A.enKotu = {t, ...e}; }
      A.kol = Math.max(A.kol, e.kol_mm); A.parmak = Math.max(A.parmak, e.parmak_mm); A.zincir = Math.max(A.zincir, e.zincir_mm);
      A.morph = Math.max(A.morph, f.expr.active()); A.commit.push(f.vrm.commit_ms);
      if (sim.director.cam === "head"){ A.sap.kare++;   // yüz, saç, aksesuar gizli; gövdede yalnız perde ön kolu aralığı
        if (M.some(m => m.userData.n0 === undefined ? m.visible : m.geometry.drawRange.count !== m.userData.n0)) A.sap.ihlal++; }
    }
    return A;
  }, [SONG, FPS]);
  const C = st(res.sarki.commit); C.ort = res.sarki.commit.reduce((a, b) => a + b, 0) / res.sarki.commit.length;   // tarayıcı saati 0.1 ms adımlı: ortalama da
  delete res.sarki.commit; res.sarki.commit_ms = C;
  // 3) Hata yolu: VRM yüklenemezse ön-yükleme reddedilir (araçlar durur, browser.js ready), sim hazır değil ve manual sim kare çizmez
  await h.page.goto(h.url + "/harness.html", {waitUntil: "domcontentloaded"}); await h.page.waitForFunction(() => !!window.createSim);
  res.hataYolu = await h.page.evaluate(async () => {
    const red = await window.preloadKanade(5000, location.origin + "/assets/kanade/yok.vrm").then(() => null, e => e.message);
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 88200, 44100), manual: true, seed: 1});
    let cizim = null; try { sim.frame(1, 1); } catch (e){ cizim = e.message; }
    return {onYukleme: red, ready: sim.ready, cizim};
  });
} finally { await h.close(); }
const s = res.sure, S = res.sarki, mx = (k, f) => Math.max(...s.map(x => f(x)));
res.kabul = {aktarim_mm: [r3(S.mm), 0.5, S.mm <= 0.5], morph: [S.morph, 8, S.morph <= 8], onYukleme_s: [r3(mx(0, x => x.onYukleme.toplam_ms) / 1000), 3, mx(0, x => x.onYukleme.toplam_ms) <= 3000],
  ilkKare_s: [r3(mx(0, x => x.kurulum_ms + x.ilkKare_ms) / 1000), 6, mx(0, x => x.kurulum_ms + x.ilkKare_ms) <= 6000], commit_ms_ort: [r3(S.commit_ms.ort), 1, S.commit_ms.ort <= 1],
  sapKamerasi: [`${S.sap.ihlal}/${S.sap.kare}`, "0 ihlal", S.sap.ihlal === 0],
  hataYolu: [res.hataYolu.onYukleme && !res.hataYolu.ready && res.hataYolu.cizim ? "reddedildi, kare yok" : "YANLIŞ", "ön-yükleme reddi + kare yok", !!(res.hataYolu.onYukleme && !res.hataYolu.ready && res.hataYolu.cizim)]};
fs.mkdirSync(path.dirname(OUT), {recursive: true}); fs.writeFileSync(OUT, JSON.stringify(res, (k, v) => r3(v), 1));
console.log(`kanade ölçümü ${SONG} → ${path.relative(ROOT, OUT)}`);
for (const [k, [v, hedef, ok]] of Object.entries(res.kabul)) console.log(`  ${k.padEnd(14)} ${String(v).padStart(10)}  hedef ${hedef}  ${ok ? "✓" : "✗"}`);
console.log(`  aktarım: kol ${r3(S.kol)}, parmak ${r3(S.parmak)}, zincir ${r3(S.zincir)} mm (${S.n} kare); commit ms ort ${r3(S.commit_ms.ort)} med ${r3(S.commit_ms.med)} p90 ${r3(S.commit_ms.p90)} max ${r3(S.commit_ms.max)}`);
console.log(`  süreler: ` + s.map(x => `ön-yükleme ${r3(x.onYukleme.toplam_ms)} ms (fetch ${r3(x.onYukleme.fetch_ms)}, ayrıştırma ${r3(x.onYukleme.ayristirma_ms)}), kurulum ${r3(x.kurulum_ms)}, ilk kare ${r3(x.ilkKare_ms)}, ikinci ${r3(x.ikinciKare_ms)}`).join(" | "));
process.exitCode = Object.values(res.kabul).every(x => x[2]) ? 0 : 1;
