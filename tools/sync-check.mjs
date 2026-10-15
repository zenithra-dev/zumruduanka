// Kalıcı ölçüm aracı: çalış senkronu (eller ↔ gitar), görüntü saflığı, determinizm ve isteğe bağlı ses özeti. JSON + okunur özet.
//   SONG=dagkrali node tools/sync-check.mjs                  # bütün şarkıda el ölçümü + T karelerinde görüntü ve determinizm
//   T="10.2,72.4,theater@45,summit/stage@30" ENV=club CAM=director SEED=1 FPS=30  # kareler ("mekan/kamera@T" de olur)
//   T0=20 T1=40 ...                                          # el ölçümü yalnız bu aralıkta
//   OUT=out/tur1/taban.json BASE=out/tur1/taban.json         # JSON yolu; BASE verilirse fark tablosu da basılır
//   AUDIO=1 ...                                              # ham ses tamponu: özet, saniyelik RMS ve <OUT>.ses.f32 (ses değişti mi?)
//   KARE=out/tur1/kare ...                                   # her T'nin temiz yayın karesini PNG olarak da yaz
//   BOLUM="sinsi:b0-b32,doruk:69.8-76.4"                     # ritim bölümleri, sn ya da bN (N. vuruşun anı); dagkrali'nin varsayılanı var
//   KADRAJ=doruk ...                                         # kadraj ölçümünün bölümü (varsayılan: "doruk" bölümü varsa o)
//   SARKILAR=kaf,dagkrali ...                                # vurgu ve ses programı ölçülen şarkılar (varsayılan hepsi)
//   SRC=yol/src ...                                          # başka bir kaynak ağacını ölç (ör. eski sürümle ses programı karşılaştırması)
//   SKIP=el,goruntu,determinizm,muzik,kadraj                 # bölüm atla
//   node tools/sync-check.mjs --fark a.json b.json           # tarayıcısız: iki ölçümü karşılaştır
//   node tools/sync-check.mjs --wav a.wav b.wav              # tarayıcısız: iki WAV'ı örnek örnek karşılaştır
//   node tools/sync-check.mjs --ham a.ses.f32 b.ses.f32      # tarayıcısız: AUDIO=1'in yazdığı iki ham ses tamponunu karşılaştır
// Tanımlar:
//   el ucu: el + 4.5 cm el ekseni (poseArm'ın IK hedefi). Perde eli, hatayı en küçük yapan kol eşleşmesiyle bulunur (solak/sağlak fark etmez).
//   perde hedefi: o an basılı (f>0) notalardan ele en yakını, telin HOVER (2 cm) üstü; yalnız basılı nota olan karelerde ölçülür.
//   pena hedefi: pena + gitar ekseninde (12 mm, 0, 20 mm). Erişim dışı: omuz-hedef uzaklığı > kol boyu (2·reach).
//   dirsek: omuz-dirsek-uç iç açısı (180 = dümdüz). Sıçrama: el ucunun tek karede aldığı yol.
//   pena-tel: tek nota başlangıcının ilk karesinde pena ucunun (pena modelinin sivri köşesi) vurulan tele uzaklığı (gitar kesitinde);
//     penaTelMerkez_mm aynısı pena merkezinden (tur 1'in tanımı).
//   görüntü: yalnız 3B kare (alt bant/HUD hariç); luma ve doygunluk BT.601 tam aralık (ffmpeg signalstats ölçeği).
//   determinizm: aynı T'nin yayın karesi (PNG) ve sahne durumu temiz sayfada, geçmişli sırada ve ileriden geri atlayınca aynı mı.
//   ritim (bölüm bölüm): kafa eğimi = kafanın dünyada baktığı yönün yükselme açısı (derece, + yukarı), bölümde tepeden tepeye;
//     nod_hz kafa merkezi yüksekliğinin, egim_hz eğim açısının baskın frekansı (0.5-8 Hz, doğrusal eğilim çıkarılmış, Hann pencereli DFT,
//     0.02 Hz adım); vurus_hz bölümün ortalama vuruş hızı (music/clock.js beatAt), nod bununla karşılaştırılır.
//   muzik (şarkı başına): vurgu = clock.js accents(p) sayısı ve türleri, yoğunluk = intensity(p, t) 0.1 sn adımla; kesme = yönetmenin her
//     çekim başı karesi ile en yakın nota başlangıcı karesi arasındaki fark (kare, + kesme notadan sonra; açılış çekimi ve video
//     bittikten sonra planlanmış çekimler sayılmaz);
//     ses programı = kurulumdan, yüklemeden ve üç kareden sonra rng durumu + olayların ses alanları + bitiş + akor vuruşları özeti.
//   kadraj: yönetmen kamerasında kafa merkezi kadrajda mı; sap eli (perde eli) yayın alt bandında (y > 600 px) ya da altında mı.
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
  "el.pena.sicrama.gt5cm", "el.pena.sicrama.gt10cm", "el.penaTel_mm.med", "el.penaTel_mm.p90", "el.penaTelMerkez_mm.med", "el.elKullanimi.ozet",
  "kadraj.kafa_yuzde", "kadraj.sapEliKadrajda_yuzde", "kadraj.sapEliAltBant_yuzde"];
