// Kalıcı ölçüm aracı: çalış senkronu (eller ↔ gitar), görüntü saflığı, determinizm ve isteğe bağlı ses özeti. JSON + okunur özet.
//   SONG=dagkrali node tools/sync-check.mjs                  # bütün şarkıda el ölçümü + T karelerinde görüntü ve determinizm
//   T="10.2,72.4,theater@45,summit/stage@30" ENV=club CAM=director SEED=1 FPS=30  # kareler ("mekan/kamera@T" de olur)
//   T0=20 T1=40 ...                                          # el ölçümü yalnız bu aralıkta
//   OUT=out/tur1/taban.json BASE=out/tur1/taban.json         # JSON yolu; BASE verilirse fark tablosu da basılır
//   AUDIO=1 ...                                              # ham ses tamponu: özet, saniyelik RMS ve <OUT>.ses.f32 (ses değişti mi?)
//   KARE=out/tur1/kare ...                                   # her T'nin temiz yayın karesini PNG olarak da yaz
//   SKIP=el,goruntu,determinizm                              # bölüm atla
//   node tools/sync-check.mjs --fark a.json b.json           # tarayıcısız: iki ölçümü karşılaştır
//   node tools/sync-check.mjs --wav a.wav b.wav              # tarayıcısız: iki WAV'ı örnek örnek karşılaştır
//   node tools/sync-check.mjs --ham a.ses.f32 b.ses.f32      # tarayıcısız: AUDIO=1'in yazdığı iki ham ses tamponunu karşılaştır
// Tanımlar:
//   el ucu: el + 4.5 cm el ekseni (poseArm'ın IK hedefi). Perde eli, hatayı en küçük yapan kol eşleşmesiyle bulunur (solak/sağlak fark etmez).
//   perde hedefi: o an basılı (f>0) notalardan ele en yakını, telin HOVER (2 cm) üstü; yalnız basılı nota olan karelerde ölçülür.
//   pena hedefi: pena + gitar ekseninde (12 mm, 0, 20 mm). Erişim dışı: omuz-hedef uzaklığı > kol boyu (2·reach).
//   dirsek: omuz-dirsek-uç iç açısı (180 = dümdüz). Sıçrama: el ucunun tek karede aldığı yol.
//   pena-tel: tek nota başlangıcının ilk karesinde pena merkezinin vurulan tele uzaklığı (gitar kesitinde).
//   görüntü: yalnız 3B kare (alt bant/HUD hariç); luma ve doygunluk BT.601 tam aralık (ffmpeg signalstats ölçeği).
//   determinizm: aynı T'nin yayın karesi (PNG) ve sahne durumu temiz sayfada, geçmişli sırada ve ileriden geri atlayınca aynı mı.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ENVV = process.env, ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r3 = v => typeof v === "number" ? +v.toFixed(3) : v;
const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ---------- Tarayıcısız modlar ---------- */
function readWav(f){
  const b = fs.readFileSync(f); let o = 12, data = null;
  while (o + 8 <= b.length){ const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4); if (id === "data"){ data = b.subarray(o + 8, o + 8 + n); break; } o += 8 + n + (n & 1); }
  if (!data) throw new Error("WAV data bölümü yok: " + f);
  return new Int16Array(data.buffer, data.byteOffset, data.length >> 1);
}
const pick = (o, k) => k.split(".").reduce((x, p) => x == null ? x : x[p], o);
const KEYS = ["el.perde.hata_cm.med", "el.perde.hata_cm.p90", "el.perde.erisimDisi_yuzde", "el.pena.hata_cm.med", "el.pena.erisimDisi_yuzde",
  "el.perde.dirsek_derece.med", "el.pena.dirsek_derece.med", "el.perde.sicrama.gt5cm", "el.perde.sicrama.gt10cm", "el.perde.sicrama.max_cm",
  "el.pena.sicrama.gt5cm", "el.pena.sicrama.gt10cm", "el.penaTel_mm.med", "el.elKullanimi.ozet"];
