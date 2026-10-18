// Duman testi (npm test): her şarkı yüklenir, ilk saniyeleri sese dökülür, baştan/ortadan/sondan birer kare çizilir.
// Hata, NaN, sessizlik, kara kare, boş ya da kısa çekim listesi, sahnede olmayan üyeye çekim, bozuk ritim saati, vurgusuz şarkı ve rastgele akışın
// kayması (kurulumun rand() sayısı, karelerin rand() çekmesi) ve takılmamış karakter (Kanade, VRM; KARAKTER=manken yedek gövdede aranmaz) arar; oda
// mekânında bir şarkı (dokular, kareler, flaş, kamera sınırı); sonra önizleme sayfasını açıp çal/durdur dener.
// Önce tarayıcısız: bükme ve vibrato eğrisinin ses ile görselde aynı olduğu.
//   SECS=10 SEED=1 node tools/check.js
import { openHarness } from "./browser.js";
import { SONGS } from "../src/sim/band/songs/index.js";
import { createInstruments } from "../src/sim/audio/instruments.js";
import { schedule } from "../src/sim/audio/playback.js";
import { curveOf } from "../src/sim/music/bend.js";
import { seed } from "../src/sim/rng.js";

const SEED = +(process.env.SEED || 1), SECS = +(process.env.SECS || 10), KANADE = process.env.KARAKTER !== "manken";
// createSim'in çektiği rand() sayısı (tohum başına; kalabalık, kıvılcımlar, figür, göz kırpma takvimi). Karakter ya da sahne değişse de aynı kalmalı:
// fazladan bir rand() bütün ses programını kaydırır. Kareler hiç çekmez (sahnede çeşitlilik hash01 ile).
const KURULUM_RAND = {1: 7468};
let fail = 0;
const row = (ok, text) => { console.log((ok ? "  ✓ " : "  ✗ ") + text); if (!ok) fail++; };

// Sahte ses grafiği gerçek expressNote'un playbackRate otomasyonunu ve vibrato LFO'sunu (frekans, derinlik zarfı, başlat/durdur) nota başına
// kaydeder; görselin olaydan kurduğu eğriyle (music/bend.js curveOf) birebir karşılaştırılır. Tel tamponu üretilmez.
console.log("Bükme ve vibrato (ses ↔ görsel tek eğri):");
for (const song of SONGS){
  seed(SEED); const got = []; let cur = null;
  const P = rec => ({value: 1, setValueAtTime(v, t){ if (rec) rec([0, v, t]); }, linearRampToValueAtTime(v, t){ if (rec) rec([1, v, t]); }, setTargetAtTime(){}, exponentialRampToValueAtTime(){}});
  const N = () => ({connect(){}, start(){}, stop(){}, gain: P(), Q: P(), frequency: P(), playbackRate: P()});
  const ctx = {sampleRate: 44100, currentTime: 0, createBiquadFilter: N,
    createBufferSource(){ const n = N(); n.playbackRate = P(x => { if (cur) cur.rate.push(x); }); return n; },
    createOscillator(){ const o = cur.osc = {dep: []}, n = N(); n.frequency = {set value(x){ o.hz = x; }}; n.start = t => { o.t0 = t; }; n.stop = t => { o.stop = t; }; return n; },
    createGain(){ const n = N(); if (cur && cur.osc && !cur.dep){ cur.dep = true; n.gain = P(x => cur.osc.dep.push(x)); } return n; }};
  const engine = {ctx, chainIn: N(), chainIn2: N(), ampName: song.amp || "crunch", noiseSrc: N}, inst = createInstruments(engine), real = inst.expressNote;
  inst.ksBuffer = () => null;
  inst.expressNote = (...a) => { got.push(cur = {rate: [], osc: null, dep: false}); real(...a); cur = null; };
  const p = schedule(song, {engine, inst});
  let ok = got.length === p.events.length, nb = 0, nv = 0;
  p.events.forEach((e, i) => { const c = curveOf(e), g = got[i] || {rate: []}, V = c.vib, o = g.osc;
    if (c.rate.length) nb++; if (V) nv++;
    if (JSON.stringify(g.rate) !== JSON.stringify(c.rate)) ok = false;
    if (!!V !== !!o || (V && (o.hz !== V.hz || o.t0 !== V.t0 || o.stop !== V.stop || JSON.stringify(o.dep) !== JSON.stringify([[0, 0, V.t0], [0, 0, V.a], [1, V.depth, V.b]])))) ok = false; });
  row(ok, `${song.id.padEnd(9)} ${String(p.events.length).padStart(4)} nota, ${String(nb).padStart(3)} otomasyonlu, ${String(nv).padStart(3)} vibratolu`);
}