function diffTable(a, b){
  const rows = KEYS.map(k => [k, pick(a, k), pick(b, k)]).filter(r => r[1] !== undefined || r[2] !== undefined);
  for (const s of (b.ritim && b.ritim.bolumler) || []){ const o = ((a.ritim && a.ritim.bolumler) || []).find(x => x.ad === s.ad) || {};
    for (const k of ["egim_pp_derece", "nod_hz", "egim_hz", "kafaY_pp_cm", "vurus_hz"]) rows.push([`ritim ${s.ad} ${k}`, o[k], s[k]]); }
  for (const [id, m] of Object.entries((b.muzik && b.muzik.sarkilar) || {})){ const o = (a.muzik && a.muzik.sarkilar && a.muzik.sarkilar[id]) || {};
    rows.push([`vurgu ${id}`, o.vurgu && o.vurgu.n, m.vurgu && m.vurgu.n]);
    rows.push([`kesme ${id} |kare| med / ≤1 kare %`, o.kesme && `${o.kesme.med} / ${o.kesme.le1_yuzde}`, m.kesme && `${m.kesme.med} / ${m.kesme.le1_yuzde}`]);
    if (o.ses) rows.push([`ses programı ${id}`, o.ses.ozet, m.ses.ozet, o.ses.ozet !== m.ses.ozet]); }
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

// Bölüm sınırı: sayı (sn) ya da "bN" (N. vuruşun anı; clock.js yoksa sabit tempo). Sayfada çözülür.
const clockSrc = `async () => { try { return await import(new URL("sim/music/clock.js", location.href).href); } catch (e){ return null; } }`;
async function hands(h, secs){
  await h.fresh();
  return h.page.evaluate(async ([P, MK, secs, clockSrc]) => {
    const th = await import(new URL("sim/music/theory.js", location.href).href), {sim, p} = eval(MK)(P), CL = await eval(clockSrc)();
    const tm = x => typeof x === "number" ? x : CL ? CL.timeAt(p, +x.slice(1)) : p.t0 + +x.slice(1) * 60 / p.bpm;
    const bt = t => CL ? CL.beatAt(p, t) : (t - p.t0) * p.bpm / 60;
    const bol = secs.map(s => { const a = tm(s.a), b = tm(s.b); return {ad: s.ad, a, b, vurus_hz: (bt(b) - bt(a)) / (b - a)}; });
    sim.setCamera("stage");
    const THREE = sim.THREE, f = sim.FIG.claude, {guitar, pick} = sim.model, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const armLen = i => f.armLen || (f.reach ? 2 * f.reach : f.arms[i].up.scale.y + f.arms[i].fo.scale.y);
    const tip = i => { const H = f.hands[i]; return H.getWorldPosition(V()).add(V(0, 1, 0).applyQuaternion(H.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(0.045)); };
    const ev = p.events, lastEnd = Math.max(...ev.map(e => e.end)), t0 = P.T0 ?? p.t0, t1 = P.T1 ?? lastEnd;
    const onsets = new Map();   // tek notaların (akor değil) başlangıç karesi
    ev.forEach((e, i) => { if ((i && e.t - ev[i - 1].t < 0.04) || (i + 1 < ev.length && ev[i + 1].t - e.t < 0.04)) return;
      const k = Math.ceil(e.t * P.FPS - 1e-9); onsets.set(k, (onsets.get(k) || []).concat(e)); });
    const R = [0, 1].map(() => ({fret: [], fretOut: 0, pick: [], pickOut: 0, elbow: [], j5: 0, j10: 0, jmax: 0, jAt: 0})), pickStr = [], pickMid = [];
    const k0 = Math.ceil(t0 * P.FPS - 1e-9), headY = [], headP = [], HQ = new THREE.Quaternion();
    let prev = null, n = 0, nFret = 0;
    for (let k = k0; k / P.FPS <= t1; k++){
      const t = k / P.FPS; sim.update(t, t); sim.scene.updateMatrixWorld(true); n++;
      headY.push(f.head.getWorldPosition(V()).y); headP.push(Math.asin(Math.max(-1, Math.min(1, V(0, 0, 1).applyQuaternion(f.head.getWorldQuaternion(HQ)).y))) * 180 / Math.PI);
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
      // Pena ucu: pena şeklinin sivri köşesi (guitar-model.js pickShape (0, -0.012)); merkez tur 1 tanımı
      const dStr = (e, w) => { const q = guitar.worldToLocal(w); return Math.hypot(q.y - th.stringY(e.s, q.x), q.z - th.STR_Z); };
      for (const e of onsets.get(k) || []){ pickStr.push(dStr(e, pick.localToWorld(V(0, -0.012, 0)))); pickMid.push(dStr(e, pick.getWorldPosition(V()))); }
      prev = T;
    }
    // Perde eli: perde+pena hatası toplamını en küçük yapan eşleşme. Taraf figürün kendi ekseninde (+z'ye bakar, sağı -x).
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const fa = med(R[1].fret) + med(R[0].pick) <= med(R[0].fret) + med(R[1].pick) ? 1 : 0;
    const side = i => f.g.worldToLocal(f.up.localToWorld(f.sh[i].clone())).x < 0 ? "sağ" : "sol";
    const neck = f.g.worldToLocal(guitar.localToWorld(V(0, 0, 0))).x - f.g.worldToLocal(guitar.localToWorld(V(th.L, 0, 0))).x;
    return {n, nFret, t0, t1, fa, fretSide: side(fa), pickSide: side(1 - fa), neckToLeft: neck > 0, armLen: [armLen(0), armLen(1)], R, pickStr, pickMid, k0, headY, headP, bol};
  }, [P, MK, secs, clockSrc]);
}
// Baskın frekans (Hz): doğrusal eğilim çıkarılır, Hann penceresi, lo..hi arasında step adımla DFT genliğinin tepesi
function domHz(x, fps, lo = 0.5, hi = 8, step = 0.02){
  const n = x.length; if (n < fps * 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0; x.forEach((v, i) => { sx += i; sy += v; sxx += i * i; sxy += i * v; });
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n, d = x.map((v, i) => (v - a - b * i) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))));
  let best = -1, bf = null;
  for (let j = 0, f = lo; f <= hi + 1e-9; f = +(lo + ++j * step).toFixed(6)){ let re = 0, im = 0; const w = 2 * Math.PI * f / fps;
    for (let i = 0; i < n; i++){ re += d[i] * Math.cos(w * i); im += d[i] * Math.sin(w * i); }
    if (re * re + im * im > best){ best = re * re + im * im; bf = f; } }
  return bf;
}
// Ritim raporu: her bölümde (ölçülen aralıkla kesişen kısmında) kafa eğimi ve nod
function rhythmReport(m){
  const span = (a, b) => { const i0 = Math.max(0, Math.ceil(a * FPS - 1e-9) - m.k0), i1 = Math.min(m.headY.length, Math.floor(b * FPS) - m.k0 + 1); return [i0, i1]; };
  const all = {ad: "tum", a: m.t0, b: m.t1, vurus_hz: null};
  return {bolumler: [...m.bol, all].map(s => { const [i0, i1] = span(s.a, s.b); if (i1 - i0 < FPS) return {ad: s.ad, aralik_sn: [s.a, s.b], kare: Math.max(0, i1 - i0)};
    const Y = m.headY.slice(i0, i1), E = m.headP.slice(i0, i1), pp = a => Math.max(...a) - Math.min(...a);
    return {ad: s.ad, aralik_sn: [s.a, s.b], kare: i1 - i0, egim_pp_derece: pp(E), nod_hz: domHz(Y, FPS), egim_hz: domHz(E, FPS), kafaY_pp_cm: pp(Y) * 100, vurus_hz: s.vurus_hz}; })};
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
    perde: arm(m.fa), pena: arm(1 - m.fa), penaTel_mm: st(m.pickStr.map(x => x * 1000)), penaTelMerkez_mm: st(m.pickMid.map(x => x * 1000))};
}