function diffTable(a, b){
  const rows = KEYS.map(k => [k, pick(a, k), pick(b, k)]).filter(r => r[1] !== undefined || r[2] !== undefined);
  for (const g of b.goruntu || []){ const o = (a.goruntu || []).find(x => x.kare === g.kare) || {};
    for (const k of ["luma_p5", "tamBeyaz_yuzde", "doygunluk", "karanlikSeviye"]) rows.push([`goruntu ${g.kare} ${k}`, o[k], g[k]]); }
  for (const d of b.determinizm || []){ const o = (a.determinizm || []).find(x => x.kare === d.kare) || {}; rows.push([`determinizm ${d.kare}`, o.ayni, d.ayni]); }
  if (a.ses && b.ses){ const x = a.ses.saniyelikRMS, y = b.ses.saniyelikRMS; let m = x.length === y.length ? 0 : 1; x.forEach((v, i) => { m = Math.max(m, Math.abs(v - (y[i] ?? 0))); });
    rows.push(["ses saniyelik RMS en büyük fark", "", m <= SES_TOL.secRms ? `${m.toExponential(1)} (gürültü)` : `${m.toExponential(2)} FARKLI`, m > SES_TOL.secRms]); }
  const w = Math.max(...rows.map(r => r[0].length));
  return rows.map(([k, x, y, ch = JSON.stringify(x) !== JSON.stringify(y)]) => `  ${k.padEnd(w)}  ${String(r3(x)).padStart(14)} → ${String(r3(y)).padEnd(14)}${ch ? "  *" : ""}`).join("\n");
}
// Chromium OfflineAudioContext aynı kodla bile her koşuda ham tamponu biraz farklı üretir (ölçüldü: en büyük 0.0012 ≈ 38 LSB, fark RMS 1.4e-5).
// Bu yüzden ses "aynı" sayılırken bu gürültü tabanı kabul edilir; gerçek bir değişiklik (ör. fazladan rand()) bunun yüzlerce katıdır.
const SES_TOL = {max: 0.004, rms: 5e-5, secRms: 2e-3};
if (process.argv[2] === "--wav"){
  const A = readWav(process.argv[3]), B = readWav(process.argv[4]); let diff = 0, max = 0, sq = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++){ const d = Math.abs(A[i] - B[i]); if (d){ diff++; max = Math.max(max, d); sq += d * d; } }
  const rms = Math.sqrt(sq / Math.max(1, A.length)) / 32767, ayni = A.length === B.length && !diff, tol = A.length === B.length && max / 32767 <= SES_TOL.max && rms <= SES_TOL.rms;
  console.log(JSON.stringify({ornekA: A.length, ornekB: B.length, farkliOrnek: diff, enBuyukFark_LSB: max, farkRMS: rms, karar: ayni ? "birebir aynı" : tol ? "aynı (Chromium gürültü tabanı içinde)" : "FARKLI"}));
  process.exit(ayni || tol ? 0 : 1);
}
if (process.argv[2] === "--ham"){   // AUDIO=1'in yazdığı iki ham tamponu karşılaştırır; 1 LSB (16 bit) = 3.05e-5
  const [A, B] = [3, 4].map(i => { const b = fs.readFileSync(path.resolve(ROOT, process.argv[i])); return new Float32Array(b.buffer, b.byteOffset, b.length >> 2); });
  let diff = 0, max = 0, sq = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++){ const d = Math.abs(A[i] - B[i]); if (d){ diff++; max = Math.max(max, d); sq += d * d; } }
  const rms = Math.sqrt(sq / Math.max(1, A.length)), ayni = A.length === B.length && !diff, tol = A.length === B.length && max <= SES_TOL.max && rms <= SES_TOL.rms;
  console.log(JSON.stringify({ornekA: A.length, ornekB: B.length, farkliOrnek: diff, enBuyukFark: max, enBuyukFark_LSB16: +(max * 32767).toFixed(3), farkRMS: rms,
    karar: ayni ? "birebir aynı" : tol ? "aynı (Chromium gürültü tabanı içinde)" : "FARKLI"}));
  process.exit(ayni || tol ? 0 : 1);
}
if (process.argv[2] === "--fark"){
  const [a, b] = [3, 4].map(i => JSON.parse(fs.readFileSync(process.argv[i], "utf8")));
  console.log(`${process.argv[3]} → ${process.argv[4]}\n` + diffTable(a, b)); process.exit(0);
}

