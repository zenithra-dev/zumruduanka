// Aday şarkı denetimi: src altındaki bir şarkı modülünü (index.js'e eklemeden) yükler, nota olaylarını denetler ve sesini üretir.
//   node tools/candidate.mjs sim/band/songs/_aday_a.js [out/aday-a.wav]
// Denetim: perde 0-22, tel 0-5, süre > 0, aynı anda en çok altı nota, akorda el açıklığı (aynı vuruştaki basılı perdeler) en çok 5 perde;
// sonra offline ses: süre, tepe, NaN.
import fs from "node:fs";
import path from "node:path";
import { openHarness, ROOT } from "./browser.js";
const mod = process.argv[2], OUT = path.resolve(process.argv[3] || path.join(ROOT, "out/aday.wav"));
if (!mod){ console.error("kullanım: node tools/candidate.mjs sim/band/songs/<dosya>.js [çıktı.wav]"); process.exit(1); }
const song = (await import("file:///" + path.join(ROOT, "src", mod).replace(/\\/g, "/"))).default;
const {bpm, ev} = song.build(), probs = [];
ev.forEach((e, i) => {
  if (!(e.s >= 0 && e.s <= 5 && Number.isInteger(e.s))) probs.push(`#${i} tel ${e.s}`);
  if (!(e.f >= 0 && e.f <= 22 && Number.isInteger(e.f))) probs.push(`#${i} perde ${e.f}`);
  if (!(e.d > 0) || !(e.b >= 0)) probs.push(`#${i} zaman b=${e.b} d=${e.d}`);
});
const byBeat = {};
ev.forEach(e => { const k = Math.round(e.b * 16); (byBeat[k] ||= []).push(e); });
for (const [k, g] of Object.entries(byBeat)){
  const fr = g.filter(e => e.f > 0).map(e => e.f);
  if (new Set(g.map(e => e.s)).size < g.length) probs.push(`vuruş ${k / 16}: aynı telde iki nota`);
  if (fr.length > 1 && Math.max(...fr) - Math.min(...fr) > 5) probs.push(`vuruş ${k / 16}: el açıklığı ${Math.max(...fr) - Math.min(...fr)} perde`);
}
const spb = 60 / bpm, end = Math.max(...ev.map(e => e.b + e.d)) * spb;
console.log(`${song.name} (${song.amp}, ${bpm} BPM): ${ev.length} nota, ${end.toFixed(1)} sn` + (probs.length ? `\nSORUN:\n  ${probs.slice(0, 20).join("\n  ")}` : "\ndenetim temiz"));
fs.mkdirSync(path.dirname(OUT), {recursive: true});
const h = await openHarness();
const r = await h.page.evaluate(async ([mod, dur]) => {
  const SR = 44100, off = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const song = (await import("/" + mod)).default;
  const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: 1});
  sim.load(song);
  const buf = await off.startRendering(), L = buf.getChannelData(0); let pk = 0, nan = 0;
  for (let i = 0; i < L.length; i++){ if (!isFinite(L[i])) nan++; pk = Math.max(pk, Math.abs(L[i])); }
  return {pk, nan, wav: window.encodeWav(buf, pk > 0 ? 0.89 / pk : 1)};
}, [mod.replace(/\\/g, "/"), end + 2.5]);
fs.writeFileSync(OUT, Buffer.from(r.wav, "base64"));
console.log(`ses: tepe ${r.pk.toFixed(2)}, NaN ${r.nan} → ${OUT}`);
await h.close();
process.exit(probs.length || r.nan ? 1 : 0);