const h = await openHarness();
const ids = await h.page.evaluate(() => window.SONG_IDS);

console.log("Şarkılar (tohum " + SEED + "):");
for (const id of ids){
  const errs = []; const onErr = e => errs.push(e.message); h.page.on("pageerror", onErr);
  const r = await h.page.evaluate(async ([id, SEED, SECS]) => {
    const SR = 44100, song = window.findSong(id), full = window.songLength(song), dur = Math.min(full, SECS);
    const off = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    // rand() sayısı iki durum arası: mulberry32 her çağrıda durumu INC kadar ilerletir, fark INC'in tersiyle (mod 2^32) çarpılır
    const rng = await import(new URL("sim/rng.js", location.href).href), INC = 0x6D2B79F5, s0 = (SEED >>> 0) || 1;
    let inv = INC; for (let i = 0; i < 5; i++) inv = Math.imul(inv, 2 - Math.imul(INC, inv));
    const nRand = (a, b) => Math.imul((b - a) | 0, inv) >>> 0;
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED}), s1 = rng.getState();
    sim.setCamera("director"); sim.load(song); const s2 = rng.getState();
    // Ritim saati ve müzik özeti (music/clock.js): vuruş konumu artan, yoğunluk 0..1, en az bir vurgu
    const C = await import(new URL("sim/music/clock.js", location.href).href), p = sim.playing;
    let mono = true, prev = -Infinity; for (let k = 0; k <= 200; k++){ const b = C.beatAt(p, p.t0 + k / 200 * (p.end - p.t0)); if (!(b > prev)) mono = false; prev = b; }
    const nAcc = C.accents(p).length, clockOk = mono && [0.5, full / 2].every(t => { const x = C.intensity(p, t); return x >= 0 && x <= 1; }) && isFinite(C.accentAt(p, full / 2));
    const shots = sim.playing.shots, cv = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}), g = cv.getContext("2d"), lum = [], cams = new Set();
    for (const t of [0.5, full / 2, full - 0.3]){
      sim.frame(t, t); sim.composite(g, 1280, 720); cams.add(sim.director.cam);
      const d = g.getImageData(0, 0, 1280, 720).data; let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 101){ s += d[i] + d[i + 1] + d[i + 2]; n++; }
      lum.push(s / n / 3);
    }
    const rs = [nRand(s0, s1), nRand(s1, s2), nRand(s2, rng.getState())], who = [...new Set(shots.map(s => s.who).filter(w => w !== "wide" && !sim.FIG[w]))];
    const buf = await off.startRendering(), L = buf.getChannelData(0); let pk = 0, nan = 0, sq = 0;
    for (let i = 0; i < L.length; i++){ if (!isFinite(L[i])) nan++; pk = Math.max(pk, Math.abs(L[i])); sq += L[i] * L[i]; }
    const f = sim.FIG.claude, kanade = !!(f.vrm && f.vrm.root.parent && sim.ready);
    return {name: song.name, full, shots: shots.length, lastEnd: shots.length ? shots[shots.length - 1].end : 0, kinds: [...new Set(shots.map(s => s.cam))].join(","), lum, pk, nan, rms: Math.sqrt(sq / L.length), audioCams: [...cams].join(","), nAcc, clockOk, rs, who, kanade};
  }, [id, SEED, SECS]).catch(e => ({error: e.message}));
  h.page.off("pageerror", onErr);
  const probs = [];
  if (r.error) probs.push("hata: " + r.error);
  if (errs.length) probs.push("sayfa hatası: " + errs.join(" | "));
  if (!r.error){
    if (r.nan) probs.push("NaN örnek: " + r.nan);
    if (r.pk < 0.05) probs.push("ses yok (tepe " + r.pk.toFixed(3) + ")");
    if (r.rms < 0.01) probs.push("ses çok düşük (rms " + r.rms.toFixed(4) + ")");
    if (r.lum.some(l => l < 6)) probs.push("kara kare (parlaklık " + r.lum.map(x => x.toFixed(0)).join("/") + ")");
    if (!r.shots) probs.push("çekim listesi boş");
    if (r.lastEnd < r.full - 0.01) probs.push("çekim listesi şarkıdan kısa");
    if (!r.nAcc) probs.push("vurgu yok");
    if (!r.clockOk) probs.push("ritim saati ya da yoğunluk bozuk");
    if (r.who.length) probs.push("çekimin üyesi sahnede yok (sessizce geniş plana düşer): " + r.who.join(","));
    if (r.rs[2]) probs.push("kareler " + r.rs[2] + " rand() çekti");
    if (KURULUM_RAND[SEED] !== undefined && r.rs[0] !== KURULUM_RAND[SEED]) probs.push(`kurulum ${r.rs[0]} rand() çekti, beklenen ${KURULUM_RAND[SEED]} (ses programı kayar)`);
    if (KANADE && !r.kanade) probs.push("Kanade takılı değil");
  }
  row(!probs.length, r.error ? id + ": " + probs.join("; ") :
    `${r.name.padEnd(22)} ${r.full.toFixed(1).padStart(5)} sn  ${String(r.shots).padStart(3)} çekim [${r.kinds}]  tepe ${r.pk.toFixed(2)} rms ${r.rms.toFixed(3)}  parlaklık ${r.lum.map(x => x.toFixed(0)).join("/")}  vurgu ${r.nAcc}  rand ${r.rs.join("/")}` + (probs.length ? "  ← " + probs.join("; ") : ""));
  await h.fresh();
}

