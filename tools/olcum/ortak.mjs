// Kolların bağımsız ölçüm betikleri için ortak parçalar (tools/olcum/<kol>.mjs; sync-check'in tanımlarına dokunmadan). Sunucunun kökü src/
// olduğu için bu modül sayfaya yüklenemez: sayfada çalışan parçalar dizge olarak verilir ve sayfada eval edilir (sync-check'teki gibi).
//   import { openHarness, kareler, st } from "./ortak.mjs";
//   const h = await openHarness();
//   const A = await kareler(h, {SONG: "dagkrali", T0: 20, T1: 30}, `(sim, p, t, k, A) => { A.push(sim.FIG.claude.head.getWorldPosition(new sim.THREE.Vector3()).y); }`);
//   console.log(st(A)); await h.close();
// Tarayıcı açan her koşu oyun kapısından ve tek sıradan geçer (oyun.ps1 && sira.sh dusuk.sh node ...).
//   node tools/olcum/ortak.mjs      # kendi denetimi: kısa bir kare döngüsü, deri noktası ↔ köşe × matrixWorld (deri bağsız ağda aynı olmalı)
import { pathToFileURL } from "node:url";
import { openHarness } from "../browser.js";
export { openHarness };

// Sayfada sim kurulumu (temiz sayfada tek sim): P = {SEED, ENV, CAM, SONG}; sim hazır değilse (yazı tipi, karakter) ölçülmez
export const MK = `(P) => { const off = new OfflineAudioContext(2, 88200, 44100);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: P.SEED ?? 1});
  if ((sim.ready ?? sim.texReady) === false) throw new Error("sim hazır değil: kanvas dokuları yazı tipi ya da karakter bekliyor");
  sim.setEnv(P.ENV || "club"); sim.setCamera(P.CAM || "director"); const p = P.SONG ? sim.load(window.findSong(P.SONG)) : null; return {sim, p}; }`;

// Deri noktası (sayfada): ağın i. köşesi dünyada; deri bağlı ağda (SkinnedMesh) bağ pozu değil o anki kemiklerle (boneTransform, morf hariç).
// Köşe özniteliği bağ pozudur: deri bağlı ağı position × matrixWorld ile ölçmek T-pozunu ölçer. Kemiklerin matrixWorld'ü güncel olmalı.
export const SKIN = `(m, i, out) => (m.isSkinnedMesh ? m.boneTransform(i, out) : out.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld)`;

// Kare döngüsü: temiz sayfada sim kurulur, T0..T1 (sn; yoksa şarkının başı ve sonu) FPS'te sim.update ve sahnenin matrisleri; her karede
// adim(sim, p, t, k, A, skin) çağrılır (sayfada; A ölçümün biriktirdiği dizi, skin = SKIN). Döner: A (JSON'a çevrilebilir olmalı).
export async function kareler(h, P, adim){
  await h.fresh();
  return h.page.evaluate(([MK, SKIN, P, adim]) => {
    const {sim, p} = eval(MK)(P), skin = eval(SKIN), f = eval(adim), A = [], fps = P.FPS || 30;
    const t0 = P.T0 ?? (p ? p.t0 : 0), t1 = P.T1 ?? (p ? p.end : t0 + 1);
    for (let k = Math.ceil(t0 * fps - 1e-9); k / fps <= t1; k++){ const t = k / fps; sim.update(t, t); sim.scene.updateMatrixWorld(true); f(sim, p, t, k, A, skin); }
    return A;
  }, [MK, SKIN, P, adim]);
}

// İstatistik (sync-check ile aynı tanım): n, min, p10, med, p90, max
export const st = a => { const s = a.slice().sort((x, y) => x - y), q = k => s.length ? s[Math.min(s.length - 1, Math.floor(k * s.length))] : null;
  return {n: s.length, min: s[0] ?? null, p10: q(0.1), med: q(0.5), p90: q(0.9), max: s.length ? s[s.length - 1] : null}; };
export const r3 = v => typeof v === "number" ? +v.toFixed(3) : v;

if (import.meta.url === pathToFileURL(process.argv[1]).href){
  const h = await openHarness();
  try {
    const A = await kareler(h, {SONG: "dagkrali", T0: 20, T1: 20.5}, `(sim, p, t, k, A, skin) => { const f = sim.FIG.claude, V = new sim.THREE.Vector3(), W = new sim.THREE.Vector3();
      let n = 0, d = 0; f.g.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position;
        for (let i = 0; i < P.count; i++){ skin(m, i, V); W.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); d = Math.max(d, V.distanceTo(W)); n++; } });
      A.push({t, kafa: f.head.getWorldPosition(V).y, n, d}); }`);
    const fark = Math.max(...A.map(a => a.d));
    console.log(`ortak.mjs: ${A.length} kare, kafa yüksekliği ${JSON.stringify(st(A.map(a => r3(a.kafa))))}, ${A[0].n} köşe, deri noktası ↔ köşe en büyük fark ${fark} m`);
    if (!(A.length > 10 && fark === 0)) process.exitCode = 1;
  } finally { await h.close(); }
}