// Şarkı başına: vurgular, yoğunluk, kesmelerin notaya uzaklığı ve ses programı özeti. Kurulum render.js ile aynı (mekan değişmez, yönetmen).
// clock.js olmayan eski bir kaynakta (SRC) yalnız kesme ve ses programı ölçülür.
async function music(h, id){
  await h.fresh();
  const r = await h.page.evaluate(async ([id, P, clockSrc]) => {
    const rng = await import(new URL("sim/rng.js", location.href).href), CL = await eval(clockSrc)(), song = window.findSong(id);
    const sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 44100 * 2, 44100), manual: true, seed: P.SEED});
    const rs = [rng.getState()]; sim.setCamera("director"); const p = sim.load(song); rs.push(rng.getState());
    [0.5, 5, 12.3].forEach(t => sim.frame(t, t)); rs.push(rng.getState());
    const ev = p.events, on = [];
    for (let i = 0; i < ev.length; ){ let j = i; while (j + 1 < ev.length && ev[j + 1].t - ev[i].t < 0.04) j++; on.push(ev[i].t); i = j + 1; }
    const o = {id: song.id, rs, olay: JSON.stringify(ev.map(e => [e.t, e.end, e.s, e.f, e.midi, e.m])), end: p.end, strums: JSON.stringify(p.strums),
      cekim: JSON.stringify(p.shots.map(s => [s.t, s.end, s.cam, s.kind, s.who])), cuts: p.shots.slice(1).filter(s => s.t < sim.videoEnd()).map(s => s.t), on, nOlay: ev.length};
    if (CL){
      const A = CL.accents(p), tur = {}; A.forEach(a => { tur[a.k] = (tur[a.k] || 0) + 1; });
      const I = []; for (let t = p.t0; t < p.end; t += 0.1) I.push(CL.intensity(p, t));
      o.vurgu = {n: A.length, tur}; o.I = I; o.vurus = p.beats ? p.beats.length : 0;
    }
    return o;
  }, [id, P, clockSrc]);
  const fr = t => Math.ceil(t * FPS - 1e-9), d = r.cuts.map(c => { let b = null; for (const t of r.on){ const x = fr(c) - fr(t); if (b === null || Math.abs(x) < Math.abs(b)) b = x; } return b; });
  const ad = d.map(Math.abs), out = {olay: r.nOlay, vurus: r.vurus,
    kesme: {n: d.length, ...(({med, p90, max}) => ({med, p90, max}))(st(ad)), le1_yuzde: +(100 * ad.filter(x => x <= 1).length / Math.max(1, d.length)).toFixed(1),
      sifir_yuzde: +(100 * ad.filter(x => !x).length / Math.max(1, d.length)).toFixed(1), kareler: d},
    ses: {ozet: sha(JSON.stringify([r.rs, sha(r.olay), r.end, r.strums])), rng: r.rs, olay: sha(r.olay), end: r.end}, cekimPlani: sha(r.cekim)};
  if (r.vurgu){ const I = st(r.I); out.vurgu = r.vurgu; out.yogunluk = {min: I.min, p10: I.p10, med: I.med, p90: I.p90, max: I.max}; }
  return out;
}