// Flaş güvenliği: tam ekran flaş (rigs.flash) bütün şarkı boyunca 30 fps'te örneklenir; herhangi bir 1 sn pencerede 3'ten fazla parlama
// olmamalı (ışığa duyarlı epilepsi sınırı, ITU-R BT.1702 / Harding). Tepe: >= 0.2, öncesinde tepenin yarısının altına inilmiş.
console.log("Flaş güvenliği (1 sn'de en çok 3):");
for (const id of ids){
  const r = await h.page.evaluate(id => {
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 44100 * 2, 44100), manual: true, seed: 1});
    sim.setCamera("director"); const p = sim.load(window.findSong(id)), F = [], T = [];
    for (let k = Math.ceil(p.t0 * 30); k / 30 < p.end; k++){ const t = k / 30; sim.update(t, t); F.push(sim.rigs.flash); T.push(t); }
    const pk = []; let lo = 1;
    for (let i = 1; i < F.length - 1; i++){ lo = Math.min(lo, F[i]); if (F[i] >= 0.2 && F[i] >= F[i - 1] && F[i] > F[i + 1] && lo < 0.5 * F[i]){ pk.push(T[i]); lo = 1; } }
    let w = 0; for (let i = 0, j = 0; i < pk.length; i++){ while (pk[i] - pk[j] >= 1) j++; w = Math.max(w, i - j + 1); }
    return {n: pk.length, w};
  }, id).catch(e => ({error: e.message}));
  row(!r.error && r.w <= 3, r.error ? id + ": " + r.error : `${id.padEnd(9)} ${String(r.n).padStart(3)} flaş, 1 sn'de en çok ${r.w}`);
  await h.fresh();
}

