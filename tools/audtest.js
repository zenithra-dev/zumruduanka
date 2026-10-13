// Ses sağlık testi: şarkının ilk DUR saniyesini offline üretir, tepe/RMS/stereo genişlik ve NaN sayısını yazar, WAV kaydeder.
//
//   SONG=kaf DUR=30 SEED=1 OUT=out/test.wav node tools/audtest.js
import fs from "node:fs";
import path from "node:path";
import { openHarness, ROOT } from "./browser.js";

const SONG = process.env.SONG || "0", DUR = +(process.env.DUR || 30), SEED = +(process.env.SEED || 1);
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "out/test.wav"));
fs.mkdirSync(path.dirname(OUT), {recursive: true});

const h = await openHarness();
const r = await h.page.evaluate(async ([SONG, DUR, SEED]) => {
  const SR = 44100, off = new OfflineAudioContext(2, SR * DUR, SR);
  const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED});
  const song = sim.findSong(SONG); if (!song) throw new Error("Şarkı bulunamadı: " + SONG);
  sim.load(song);
  const buf = await off.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = buf.length;
  let pk = 0, nan = 0, sl = 0, sr = 0, ss = 0;
  for (let i = 0; i < n; i++){ if (!isFinite(L[i])) nan++; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); sl += L[i] * L[i]; sr += R[i] * R[i]; ss += (L[i] - R[i]) ** 2; }
  return {song: song.id, end: sim.playing.end, pk, nan, rmsL: Math.sqrt(sl / n), rmsR: Math.sqrt(sr / n), side: Math.sqrt(ss / n), wav: window.encodeWav(buf, 1)};
}, [SONG, DUR, SEED]);
fs.writeFileSync(OUT, Buffer.from(r.wav, "base64")); delete r.wav;
console.log(JSON.stringify(r), "→", OUT);
await h.close();