/* ---------- Tarayıcı ölçümleri ---------- */
const { openHarness } = await import("./browser.js");
const SONG = ENVV.SONG || "dagkrali", SEED = +(ENVV.SEED || 1), FPS = +(ENVV.FPS || 30), ENVN = ENVV.ENV || "club", CAM = ENVV.CAM || "director";
const SKIP = new Set((ENVV.SKIP || "").split(",").filter(Boolean)), HOVER = +(ENVV.HOVER || 0.02);
const OUT = path.resolve(ROOT, ENVV.OUT || `out/sync-check-${SONG}.json`);
const P = {SONG, SEED, FPS, ENVN, CAM, HOVER, T0: ENVV.T0 ? +ENVV.T0 : null, T1: ENVV.T1 ? +ENVV.T1 : null};
// Sayfada sim kurulumu (her ölçüm temiz sayfada başlar)
// len verilirse render.js'teki ses kurulumu birebir: mekan değiştirilmez (mekan reverb'ü, yani sesi değiştirir)
const MK = `(P, len) => { const off = new OfflineAudioContext(2, Math.ceil(44100 * (len || 2)), 44100);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: P.SEED});
  if (!len) sim.setEnv(P.ENVN); sim.setCamera(len ? "director" : P.CAM); const p = sim.load(window.findSong(P.SONG)); return {sim, p, off}; }`;