// Oda mekânı (kısa): kanvas dokuları yazı tipiyle çizildi, üç kare (NaN yok, kara değil), bütün şarkıda flaş yok ve yönetmenin kamerası odanın içinde
console.log("Oda mekânı:");
{
  const errs = []; const onErr = e => errs.push(e.message); h.page.on("pageerror", onErr);
  const r = await h.page.evaluate(async () => {
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 44100 * 2, 44100), manual: true, seed: 1});
    sim.setEnv("oda"); sim.setCamera("director"); const p = sim.load(window.findSong("kaf")); await sim.whenReady();
    const R = sim.oda, cam = () => { const c = sim.director.cam; return c === "head" ? sim.cams.head : c === "stage" ? sim.cams.stage : sim.cams.group; };
    const cv = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}), g = cv.getContext("2d"), lum = [];
    for (const t of [p.t0 + 0.5, (p.t0 + p.end) / 2, p.end - 0.3]){
      sim.frame(t, t); g.drawImage(sim.canvas, 0, 0, 1280, 720); const d = g.getImageData(0, 0, 1280, 720).data; let s = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 101){ s += d[i] + d[i + 1] + d[i + 2]; n++; } lum.push(s / n / 3);
    }
    let n = 0, out = 0, fl = 0, nan = 0;
    for (let k = Math.ceil(p.t0 * 30); k / 30 < sim.videoEnd(); k++){ const t = k / 30; sim.update(t, t); const c = cam().position; n++;
      if (!R.inside(c)) out++; if (sim.rigs.flash > 0.001) fl++; if (![...c.toArray(), ...sim.FIG.claude.head.getWorldPosition(new sim.THREE.Vector3()).toArray()].every(Number.isFinite)) nan++; }
    const tex = R.textures.every(t => !t.canvasJob.fonts || t.canvasJob.withFonts);
    return {lum, n, out, fl, nan, tex: tex && sim.texReady, nTex: R.textures.length};
  }).catch(e => ({error: e.message}));
  h.page.off("pageerror", onErr);
  const probs = [];
  if (r.error) probs.push("hata: " + r.error);
  if (errs.length) probs.push("sayfa hatası: " + errs.join(" | "));
  if (!r.error){
    if (r.lum.some(l => l < 6)) probs.push("kara kare");
    if (r.nan) probs.push("NaN kare: " + r.nan);
    if (r.fl) probs.push("flaş: " + r.fl + " kare");
    if (r.out) probs.push("kamera odanın dışında: " + r.out + " kare");
    if (!r.tex) probs.push("doku yazı tipi beklemeden çizildi");
  }
  row(!probs.length, r.error ? "oda: " + probs.join("; ") : `kaf odada: ${r.n} kare, kamera dışarıda ${r.out}, flaş ${r.fl}, ${r.nTex} doku yazı tipiyle ${r.tex ? "evet" : "hayır"}, parlaklık ${r.lum.map(x => x.toFixed(0)).join("/")}` + (probs.length ? "  ← " + probs.join("; ") : ""));
  await h.fresh();
}

console.log("Önizleme sayfası:");
{
  const page = await h.browser.newPage({viewport: {width: 1280, height: 1000}});
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  try {
    await page.goto(h.url + "/index.html", {waitUntil: "domcontentloaded"});
    await page.waitForFunction(() => !!window.sim, null, {timeout: 30000});
    await page.click("#song-kaf"); await page.click("#play"); await page.waitForTimeout(1500);
    const s1 = await page.evaluate(() => ({playing: !!window.sim.playing, now: window.sim.audio.ctx.currentTime, hud: document.getElementById("hudText").textContent}));
    await page.click("#cam-head"); await page.click("#env-summit"); await page.waitForTimeout(600);
    await page.click("#stop"); await page.waitForTimeout(200);
    const s2 = await page.evaluate(() => ({playing: !!window.sim.playing, cam: window.sim.camMode, env: window.sim.envName}));
    row(s1.playing && s1.now > 0.5, "çal: " + s1.hud + " (ses saati " + s1.now.toFixed(2) + " sn)");
    row(!s2.playing && s2.cam === "head" && s2.env === "summit", "kamera/mekan değiştir ve durdur: " + JSON.stringify(s2));
    await page.click("#env-oda"); await page.waitForTimeout(400);
    const s3 = await page.evaluate(() => ({env: window.sim.envName, doku: window.sim.texReady, karakter: window.sim.karakter, takili: !!window.sim.FIG.claude.vrm}));
    row(s3.env === "oda" && s3.doku && s3.karakter === "kanade" && s3.takili, "oda mekânı: " + JSON.stringify(s3));
  } catch (e){ row(false, "önizleme: " + e.message); }
  row(!errs.length, errs.length ? "sayfa hataları: " + errs.join(" | ") : "sayfa hatası yok");
  await page.close();
}
await h.close();
console.log(fail ? `\n${fail} sorun` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
