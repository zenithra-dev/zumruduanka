// Ses tasarımı taraması: her varyant için dört gitar klibi üretilir, yazılım kulak (YAMNet) puanlar, spektral merkez ölçülür.
//   node tools/sweep.mjs            → V içindeki tüm varyantlar
//   node tools/sweep.mjs P Q3       → seçilenler
//   SEEDS=1,2,3 node tools/sweep.mjs P   → puan birkaç tohumun ortalaması (pena gürültüsü ve oda değişir; tek tohuma aşırı uymayı önler)
//   JOBS=4 node tools/sweep.mjs ...       → varyantlar dört ayrı tarayıcıda paralel; karşılaştırma hep ilk varyanta göre
// Varyant: amps (engine.js AMPS alanları), cab (engine.js CAB), string (guitar.js STRING), double (playback.js DOUBLE) üzerine yazılır.
// Puan: elektro gitar + gitar + distorsiyon − (alarm, telefon, zil, kanun, çan, gayda, synth, klavye, siren, korna). Kulak hakem, kulağın yerine değil.
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { openHarness, ROOT } from "./browser.js";
const EAR = path.join(ROOT, "tools/ear"), PY = ["venv/bin/python", "venv/bin/python.exe", "venv/Scripts/python.exe"].map(p => path.join(EAR, p)).find(p => fs.existsSync(p));
const OUT = path.join(ROOT, "out/sweep"); fs.mkdirSync(OUT, {recursive: true});
if (!PY){ console.error("önce yazılım kulağı kur: bash tools/ear/setup.sh"); process.exit(1); }
const V = {
  P:  {},                                                              // mevcut ayarlar
  Q3: {string: {smooth: 1}, amps: {clean: {pickup: 5000}, crunch: {pickup: 4200}, lead: {pickup: 3600}}},
  D1: {double: {on: true}},                                            // çift kayıt açık
  D2: {double: {on: true, jitterMs: 8, detuneCents: 1.2}},             // daha sıkı çift kayıt
  P4: {string: {dual: 0.2}},                                           // ikinci polarizasyon, ana telin beşte biri
  Z1: {string: {dual: 0.1}},                                           // ölçülen değer: yatay mod 2 sent pes, manyetikte onda bir
  Z2: {string: {dual: 0.1, dualCents: -5}},                            // 5 sentin üstü fiziksel değil, hafif chorus gibi
  Z3: {string: {dual: 0.1, dualCents: -10}},
  Z4: {string: {dual: 0.1, dualCents: -20}},
  Z5: {string: {dual: 0.1, dualCents: 10}},                            // işaret: yatay mod tiz
  Z7: {string: {dual: 0.1, dualDecay: 0.7}},                           // yatay mod daha uzun sürer: iki aşamalı sönüm
  Z8: {string: {dual: -0.1}},                                          // ters faz: nota başta zayıf, sonra açılır
  P5: {amps: {crunch: {bias: 0}, lead: {bias: 0}}},                    // simetrik kırpma
  N:  {string: {exciter: "noise"}},                                    // eski gürültü vuruşu (karşılaştırma)
};
const names = [...new Set(process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(V))];
const SEEDS = [...new Set((process.env.SEEDS || "1").split(",").map(Number))], JOBS = Math.max(1, Math.min(parseInt(process.env.JOBS) || 1, names.length));
const unknown = names.filter(n => !V[n]);
if (unknown.length){ console.error("bilinmeyen varyant: " + unknown.join(", ") + " (tools/sweep.mjs içindeki V)"); process.exit(1); }
if (!SEEDS.every(s => Number.isInteger(s) && s > 0)){ console.error("SEEDS pozitif tam sayılar olmalı (0, 1 ile aynı tohumu verir)"); process.exit(1); }
const CLIPS = [["elise", 0, 10], ["riff", 0, 10], ["tepegoz", 25, 35], ["kaf", 0, 10]];
const GOOD = ["Electric guitar", "Guitar", "Distortion"]; const SKIP = ["_centroid"], BAD = ["Alarm", "Telephone", "Ringtone", "Zither", "Bell", "Cowbell", "Bagpipes", "Synthesizer", "Keyboard (musical)", "Siren",
  "Vehicle horn, car horn, honking", "Air horn, truck horn", "Foghorn"];   // kornalar: büyük akort farkı lead tonu korna gibi okutuyor
