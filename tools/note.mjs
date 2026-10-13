// Tek nota analizi: ham tel tamponunda (amfiden önce) harmonik başına sönüm hızı ve dalgalanma derinliği.
//   node tools/note.mjs                       → mevcut STRING ayarları
//   node tools/note.mjs '{"dual":0.2}'        → STRING üzerine yazılan ayarlarla
// Sönüm: harmoniğin dB zarfına doğru uydurmanın eğimi (dB/sn). Dalgalanma: zarfın o doğrudan sapmasının standart sapması (dB);
// iki polarizasyonun vuruşması ve iki aşamalı sönüm burada görünür. Perde: 0.25-0.5 sn penceresinde sent hatası.
import { openHarness } from "./browser.js";
const over = JSON.parse(process.argv[2] || "{}");
const h = await openHarness();
const r = await h.page.evaluate(async over => {
  const SR = 44100;
  const { STRING, createGuitar } = await import("/sim/audio/guitar.js");
  const { seed } = await import("/sim/rng.js");
  Object.assign(STRING, over);
  const off = new OfflineAudioContext(1, SR, SR); seed(1);
  const { ksBuffer } = createGuitar({ctx: off});
  const out = [];
  for (const midi of [40, 45, 52, 59, 64, 76]){
    const d = ksBuffer(midi).getChannelData(0), f0 = 440 * Math.pow(2, (midi - 69) / 12), win = Math.floor(SR * 0.05), hop = Math.floor(SR * 0.025);
    const row = {midi, h: []};
    for (const k of [1, 2, 3, 5, 8]){
      const f = f0 * k; if (f > 8000) continue;
      const w = 2 * Math.PI * f / SR, env = [];
      for (let o = Math.floor(SR * 0.05); o + win < d.length; o += hop){
        let re = 0, im = 0; for (let i = 0; i < win; i++){ const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / win); re += d[o + i] * hw * Math.cos(w * i); im += d[o + i] * hw * Math.sin(w * i); }
        env.push([o / SR, 20 * Math.log10(Math.hypot(re, im) + 1e-9)]);
      }
      const n = env.length, mx = env.reduce((a, e) => a + e[0], 0) / n, my = env.reduce((a, e) => a + e[1], 0) / n;
      const sl = env.reduce((a, e) => a + (e[0] - mx) * (e[1] - my), 0) / env.reduce((a, e) => a + (e[0] - mx) ** 2, 0);
      const dev = Math.sqrt(env.reduce((a, e) => a + (e[1] - my - sl * (e[0] - mx)) ** 2, 0) / n);
      const early = (env[Math.floor(n * 0.1)][1] - env[0][1]) / (env[Math.floor(n * 0.1)][0] - env[0][0]);
      row.h.push({k, slope: sl, early, dev});
    }
    const N = Math.floor(0.25 * SR), o = Math.floor(0.25 * SR), lag0 = Math.floor(SR / (f0 * 1.06)), lag1 = Math.ceil(SR / (f0 * 0.94));
    const corr = lag => { let s = 0; for (let i = 0; i + lag < N; i++) s += d[o + i] * d[o + i + lag]; return s; };
    let best = -Infinity, bl = lag0; for (let lag = lag0; lag <= lag1; lag++){ const c = corr(lag); if (c > best){ best = c; bl = lag; } }
    const cm = corr(bl - 1), cp = corr(bl + 1), den = cm - 2 * best + cp;
    row.cents = 1200 * Math.log2(SR / (bl + (den ? 0.5 * (cm - cp) / den : 0)) / f0);
    out.push(row);
  }
  return out;
}, over);
for (const row of r) console.log(`midi ${row.midi}  perde ${row.cents >= 0 ? "+" : ""}${row.cents.toFixed(2)} sent  ` + row.h.map(x => `h${x.k}: ${x.slope.toFixed(1)} dB/sn (ilk ${x.early.toFixed(0)}) ±${x.dev.toFixed(2)}`).join("  "));
await h.close();
