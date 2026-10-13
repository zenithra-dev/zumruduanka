// Dinleme örnekleri: dört şarkıdan 10'ar saniye (temiz, crunch, lead, riff), wav ve mp3 olarak out/guitar/<şarkı>-<etiket>.
//   node tools/guitar-samples.mjs v7
import fs from "node:fs";
import { execSync } from "node:child_process";
import { openHarness, ROOT } from "./browser.js";
import path from "node:path";
const label = process.argv[2] || "x";
const h = await openHarness();
const r = await h.page.evaluate(async () => {
  const SR = 44100;
  const { createEngine } = await import("/sim/audio/engine.js");
  const { createInstruments } = await import("/sim/audio/instruments.js");
  const { schedule } = await import("/sim/audio/playback.js");
  const { seed } = await import("/sim/rng.js");
  const { findSong } = await import("/sim/band/songs/index.js");
  const { encodeWav } = await import("/sim/audio/wav.js");
  const out = {};
  for (const [id, t0, t1] of [["elise", 0, 10], ["riff", 0, 10], ["tepegoz", 25, 35], ["kaf", 0, 10]]){
    const song = findSong(id), off = new OfflineAudioContext(2, Math.ceil(SR * t1), SR); seed(1);
    const eng = createEngine(off, {amp: song.amp, room: 1.3, volume: 0.75}); const inst = createInstruments(eng);
    schedule(song, {engine: eng, inst});
    const buf = await off.startRendering(), n = (t1 - t0) * SR, cut = off.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) cut.getChannelData(c).set(buf.getChannelData(c).subarray(t0 * SR, t0 * SR + n));
    let pk = 0; for (let c = 0; c < 2; c++){ const d = cut.getChannelData(c); for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); }
    out[id] = encodeWav(cut, pk > 0 ? 0.89 / pk : 1);
  }
  return out;
});
const DIR = path.join(ROOT, "out/guitar"); fs.mkdirSync(DIR, {recursive: true});
for (const [id, wav] of Object.entries(r)){
  const w = path.join(DIR, `${id}-${label}.wav`); fs.writeFileSync(w, Buffer.from(wav, "base64"));
  execSync(`ffmpeg -y -loglevel error -i "${w}" -codec:a libmp3lame -b:a 192k "${w.replace(/\.wav$/, ".mp3")}"`);
}
console.log("yazıldı:", Object.keys(r).map(k => `${k}-${label}`).join(", "));
await h.close();