// Kadraj: bölümde yönetmen kamerasıyla her karede kafa ve sap eli kadrajda mı (çizim yok, yalnız izdüşüm)
async function framing(h, sec){
  await h.fresh();
  return h.page.evaluate(async ([P, MK, sec, clockSrc]) => {
    const {sim, p} = eval(MK)({...P, CAM: "director"}), CL = await eval(clockSrc)(), THREE = sim.THREE, V = () => new THREE.Vector3(), f = sim.FIG.claude, rows = {};
    const tm = x => typeof x === "number" ? x : CL ? CL.timeAt(p, +x.slice(1)) : p.t0 + +x.slice(1) * 60 / p.bpm, a = tm(sec.a), b = tm(sec.b);
    const proj = (w, C) => { const c = w.clone().applyMatrix4(C.matrixWorldInverse), n = w.clone().project(C); return {front: c.z < 0, x: n.x, y: n.y, py: (1 - n.y) / 2 * 720}; };
    let N = 0, head = 0, hand = 0, band = 0;
    for (let k = Math.ceil(a * P.FPS - 1e-9); k / P.FPS <= b; k++){
      const t = k / P.FPS; sim.update(t, t); sim.scene.updateMatrixWorld(true);
      const cam = sim.director.cam, C = cam === "head" ? sim.cams.head : cam === "stage" ? sim.cams.stage : sim.cams.group; C.updateMatrixWorld(true);
      const fi = (sim.rigs.parts.claude.aim || {}).fretArm ?? 0, H = proj(f.head.getWorldPosition(V()), C), F = proj(f.hands[fi].getWorldPosition(V()), C);
      const hIn = H.front && Math.abs(H.x) <= 1 && Math.abs(H.y) <= 1, fIn = F.front && Math.abs(F.x) <= 1 && Math.abs(F.y) <= 1, fBand = F.front && Math.abs(F.x) <= 1 && F.py > 600;
      const sh = p.shots.find(s => t >= s.t && t < s.end), key = sh ? `${sh.cam}/${sh.kind}@${sh.t.toFixed(2)}` : "-", r = rows[key] || (rows[key] = {kare: 0, kafa: 0, sapEli: 0, altBant: 0});
      N++; r.kare++; if (hIn){ head++; r.kafa++; } if (fIn){ hand++; r.sapEli++; } if (fBand){ band++; r.altBant++; }
    }
    return {N, head, hand, band, rows, a, b};
  }, [P, MK, sec, clockSrc]);
}