async function hands(h){
  await h.fresh();
  return h.page.evaluate(async ([P, MK]) => {
    const th = await import(new URL("sim/music/theory.js", location.href).href), {sim, p} = eval(MK)(P);
    sim.setCamera("stage");
    const THREE = sim.THREE, f = sim.FIG.claude, {guitar, pick} = sim.model, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const armLen = i => f.armLen || (f.reach ? 2 * f.reach : f.arms[i].up.scale.y + f.arms[i].fo.scale.y);
    const tip = i => { const H = f.hands[i]; return H.getWorldPosition(V()).add(V(0, 1, 0).applyQuaternion(H.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(0.045)); };
    const ev = p.events, lastEnd = Math.max(...ev.map(e => e.end)), t0 = P.T0 ?? p.t0, t1 = P.T1 ?? lastEnd;
    const onsets = new Map();   // tek notaların (akor değil) başlangıç karesi
    ev.forEach((e, i) => { if ((i && e.t - ev[i - 1].t < 0.04) || (i + 1 < ev.length && ev[i + 1].t - e.t < 0.04)) return;
      const k = Math.ceil(e.t * P.FPS - 1e-9); onsets.set(k, (onsets.get(k) || []).concat(e)); });
    const R = [0, 1].map(() => ({fret: [], fretOut: 0, pick: [], pickOut: 0, elbow: [], j5: 0, j10: 0, jmax: 0, jAt: 0})), pickStr = [];
    let prev = null, n = 0, nFret = 0;
    for (let k = Math.ceil(t0 * P.FPS - 1e-9); k / P.FPS <= t1; k++){
      const t = k / P.FPS; sim.update(t, t); sim.scene.updateMatrixWorld(true); n++;
      const tg = ev.filter(e => e.f > 0 && t >= e.t && t < e.end).map(e => { const x = th.fingerX(e.f); return guitar.localToWorld(V(x, th.stringY(e.s, x), th.STR_Z + P.HOVER)); });
      const pw = pick.getWorldPosition(V()).add(V(0.012, 0, 0.02).applyQuaternion(guitar.getWorldQuaternion(new THREE.Quaternion())));
      const T = [tip(0), tip(1)]; if (tg.length) nFret++;
      [0, 1].forEach(i => {
        const S = f.up.localToWorld(f.sh[i].clone()), E = f.arms[i].el.getWorldPosition(V()), r = R[i], L = armLen(i);
        if (tg.length){ let b = tg[0]; tg.forEach(g => { if (T[i].distanceTo(g) < T[i].distanceTo(b)) b = g; }); r.fret.push(T[i].distanceTo(b)); if (S.distanceTo(b) > L) r.fretOut++; }
        r.pick.push(T[i].distanceTo(pw)); if (S.distanceTo(pw) > L) r.pickOut++;
        r.elbow.push(180 - E.clone().sub(S).angleTo(T[i].clone().sub(E)) * 180 / Math.PI);
        if (prev){ const d = T[i].distanceTo(prev[i]); if (d > 0.05) r.j5++; if (d > 0.10) r.j10++; if (d > r.jmax){ r.jmax = d; r.jAt = t; } }
      });
      for (const e of onsets.get(k) || []){ const q = guitar.worldToLocal(pick.getWorldPosition(V())); pickStr.push(Math.hypot(q.y - th.stringY(e.s, q.x), q.z - th.STR_Z)); }
      prev = T;
    }
    // Perde eli: perde+pena hatası toplamını en küçük yapan eşleşme. Taraf figürün kendi ekseninde (+z'ye bakar, sağı -x).
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const fa = med(R[1].fret) + med(R[0].pick) <= med(R[0].fret) + med(R[1].pick) ? 1 : 0;
    const side = i => f.g.worldToLocal(f.up.localToWorld(f.sh[i].clone())).x < 0 ? "sağ" : "sol";
    const neck = f.g.worldToLocal(guitar.localToWorld(V(0, 0, 0))).x - f.g.worldToLocal(guitar.localToWorld(V(th.L, 0, 0))).x;
    return {n, nFret, t0, t1, fa, fretSide: side(fa), pickSide: side(1 - fa), neckToLeft: neck > 0, armLen: [armLen(0), armLen(1)], R, pickStr};
  }, [P, MK]);
}

// Bir T'yi verilen sırayla çizer: 3B kare istatistikleri, yayın karesi PNG'si ve sahne durumu
async function grab(h, T, seq, Q){
  await h.fresh();
  return h.page.evaluate(([P, MK, T, seq]) => {
    const {sim, p} = eval(MK)(P);
    seq.concat(T).forEach(t => sim.frame(t, t));
    const cv = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}), g = cv.getContext("2d");
    g.drawImage(sim.canvas, 0, 0, 1280, 720);
    const d = g.getImageData(0, 0, 1280, 720).data, hist = new Float64Array(256), lv = new Set(); let white = 0, sat = 0, sumY = 0;
    for (let i = 0; i < d.length; i += 4){
      const r = d[i], gg = d[i + 1], b = d[i + 2], y = 0.299 * r + 0.587 * gg + 0.114 * b;
      hist[Math.min(255, Math.round(y))]++; sumY += y; if (r >= 254 && gg >= 254 && b >= 254) white++;
      sat += Math.hypot(-0.168736 * r - 0.331264 * gg + 0.5 * b, 0.5 * r - 0.418688 * gg - 0.081312 * b);
      if (r <= 40) lv.add(r); if (gg <= 40) lv.add(gg); if (b <= 40) lv.add(b);
    }
    const N = d.length / 4, pct = q => { let c = 0; for (let v = 0; v < 256; v++){ c += hist[v]; if (c >= q * N) return v; } return 255; };
    sim.composite(g, 1280, 720, {broadcast: true, t: T});
    const cam = sim.camMode === "director" ? sim.director.cam : sim.camMode, C = cam === "head" ? sim.cams.head : cam === "stage" ? sim.cams.stage : sim.cams.group;
    const f = sim.FIG.claude, st = [C.position, C.quaternion, ...f.hands.map(x => x.position), f.head.getWorldPosition(new sim.THREE.Vector3()), sim.model.pick.position]
      .map(v => v.toArray().map(x => x.toFixed(6)).join(",")).join(";");
    let gl = "?"; try { const c = sim.renderer.getContext(), x = c.getExtension("WEBGL_debug_renderer_info"); gl = x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); } catch (e){}
    const sh = p.shots.find(s => T >= s.t && T < s.end);
    return {png: cv.toDataURL("image/png"), state: st, cam, shot: sh ? `${sh.cam}/${sh.kind}${sh.glide ? "+kayma" : ""}` : "-", gl,
      luma_p5: pct(0.05), luma_med: pct(0.5), luma_ort: sumY / N, tamBeyaz_yuzde: 100 * white / N, doygunluk: sat / N, karanlikSeviye: lv.size};
  }, [Q, MK, T, seq]);
}

