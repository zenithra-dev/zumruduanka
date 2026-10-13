// Akort testi: temiz amfiden 18 tek nota, sent hassasiyetinde perde (otokorelasyon + parabolik ara değer, 0.25 sn pencere).
//   node tools/tuning.mjs   → nota başına sent hatası; hedef ortalama 0.5 sentin altı
import { openHarness } from "./browser.js";
const h = await openHarness();
const r = await h.page.evaluate(async () => {
  const SR = 44100;
  const { createEngine } = await import("/sim/audio/engine.js");
  const { createInstruments } = await import("/sim/audio/instruments.js");
  const { seed } = await import("/sim/rng.js");
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTES = [40, 43, 45, 47, 50, 52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81];
  const off = new OfflineAudioContext(2, Math.ceil(SR * (NOTES.length * 0.8 + 0.5)), SR); seed(1);
  const eng = createEngine(off, {amp: "clean", room: 1.3, volume: 0.75}); const inst = createInstruments(eng); const srcs = [];
  eng.setAmp("clean"); const bus = off.createGain(); bus.connect(eng.chainIn);
  NOTES.forEach((midi, i) => { const t = 0.2 + i * 0.8; const src = off.createBufferSource(); src.buffer = inst.ksBuffer(midi); const g = off.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.setTargetAtTime(0, t + 0.6, 0.03); src.connect(g); g.connect(bus); src.start(t); src.stop(t + 0.75); srcs.push(src); });
  const buf = await off.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
  function pitchFine(t, f){
    const N = Math.floor(0.25 * SR), o = Math.floor(t * SR), x = new Float32Array(N); for (let i = 0; i < N; i++) x[i] = (L[o + i] + R[o + i]) / 2;
    const lag0 = Math.max(2, Math.floor(SR / (f * 1.06))), lag1 = Math.ceil(SR / (f * 0.94));
    const corr = lag => { let s = 0; for (let i = 0; i + lag < N; i++) s += x[i] * x[i + lag]; return s; };
    let best = -Infinity, bl = lag0; for (let lag = lag0; lag <= lag1; lag++){ const c = corr(lag); if (c > best){ best = c; bl = lag; } }
    const cm = corr(bl - 1), cp = corr(bl + 1), den = cm - 2 * best + cp, dlt = den ? 0.5 * (cm - cp) / den : 0;
    return SR / (bl + dlt);
  }
  return NOTES.map((midi, i) => { const f = mtof(midi), m = pitchFine(0.2 + i * 0.8 + 0.25, f); return {midi, f, m, cents: 1200 * Math.log2(m / f)}; });
});
const worst = r.reduce((a, b) => Math.abs(b.cents) > Math.abs(a.cents) ? b : a);
console.log(r.map(x => `${x.midi}:${x.cents >= 0 ? "+" : ""}${x.cents.toFixed(1)}`).join("  "));
console.log(`en kötü: midi ${worst.midi} ${worst.cents.toFixed(1)} sent, ortalama |hata| ${(r.reduce((a, b) => a + Math.abs(b.cents), 0) / r.length).toFixed(2)} sent`);
await h.close();