// Ritim bölümleri "ad:a-b" (a, b sn ya da bN). dagkrali: beş tur (her tur 32 vuruş) ve son tur + B5 kodası (doruk)
const BOLUM_VARS = {dagkrali: "sinsi:b0-b32,tur2:b32-b64,tur3:b64-b96,tur4:b96-b128,tur5:b128-b160,doruk:b160-b183"};
const parseSecs = s => s.split(",").filter(Boolean).map(x => { const m = /^([^:]+):(b?[\d.]+)-(b?[\d.]+)$/.exec(x.trim());
  if (!m) throw new Error("BOLUM öğesi anlaşılmadı: " + x); const v = y => y[0] === "b" ? y : +y; return {ad: m[1], a: v(m[2]), b: v(m[3])}; });
const SECS = parseSecs(ENVV.BOLUM ?? BOLUM_VARS[SONG] ?? "");
const KSEC = ENVV.KADRAJ ? (ENVV.KADRAJ.includes("-") ? parseSecs("kadraj:" + ENVV.KADRAJ)[0] : SECS.find(s => s.ad === ENVV.KADRAJ)) : SECS.find(s => s.ad === "doruk");

// Kare listesi: "72.4" ya da "mekan/kamera@T" (ör. "theater@45", "summit/stage@30"); boş kısım ENV/CAM'dan gelir
const Tdef = (ENVV.T || "10.2,16.65,72.4").split(",").map(x => { const m = /^(?:([a-z]+))?(?:\/([a-z]+))?@?([\d.]+)$/.exec(x.trim());
  if (!m) throw new Error("T öğesi anlaşılmadı: " + x); return {kare: x.trim(), T: +m[3], env: m[1] || ENVN, cam: m[2] || CAM}; });