const net = cl => GOOD.reduce((a, k) => a + (cl[k] || 0), 0) - BAD.reduce((a, k) => a + (cl[k] || 0), 0);
async function run(h, name){
  await h.fresh();
  const r = await h.page.evaluate(async ([over, CLIPS, SEEDS]) => {
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
    for (const s of SEEDS) for (const [id, t0, t1] of CLIPS){
      const song = findSong(id), off = new OfflineAudioContext(2, Math.ceil(SR * t1), SR); seed(s);
      const eng = createEngine(off, {amp: song.amp, room: 1.3, volume: 0.75}); const inst = createInstruments(eng);
      schedule(song, {engine: eng, inst});
      const buf = await off.startRendering(), n = (t1 - t0) * SR, cut = off.createBuffer(2, n, SR);
      for (let c = 0; c < 2; c++) cut.getChannelData(c).set(buf.getChannelData(c).subarray(t0 * SR, t0 * SR + n));
      let pk = 0; for (let c = 0; c < 2; c++){ const d = cut.getChannelData(c); for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); }
      out[`${id}-${s}`] = encodeWav(cut, pk > 0 ? 0.89 / pk : 1);
    }
    return out;
  }, [V[name], CLIPS, SEEDS]);
  const files = new Map();   // dosya → {id, s}
  for (const [k, wav] of Object.entries(r)){ const [id, s] = k.split("-"), f = path.join(OUT, `${id}-${name}-s${s}.wav`); fs.writeFileSync(f, Buffer.from(wav, "base64")); files.set(f, {id, s}); }
  const sc = JSON.parse((await promisify(execFile)(PY, [path.join(EAR, "score_json.py"), ...files.keys()], {maxBuffer: 1 << 26})).stdout), avg = {}, bySeed = {}; // {dosya: {sınıf: p}} → şarkı başına tohum ortalaması
  for (const [f, cl] of Object.entries(sc)){
    const {id, s} = files.get(f), a = avg[id] ??= {};
    for (const k in cl) a[k] = (a[k] || 0) + cl[k] / SEEDS.length;
    bySeed[s] = (bySeed[s] || 0) + net(cl);
  }
  let total = 0; const per = {};
  for (const [id, cl] of Object.entries(avg)){
    per[id] = {c: cl["_centroid"] || 0, eg: cl["Electric guitar"] || 0, g: cl["Guitar"] || 0, d: cl["Distortion"] || 0, bad: net(cl) - GOOD.reduce((a, k) => a + (cl[k] || 0), 0), top: Object.entries(cl).filter(([k]) => !SKIP.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}`).join(", ")};
    total += net(cl);
  }
  const seeds = SEEDS.map(s => bySeed[s]), sd = Math.sqrt(seeds.reduce((a, x) => a + (x - total) ** 2, 0) / seeds.length);
  console.log(`${name.padEnd(3)} toplam ${(total * 100).toFixed(0).padStart(4)}` + (seeds.length > 1 ? ` ±${(sd * 100).toFixed(0)} (tohumlar ${seeds.map(x => (x * 100).toFixed(0)).join("/")})` : "") + "  " + Object.entries(per).map(([id, p]) => `${id}: EG ${(p.eg * 100).toFixed(0)} G ${(p.g * 100).toFixed(0)} D ${(p.d * 100).toFixed(0)} kötü ${(-p.bad * 100).toFixed(0)} merkez ${p.c.toFixed(0)} [${p.top}]`).join(" | "));
  return {name, total, per, bySeed};
}
const queue = [...names], rows = [];
await Promise.all(Array.from({length: JOBS}, async () => {
  const h = await openHarness();
  while (queue.length) rows.push(await run(h, queue.shift()));
  await h.close();
}));
// Eşleştirilmiş fark: ilk varyanta göre aynı tohumlardaki puan farkı. Tohumlar arası yayılma büyük olduğu için anlamlı karşılaştırma budur.
const ref = rows.find(r => r.name === names[0]);
if (rows.length > 1 && SEEDS.length > 1) for (const n of names.slice(1)){
  const r = rows.find(x => x.name === n), d = SEEDS.map(s => r.bySeed[s] - ref.bySeed[s]);
  console.log(`${n} − ${ref.name}: ${(d.reduce((a, x) => a + x, 0) / d.length * 100).toFixed(0)} (tohumlarda ${d.map(x => (x * 100).toFixed(0)).join("/")}, ${d.filter(x => x > 0).length}/${d.length} iyi)`);
}
rows.sort((a, b) => b.total - a.total);
console.log("\nSIRALAMA: " + rows.map(r => `${r.name} ${(r.total * 100).toFixed(0)}`).join("  "));