async function audio(h){
  await h.fresh();
  return h.page.evaluate(async ([P, MK]) => {
    const {off} = eval(MK)(P, window.songLength(window.findSong(P.SONG)) + 1), buf = await off.startRendering();
    const fnv = (u, h) => { for (let i = 0; i < u.length; i++){ h ^= u[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
    const ch = [0, 1].map(c => buf.getChannelData(c)), sec = [];
    for (let s = 0; s * 44100 < buf.length; s++){ let q = 0, m = 0; ch.forEach(d => { for (let i = s * 44100; i < Math.min(d.length, (s + 1) * 44100); i++){ q += d[i] * d[i]; m++; } }); sec.push(+Math.sqrt(q / m).toFixed(7)); }
    const u = ch.map(d => new Uint32Array(d.buffer, d.byteOffset, d.length)), raw = new Uint8Array(buf.length * 8); let bin = "";
    ch.forEach((d, c) => raw.set(new Uint8Array(d.buffer, d.byteOffset, d.length * 4), c * buf.length * 4));
    for (let i = 0; i < raw.length; i += 32768) bin += String.fromCharCode.apply(null, raw.subarray(i, i + 32768));
    return {ornek: buf.length, ozet: u.map(x => fnv(x, 2166136261) + fnv(x, 0x811c9dc5 ^ 0x5bd1e995)).join("-"), saniyelikRMS: sec, raw: btoa(bin)};
  }, [P, MK]);
}

const st = a => { const s = a.slice().sort((x, y) => x - y), q = k => s.length ? s[Math.min(s.length - 1, Math.floor(k * s.length))] : null;
  return {n: s.length, min: s[0] ?? null, p10: q(0.1), med: q(0.5), p90: q(0.9), max: s.length ? s[s.length - 1] : null}; };
const bins = a => { const B = [[0, 60], [60, 90], [90, 120], [120, 150], [150, 170], [170, 181]], o = {};
  B.forEach(([x, y]) => { o[`${x}-${y === 181 ? 180 : y}`] = +(100 * a.filter(v => v >= x && v < y).length / Math.max(1, a.length)).toFixed(1); }); return o; };
const cm = a => a.map(x => x * 100);
function handReport(m){
  const arm = i => { const r = m.R[i], isF = i === m.fa;
    return {kol: i, taraf: isF ? m.fretSide : m.pickSide, hata_cm: st(cm(isF ? r.fret : r.pick)),
      erisimDisi_yuzde: +(100 * (isF ? r.fretOut / Math.max(1, m.nFret) : r.pickOut / m.n)).toFixed(2),
      dirsek_derece: st(r.elbow), dirsekDagilim_yuzde: bins(r.elbow), sicrama: {gt5cm: r.j5, gt10cm: r.j10, max_cm: r.jmax * 100, maxAt_sn: r.jAt}}; };
  const sag = m.pickSide === "sağ" && m.fretSide === "sol" && m.neckToLeft;
  return {kare: m.n, basiliNotaKare: m.nFret, aralik_sn: [m.t0, m.t1], kolBoyu_m: m.armLen,
    elKullanimi: {perdeEli: m.fretSide, penaEli: m.pickSide, sapYonu: m.neckToLeft ? "oyuncunun solu" : "oyuncunun sağı", ozet: sag ? "sağ elle çalıyor" : "solak (sağ el perdede)"},
    perde: arm(m.fa), pena: arm(1 - m.fa), penaTel_mm: st(m.pickStr.map(x => x * 1000))};
}

// Kare listesi: "72.4" ya da "mekan/kamera@T" (ör. "theater@45", "summit/stage@30"); boş kısım ENV/CAM'dan gelir
const Tdef = (ENVV.T || "10.2,16.65,72.4").split(",").map(x => { const m = /^(?:([a-z]+))?(?:\/([a-z]+))?@?([\d.]+)$/.exec(x.trim());
  if (!m) throw new Error("T öğesi anlaşılmadı: " + x); return {kare: x.trim(), T: +m[3], env: m[1] || ENVN, cam: m[2] || CAM}; });
const h = await openHarness();
const res = {meta: {SONG, SEED, FPS, ENV: ENVN, CAM, HOVER, tarih: new Date().toISOString(), commit: (() => { try { return execSync("git rev-parse --short HEAD", {cwd: ROOT}).toString().trim(); } catch { return "?"; } })()}};
try {
  if (!SKIP.has("el")) res.el = handReport(await hands(h));
  if (!SKIP.has("goruntu") || !SKIP.has("determinizm")){
    res.goruntu = []; res.determinizm = [];
    for (const {kare, T, env, cam} of Tdef){
      const Q = {...P, ENVN: env, CAM: cam};
      const seqs = {temiz: [], gecmisli: [Math.max(0, T - 10), Math.max(0, T - 0.65), Math.max(0, T - 0.35), T + 0.35], ileriden: [T + 12]};
      const out = {};
      for (const [k, s] of Object.entries(seqs)){ if (k !== "temiz" && SKIP.has("determinizm")) continue; out[k] = await grab(h, T, s, Q); }
      const c = out.temiz; res.meta.gl = c.gl;
      res.goruntu.push({kare, T, env, cam: c.cam, shot: c.shot, ...Object.fromEntries(["luma_p5", "luma_med", "luma_ort", "tamBeyaz_yuzde", "doygunluk", "karanlikSeviye"].map(k => [k, r3(c[k])]))});
      if (ENVV.KARE) fs.writeFileSync(path.resolve(ROOT, `${ENVV.KARE}-${kare.replace(/[@/]/g, "-")}.png`), Buffer.from(c.png.split(",")[1], "base64"));
      if (!SKIP.has("determinizm")){
        const k = Object.fromEntries(Object.entries(out).map(([n, o]) => [n, {kare: sha(o.png), durum: sha(o.state)}]));
        res.determinizm.push({kare, T, ...k, ayni: Object.values(k).every(x => x.kare === k.temiz.kare && x.durum === k.temiz.durum)});
      }
    }
  }
  if (ENVV.AUDIO){ const a = await audio(h), f = OUT.replace(/\.json$/, "") + ".ses.f32";   // ham tampon: önce L sonra R, float32
    fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, Buffer.from(a.raw, "base64")); delete a.raw; res.ses = {...a, ham: path.relative(ROOT, f)}; }
} finally { await h.close(); }

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(res, function(k, v){ return this === (res.ses && res.ses.saniyelikRMS) ? v : r3(v); }, 1));
const e = res.el, L = [];
L.push(`sync-check ${SONG} (tohum ${SEED}, ${FPS} fps, ${ENVN}/${CAM}, ${res.meta.commit}) → ${OUT}`);
if (e){
  L.push(`  El kullanımı: perde ${e.elKullanimi.perdeEli}, pena ${e.elKullanimi.penaEli}, sap ${e.elKullanimi.sapYonu} → ${e.elKullanimi.ozet}`);
  for (const [n, a] of [["Perde eli", e.perde], ["Pena eli ", e.pena]])
    L.push(`  ${n} (kol ${a.kol}, ${a.taraf}): hata med ${r3(a.hata_cm.med)} / p90 ${r3(a.hata_cm.p90)} / max ${r3(a.hata_cm.max)} cm, erişim dışı %${a.erisimDisi_yuzde}, dirsek med ${r3(a.dirsek_derece.med)}° ` +
      `[${Object.entries(a.dirsekDagilim_yuzde).map(([k, v]) => `${k}:${v}`).join(" ")}], sıçrama >5cm ${a.sicrama.gt5cm}, >10cm ${a.sicrama.gt10cm}, en büyük ${r3(a.sicrama.max_cm)} cm @${r3(a.sicrama.maxAt_sn)} sn`);
  L.push(`  Pena-tel (tek nota başlangıcı): med ${r3(e.penaTel_mm.med)} mm, p90 ${r3(e.penaTel_mm.p90)} mm (${e.penaTel_mm.n} nota); ${e.kare} kare, ${e.basiliNotaKare} basılı notalı`);
}
for (const g of res.goruntu || []) L.push(`  Görüntü ${g.kare} (${g.env}, ${g.cam}, ${g.shot}): luma p5 ${g.luma_p5}, med ${g.luma_med}, tam beyaz %${g.tamBeyaz_yuzde}, doygunluk ${g.doygunluk}, 0-40 seviye ${g.karanlikSeviye}`);
for (const d of res.determinizm || []) L.push(`  Determinizm ${d.kare}: ${d.ayni ? "AYNI" : "FARKLI"}  ${Object.entries(d).filter(([k]) => typeof d[k] === "object").map(([k, v]) => `${k} ${v.kare}/${v.durum}`).join("  ")}`);
if (res.ses) L.push(`  Ses: ${res.ses.ornek} örnek, özet ${res.ses.ozet}`);
if (res.meta.gl) L.push(`  Çizici: ${res.meta.gl}`);
if (ENVV.BASE && fs.existsSync(path.resolve(ROOT, ENVV.BASE))) L.push(`Taban → şimdi (${ENVV.BASE}):\n` + diffTable(JSON.parse(fs.readFileSync(path.resolve(ROOT, ENVV.BASE), "utf8")), JSON.parse(fs.readFileSync(OUT, "utf8"))));
console.log(L.join("\n"));
