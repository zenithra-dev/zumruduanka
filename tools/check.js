// Duman testi (npm test): her şarkı yüklenir, ilk saniyeleri sese dökülür, baştan/ortadan/sondan birer kare çizilir.
// Hata, NaN, sessizlik, kara kare, boş ya da kısa çekim listesi, bozuk ritim saati ve vurgusuz şarkı arar; sonra önizleme sayfasını açıp çal/durdur dener.
//   SECS=10 SEED=1 node tools/check.js
import { openHarness } from "./browser.js";

const SEED = +(process.env.SEED || 1), SECS = +(process.env.SECS || 10);
const h = await openHarness();
const ids = await h.page.evaluate(() => window.SONG_IDS);
let fail = 0;
const row = (ok, text) => { console.log((ok ? "  ✓ " : "  ✗ ") + text); if (!ok) fail++; };

console.log("Şarkılar (tohum " + SEED + "):");
for (const id of ids){
  const errs = []; const onErr = e => errs.push(e.message); h.page.on("pageerror", onErr);
  const r = await h.page.evaluate(async ([id, SEED, SECS]) => {
    const SR = 44100, song = window.findSong(id), full = window.songLength(song), dur = Math.min(full, SECS);
    const off = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED});
    sim.setCamera("director"); sim.load(song);
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
    const buf = await off.startRendering(), L = buf.getChannelData(0); let pk = 0, nan = 0, sq = 0;
    for (let i = 0; i < L.length; i++){ if (!isFinite(L[i])) nan++; pk = Math.max(pk, Math.abs(L[i])); sq += L[i] * L[i]; }
    return {name: song.name, full, shots: shots.length, lastEnd: shots.length ? shots[shots.length - 1].end : 0, kinds: [...new Set(shots.map(s => s.cam))].join(","), lum, pk, nan, rms: Math.sqrt(sq / L.length), audioCams: [...cams].join(","), nAcc, clockOk};
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
  }
  row(!probs.length, r.error ? id + ": " + probs.join("; ") :
    `${r.name.padEnd(22)} ${r.full.toFixed(1).padStart(5)} sn  ${String(r.shots).padStart(3)} çekim [${r.kinds}]  tepe ${r.pk.toFixed(2)} rms ${r.rms.toFixed(3)}  parlaklık ${r.lum.map(x => x.toFixed(0)).join("/")}  vurgu ${r.nAcc}` + (probs.length ? "  ← " + probs.join("; ") : ""));
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
  } catch (e){ row(false, "önizleme: " + e.message); }
  row(!errs.length, errs.length ? "sayfa hataları: " + errs.join(" | ") : "sayfa hatası yok");
  await page.close();
}
await h.close();
console.log(fail ? `\n${fail} sorun` : "\nHepsi geçti");
process.exit(fail ? 1 : 0);
