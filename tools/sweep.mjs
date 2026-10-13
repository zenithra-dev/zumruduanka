// Ses tasarımı taraması: her varyant için dört gitar klibi üretilir, yazılım kulak (YAMNet) puanlar, spektral merkez ölçülür.
//   node tools/sweep.mjs            → V içindeki tüm varyantlar
//   node tools/sweep.mjs P Q3       → seçilenler
// Varyant: amps (engine.js AMPS alanları), cab (engine.js CAB), string (guitar.js STRING), double (playback.js DOUBLE) üzerine yazılır.
// Puan: elektro gitar + gitar + distorsiyon − (alarm, telefon, zil, kanun, çan, gayda, synth, klavye, siren). Kulak hakem, kulağın yerine değil.
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { openHarness, ROOT } from "./browser.js";
const EAR = path.join(ROOT, "tools/ear"), PY = path.join(EAR, "venv/bin/python");
const OUT = path.join(ROOT, "out/sweep"); fs.mkdirSync(OUT, {recursive: true});
if (!fs.existsSync(PY)){ console.error("önce yazılım kulağı kur: bash tools/ear/setup.sh"); process.exit(1); }
const V = {
  P:  {},                                                              // mevcut ayarlar
  Q3: {string: {smooth: 1}, amps: {clean: {pickup: 5000}, crunch: {pickup: 4200}, lead: {pickup: 3600}}},
  D1: {double: {on: true}},                                            // çift kayıt açık
  D2: {double: {on: true, jitterMs: 8, detuneCents: 1.2}},             // daha sıkı çift kayıt
  P4: {string: {dual: 0.2}},                                           // çok hafif ikinci polarizasyon
  P5: {amps: {crunch: {bias: 0}, lead: {bias: 0}}},                    // simetrik kırpma
  N:  {string: {exciter: "noise"}},                                    // eski gürültü vuruşu (karşılaştırma)
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(V);
const h = await openHarness();
const CLIPS = [["elise", 0, 10], ["riff", 0, 10], ["tepegoz", 25, 35], ["kaf", 0, 10]];
const GOOD = ["Electric guitar", "Guitar", "Distortion"]; const SKIP = ["_centroid"], BAD = ["Alarm", "Telephone", "Ringtone", "Zither", "Bell", "Cowbell", "Bagpipes", "Synthesizer", "Keyboard (musical)", "Siren"];
const rows = [];
for (const name of names){
  await h.fresh();
  const r = await h.page.evaluate(async ([over, CLIPS]) => {
    const SR = 44100;
    const { createEngine, AMPS, CAB } = await import("/sim/audio/engine.js");
    const { STRING } = await import("/sim/audio/guitar.js");
    const { DOUBLE } = await import("/sim/audio/playback.js");
    if (over.string) Object.assign(STRING, over.string);
    if (over.double) Object.assign(DOUBLE, over.double);
    const { createInstruments } = await import("/sim/audio/instruments.js");
    const { schedule } = await import("/sim/audio/playback.js");
    const { seed } = await import("/sim/rng.js");
    const { findSong } = await import("/sim/band/songs/index.js");
    const { encodeWav } = await import("/sim/audio/wav.js");
    if (over.amps) for (const k in over.amps) Object.assign(AMPS[k], over.amps[k]);
    if (over.cab) Object.assign(CAB, over.cab);
    const out = {};
    for (const [id, t0, t1] of CLIPS){
      const song = findSong(id), off = new OfflineAudioContext(2, Math.ceil(SR * t1), SR); seed(1);
      const eng = createEngine(off, {amp: song.amp, room: 1.3, volume: 0.75}); const inst = createInstruments(eng);
      schedule(song, {engine: eng, inst});
      const buf = await off.startRendering(), n = (t1 - t0) * SR, cut = off.createBuffer(2, n, SR);
      for (let c = 0; c < 2; c++) cut.getChannelData(c).set(buf.getChannelData(c).subarray(t0 * SR, t0 * SR + n));
      let pk = 0; for (let c = 0; c < 2; c++){ const d = cut.getChannelData(c); for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); }
      out[id] = encodeWav(cut, pk > 0 ? 0.89 / pk : 1);
    }
    return out;
  }, [V[name], CLIPS]);
  const files = [];
  for (const [id, wav] of Object.entries(r)){ const f = `${OUT}/${id}-${name}.wav`; fs.writeFileSync(f, Buffer.from(wav, "base64")); files.push(f); }
  const txt = execSync(`${PY} ${EAR}/score_json.py ${files.join(" ")}`).toString();
  const sc = JSON.parse(txt); // {file: {class: p}}
  let total = 0; const per = {};
  for (const [f, cl] of Object.entries(sc)){
    const id = f.split("/").pop().split("-")[0];
    const good = GOOD.reduce((a, k) => a + (cl[k] || 0), 0), bad = BAD.reduce((a, k) => a + (cl[k] || 0), 0);
    per[id] = {c: cl["_centroid"] || 0, eg: cl["Electric guitar"] || 0, g: cl["Guitar"] || 0, d: cl["Distortion"] || 0, bad, top: Object.entries(cl).filter(([k]) => !SKIP.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}`).join(", ")};
    total += good - bad;
  }
  rows.push({name, total, per});
  console.log(`${name.padEnd(3)} toplam ${(total * 100).toFixed(0).padStart(4)}  ` + Object.entries(per).map(([id, p]) => `${id}: EG ${(p.eg * 100).toFixed(0)} G ${(p.g * 100).toFixed(0)} D ${(p.d * 100).toFixed(0)} kötü ${(p.bad * 100).toFixed(0)} merkez ${p.c.toFixed(0)} [${p.top}]`).join(" | "));
}
rows.sort((a, b) => b.total - a.total);
console.log("\nSIRALAMA: " + rows.map(r => `${r.name} ${(r.total * 100).toFixed(0)}`).join("  "));
await h.close();