const h = await openHarness();
const res = {meta: {SONG, SEED, FPS, ENV: ENVN, CAM, HOVER, src: ENVV.SRC || "src", tarih: new Date().toISOString(), commit: (() => { try { return execSync("git rev-parse --short HEAD", {cwd: ROOT}).toString().trim(); } catch { return "?"; } })()}};
try {
  if (!SKIP.has("el")){ const m = await hands(h, SECS); res.el = handReport(m); res.ritim = rhythmReport(m); }
  if (!SKIP.has("kadraj") && KSEC){ const k = await framing(h, KSEC), pc = x => +(100 * x / Math.max(1, k.N)).toFixed(1);
    res.kadraj = {bolum: KSEC.ad, aralik_sn: [k.a, k.b], kare: k.N, kafa_yuzde: pc(k.head), sapEliKadrajda_yuzde: pc(k.hand), sapEliAltBant_yuzde: pc(k.band), cekimler: k.rows}; }
  if (!SKIP.has("muzik")){ const ids = ENVV.SARKILAR ? ENVV.SARKILAR.split(",") : await h.page.evaluate(() => window.SONG_IDS);
    res.muzik = {sarkilar: {}}; for (const id of ids) res.muzik.sarkilar[id] = await music(h, id); }
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
  L.push(`  Pena-tel (tek nota başlangıcı): uç med ${r3(e.penaTel_mm.med)} mm, p90 ${r3(e.penaTel_mm.p90)} mm; merkez med ${r3(e.penaTelMerkez_mm.med)} mm (${e.penaTel_mm.n} nota); ${e.kare} kare, ${e.basiliNotaKare} basılı notalı`);
}
for (const s of (res.ritim && res.ritim.bolumler) || []) L.push(`  Ritim ${s.ad} [${r3(s.aralik_sn[0])}-${r3(s.aralik_sn[1])} sn]: ` + (s.egim_pp_derece === undefined ? `ölçülen aralık dışında (${s.kare} kare)` :
  `kafa eğimi tepeden tepeye ${r3(s.egim_pp_derece)}°, nod ${r3(s.nod_hz)} Hz (eğim ${r3(s.egim_hz)} Hz${s.vurus_hz ? `, vuruş ${r3(s.vurus_hz)} Hz` : ""}), kafa yüksekliği ${r3(s.kafaY_pp_cm)} cm`));
if (res.kadraj){ const k = res.kadraj; L.push(`  Kadraj ${k.bolum} [${r3(k.aralik_sn[0])}-${r3(k.aralik_sn[1])} sn, ${k.kare} kare]: kafa kadrajda %${k.kafa_yuzde}, sap eli kadrajda %${k.sapEliKadrajda_yuzde}, alt bantta %${k.sapEliAltBant_yuzde}`); }
for (const [id, m] of Object.entries((res.muzik && res.muzik.sarkilar) || {})) L.push(`  Müzik ${id.padEnd(9)} ` + (m.vurgu ? `vurgu ${String(m.vurgu.n).padStart(3)} ${JSON.stringify(m.vurgu.tur)}, yoğunluk ${r3(m.yogunluk.min)}/${r3(m.yogunluk.med)}/${r3(m.yogunluk.max)}, ` : "") +
  `kesme |kare| med ${m.kesme.med} p90 ${m.kesme.p90} max ${m.kesme.max} (≤1 kare %${m.kesme.le1_yuzde}, ${m.kesme.n} kesme), ses programı ${m.ses.ozet}`);
for (const g of res.goruntu || []) L.push(`  Görüntü ${g.kare} (${g.env}, ${g.cam}, ${g.shot}): luma p5 ${g.luma_p5}, med ${g.luma_med}, tam beyaz %${g.tamBeyaz_yuzde}, doygunluk ${g.doygunluk}, 0-40 seviye ${g.karanlikSeviye}`);
for (const d of res.determinizm || []) L.push(`  Determinizm ${d.kare}: ${d.ayni ? "AYNI" : "FARKLI"}  ${Object.entries(d).filter(([k]) => typeof d[k] === "object").map(([k, v]) => `${k} ${v.kare}/${v.durum}`).join("  ")}`);
if (res.ses) L.push(`  Ses: ${res.ses.ornek} örnek, özet ${res.ses.ozet}`);
if (res.meta.gl) L.push(`  Çizici: ${res.meta.gl}`);
if (ENVV.BASE && fs.existsSync(path.resolve(ROOT, ENVV.BASE))) L.push(`Taban → şimdi (${ENVV.BASE}):\n` + diffTable(JSON.parse(fs.readFileSync(path.resolve(ROOT, ENVV.BASE), "utf8")), JSON.parse(fs.readFileSync(OUT, "utf8"))));
console.log(L.join("\n"));
