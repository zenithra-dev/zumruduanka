// Kalıcı ölçüm aracı: çalış senkronu (eller ↔ gitar), görüntü saflığı, determinizm ve isteğe bağlı ses özeti. JSON + okunur özet.
//   SONG=dagkrali node tools/sync-check.mjs                  # bütün şarkıda el ölçümü + T karelerinde görüntü ve determinizm
//   SONG=dagkrali,agit ...                                   # birden çok şarkı: el ve ritim (AUDIO=1 ise ses de) her birinde, ilki res.el, sonrakiler res.ek[id];
//                                                            # kadraj, görüntü ve determinizm ilk şarkıda
//   T="10.2,72.4,theater@45,summit/stage@30" ENV=club CAM=director SEED=1 FPS=30  # kareler ("mekan/kamera@T" de olur)
//   T0=20 T1=40 ...                                          # el ölçümü yalnız bu aralıkta
//   OUT=out/tur1/taban.json BASE=out/tur1/taban.json         # JSON yolu; BASE verilirse fark tablosu da basılır
//   AUDIO=1 ...                                              # ham ses tamponu: özet, saniyelik RMS ve <OUT>.ses.f32 (ses değişti mi?)
//   KARE=out/tur1/kare ...                                   # her T'nin temiz yayın karesini PNG olarak da yaz
//   BOLUM="sinsi:b0-b32,doruk:69.8-76.4"                     # ritim bölümleri, sn ya da bN (N. vuruşun anı); dagkrali'nin varsayılanı var
//   KADRAJ=doruk ...                                         # kadraj ölçümünün bölümü (varsayılan: "doruk" bölümü varsa o)
//   SARKILAR=kaf,dagkrali ...                                # vurgu ve ses programı ölçülen şarkılar (varsayılan hepsi)
//   SRC=yol/src ...                                          # başka bir kaynak ağacını ölç (ör. eski sürümle ses programı karşılaştırması)
//   SKIP=el,goruntu,determinizm,muzik,kadraj,govde,doku      # bölüm atla (govde: görüntü karelerinin gövde maskesi)
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
//   Tur 3 el ve tel ölçümleri (parmak sözleşmesi figures.js makeHand; yoksa avuç ucu): mm, gitar çerçevesinde
//   perdeParmak: basılı her notada (çaldığı her karede) atanan parmağın (m.aim.press; yoksa en yakın parmak) ucu ↔ hedef: theory.js pressX
//     (perde telinin 4 mm gerisi), telin ekseni; bileşenleri perdeGerisi (perde teli - uç x), telYanal, telUstu (uç z - tel z); baslangic: notanın ilk karesi.
//   parmakSap / penaParmak: elin parmak zincirleri (kökten uca 0.25 adım) ile sap + klavye + gövde katılarının (model.solids) yüzey derinliği:
//     parmak kalınlığı (userData.r) - eksenin işaretli uzaklığı; kare başına en derin parmak. >3 mm %: yastık ezilmesinin ötesi; eksenIcinde: eksen katının içinde.
//   kolGovde: üst kol, ön kol (bilek ucu dahil, uzuv yarıçapıyla) ve avuç kutusunun gitar gövdesine (bevel dahil) girişi; kare: >5 mm (tur 1 tanımı), temas: >0.
//   penaTutus: pena merkezi ↔ pena elinin başparmak ve işaret ucu; tutuyor: ikisi de ≤15 mm ve merkez iki ucun arasında (izdüşüm 0.1-0.9).
//   palmMute: palm mute notası çalarken pena elinin topuğu (userData.heel) ↔ köprü çizgisi (x = L, tel düzlemi, dış teller arası); kopruX + köprünün
//     arkası, telDisi dış tellerin dışında kalan, telUstu tel düzleminin üstü.
//   bukme / vibrato: |bend.js bendDisplacement| ≥ 0.5 mm olan karelerde beklenen itme ↔ çizilen tel (strings[s].pos ya da model.stringAt, basma noktasında);
//     parmakTel: notanın parmak ucu ↔ çizilen tel (yanal), parmakBeklenen: parmak ucu ↔ beklenen bükülü tel (yanal).
//   kolGovde bosluk_mm: aynı parçaların gövdeye en yakın geçişi (eksi: içinde); yeni gövde hattı kollara doğru büyürse küçülür.
//   kolDonanim: aynı ölçü gövde üstü donanımla (model.solids.hardware: köprü, eyerler, manyetikler; kutu ya da prizma).
//   Tur 4 (gitar ve askı; sözleşme yoksa "yok"): mm
//   aski: pimler model.strapPins (gitar yerel), bağlantı noktaları figure.strapAnchors(now), beden yüzeyi figure.bodySd; askının kendisi üyenin
//     m.strap'i {pts: eksen örnekleri (dünya, üst pimden alt pime), across?: örnek başına genişlik yönü, w, th: genişlik ve kalınlık, restLen: dinlenme
//     boyu, ends?: {top, bottom} pime takılan uçlar}. yol_m: üst pim → bağlantı noktaları → alt pim çizgisinin boyu; pimBosluk: askı ucu ↔ pim;
//     giris: askı örneklerinin (eksen ve iki kenar, kalınlığın yarısıyla) gitar gövdesine, bedene, kollara (üst kol, ön kol, dirsek), ellere (avuç,
//     parmaklar) girişi, kare başına en derini; boyOrani: görünür boy (eksen çizgisi) / restLen.
//   tremolo: kol model.tremolo.armPts() [{p: gitar yerel, r}] (iskelette null); kol ↔ pena eli (avuç, parmaklar), pena (merkez, 12 mm), pena ön kolu,
//     perde eli arası en küçük yüzey uzaklığı (eksi: içinde) ve kolun tellere, gövdeye girişi.
//   govde (görüntü karelerinde): gövdeye (model.solids.body ve çocukları) düşen pikseller, örtenler hariç: ayrı bir maske çiziminde gövde beyaz,
//     opak her şey siyah, saydamlar gizli, teller siyah; maskesi ≥250 olan pikseller. tamBeyaz250_yuzde: 3B karede üç kanalı da ≥250 olanların payı,
//     enParlak: en parlak gövde pikselinin lumasi (BT.601), p99. flas: o anki vurgu flaşı (rigs.flash).
//   doku: gitarın malzemelerindeki dokuların (map, roughnessMap, clearcoat..., kanvas ya da veri) piksel özeti iki temiz sayfada aynı mı.
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
// Tur 3 el ve tel ölçümleri (extraReport); ek şarkılarda da (res.ek[id].el) basılır
const KEYS3 = ["el.perdeParmak.uc_mm.med", "el.perdeParmak.uc_mm.p90", "el.perdeParmak.baslangic_mm.med", "el.perdeParmak.atanmamis_yuzde", "el.perdeParmak.perdeGerisi_mm.med",
  "el.perdeParmak.telUstu_mm.med", "el.parmakSap.derinlik_mm.p90", "el.parmakSap.derinlik_mm.max", "el.parmakSap.gt3mm_yuzde", "el.parmakSap.eksenIcinde_yuzde",
  "el.penaParmak.gt3mm_yuzde", "el.kolGovde.perde.kol.kare", "el.kolGovde.perde.kol.max_mm", "el.kolGovde.perde.onKol.kare", "el.kolGovde.perde.avuc.kare",
  "el.kolGovde.pena.kol.kare", "el.kolGovde.pena.kol.max_mm", "el.penaTutus.basparmak_mm.med", "el.penaTutus.isaret_mm.med", "el.penaTutus.tutuyor_yuzde",
  "el.palmMute.kare", "el.palmMute.kopru_mm.med", "el.palmMute.kopru_mm.p90", "el.bukme.nota", "el.bukme.beklenen_mm.max", "el.bukme.tel_mm.max", "el.bukme.telHata_mm.med",
  "el.bukme.telHata_mm.p90", "el.bukme.parmakTel_mm.med", "el.bukme.parmakBeklenen_mm.med", "el.vibrato.telHata_mm.med", "el.vibrato.parmakBeklenen_mm.med",
  "el.kolGovde.perde.onKol.bosluk_mm.min", "el.kolGovde.perde.avuc.bosluk_mm.min", "el.kolGovde.pena.onKol.bosluk_mm.min", "el.kolGovde.pena.avuc.bosluk_mm.min",
  "el.kolDonanim.pena.onKol.kare", "el.kolDonanim.pena.onKol.max_mm", "el.kolDonanim.pena.avuc.max_mm", "el.kolDonanim.perde.kol.max_mm",
  "el.aski.yol_m.med", "el.aski.pimBedenBosluk_mm.ust.min", "el.aski.pimBedenBosluk_mm.alt.min", "el.aski.pimBosluk_mm.ust.max", "el.aski.pimBosluk_mm.alt.max",
  "el.aski.giris_mm.govde.max_mm", "el.aski.giris_mm.beden.max_mm", "el.aski.giris_mm.kol.max_mm", "el.aski.giris_mm.el.max_mm", "el.aski.boyOrani.max",
  "el.tremolo.kolPenaEli_mm.min", "el.tremolo.kolPena_mm.min", "el.tremolo.kolTel_mm.max", "el.tremolo.kolGovde_mm.max"];
function diffTable(a, b){
  const rows = [...KEYS, ...KEYS3].map(k => [k, pick(a, k), pick(b, k)]).filter(r => r[1] !== undefined || r[2] !== undefined);
  for (const [id, x] of Object.entries(b.ek || {})){ const o = (a.ek && a.ek[id]) || {};
    for (const k of ["el.perde.hata_cm.med", "el.perde.erisimDisi_yuzde", "el.perde.sicrama.gt10cm", "el.penaTel_mm.med", ...KEYS3]){ const r = [`${id}: ${k}`, pick(o, k), pick(x, k)]; if (r[1] !== undefined || r[2] !== undefined) rows.push(r); }
    if (o.ses && x.ses){ const p = o.ses.saniyelikRMS, q = x.ses.saniyelikRMS; let m = p.length === q.length ? 0 : 1; p.forEach((v, i) => { m = Math.max(m, Math.abs(v - (q[i] ?? 0))); });
      rows.push([`${id}: ses saniyelik RMS en büyük fark`, "", m <= SES_TOL.secRms ? `${m.toExponential(1)} (gürültü)` : `${m.toExponential(2)} FARKLI`, m > SES_TOL.secRms]); } }
  for (const s of (b.ritim && b.ritim.bolumler) || []){ const o = ((a.ritim && a.ritim.bolumler) || []).find(x => x.ad === s.ad) || {};
    for (const k of ["egim_pp_derece", "nod_hz", "egim_hz", "kafaY_pp_cm", "vurus_hz"]) rows.push([`ritim ${s.ad} ${k}`, o[k], s[k]]); }
  for (const [id, m] of Object.entries((b.muzik && b.muzik.sarkilar) || {})){ const o = (a.muzik && a.muzik.sarkilar && a.muzik.sarkilar[id]) || {};
    rows.push([`vurgu ${id}`, o.vurgu && o.vurgu.n, m.vurgu && m.vurgu.n]);
    rows.push([`kesme ${id} |kare| med / ≤1 kare %`, o.kesme && `${o.kesme.med} / ${o.kesme.le1_yuzde}`, m.kesme && `${m.kesme.med} / ${m.kesme.le1_yuzde}`]);
    if (o.ses) rows.push([`ses programı ${id}`, o.ses.ozet, m.ses.ozet, o.ses.ozet !== m.ses.ozet]); }
  for (const g of b.goruntu || []){ const o = (a.goruntu || []).find(x => x.kare === g.kare) || {};
    for (const k of ["luma_p5", "tamBeyaz_yuzde", "doygunluk", "karanlikSeviye"]) rows.push([`goruntu ${g.kare} ${k}`, o[k], g[k]]);
    for (const k of ["tamBeyaz250_yuzde", "enParlak", "p99"]) rows.push([`goruntu ${g.kare} govde.${k}`, o.govde && o.govde[k], g.govde && g.govde[k]]); }
  if (a.doku || b.doku) rows.push(["doku determinizmi", a.doku && (a.doku.durum || a.doku.ayni), b.doku && (b.doku.durum || b.doku.ayni)]);
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
const SONGL = (ENVV.SONG || "dagkrali").split(",").filter(Boolean), SONG = SONGL[0], SEED = +(ENVV.SEED || 1), FPS = +(ENVV.FPS || 30), ENVN = ENVV.ENV || "club", CAM = ENVV.CAM || "director";
const SKIP = new Set((ENVV.SKIP || "").split(",").filter(Boolean)), HOVER = +(ENVV.HOVER || 0.02);
const OUT = path.resolve(ROOT, ENVV.OUT || `out/sync-check-${SONGL.join("+")}.json`);
const P = {SONG, SEED, FPS, ENVN, CAM, HOVER, T0: ENVV.T0 ? +ENVV.T0 : null, T1: ENVV.T1 ? +ENVV.T1 : null};
// Sayfada sim kurulumu (her ölçüm temiz sayfada başlar)
// len verilirse render.js'teki ses kurulumu birebir: mekan değiştirilmez (mekan reverb'ü, yani sesi değiştirir)
const MK = `(P, len) => { const off = new OfflineAudioContext(2, Math.ceil(44100 * (len || 2)), 44100);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: P.SEED});
  if (!len) sim.setEnv(P.ENVN); sim.setCamera(len ? "director" : P.CAM); const p = sim.load(window.findSong(P.SONG)); return {sim, p, off}; }`;

// Bölüm sınırı: sayı (sn) ya da "bN" (N. vuruşun anı; clock.js yoksa sabit tempo). Sayfada çözülür.
const clockSrc = `async () => { try { return await import(new URL("sim/music/clock.js", location.href).href); } catch (e){ return null; } }`;
// Parmak, kol ve tel ölçümleri (hands içinde her karede). Eski bir kaynakta (SRC) olmayan sözleşmelerde (parmak listesi, solids, bend.js) geri düşer:
// parmak yoksa avuç ucu, solids yoksa gitarın çocuklarından tahmin, bend.js yoksa bükme ölçülmez.
const handsExtra = `(sim, p, th, B, P) => {
  const THREE = sim.THREE, f = sim.FIG.claude, G = sim.model.guitar, pick = sim.model.pick, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), ev = p.events;
  const m = sim.rigs.parts && sim.rigs.parts.claude, GI = new THREE.Matrix4(), loc = w => w.clone().applyMatrix4(GI);
  const PINCH = 0.015;   // pena tutuşu: iki parmak ucu da pena merkezine bu kadar yakın
  // Katılar (gitar çerçevesi): kutu ya da xy dış hattı + z kalınlığı olan prizma (bevel dış hattı genişletir)
  const inPoly = (Q, x, y) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const edge = (Q, x, y) => { let d = 9; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey; if (l < 1e-12) continue;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / l)); d = Math.min(d, Math.hypot(x - a[0] - u * ex, y - a[1] - u * ey)); } return d; };
  function solid(o){
    if (!o || !o.geometry) return null; o.updateMatrix(); const g = o.geometry; g.computeBoundingBox();
    if (g.type === "BoxGeometry") return {box: g.boundingBox.clone().applyMatrix4(o.matrix)};
    if (g.type !== "ExtrudeGeometry") return null;
    const sh = [].concat(g.parameters.shapes)[0], op = g.parameters.options || {}, bev = op.bevelEnabled === false ? 0 : (op.bevelSize ?? 0);
    const Q = sh.getPoints(24).map(q => [q.x + o.position.x, q.y + o.position.y]), xs = Q.map(q => q[0]), ys = Q.map(q => q[1]);
    return {Q, bev, z0: g.boundingBox.min.z + o.position.z, z1: g.boundingBox.max.z + o.position.z, x0: Math.min(...xs) - bev, x1: Math.max(...xs) + bev, y0: Math.min(...ys) - bev, y1: Math.max(...ys) + bev};
  }
  const kids = G.children.filter(o => o.isMesh && o.geometry), ext = d => kids.find(o => o.geometry.type === "ExtrudeGeometry" && o.geometry.parameters.options && o.geometry.parameters.options.depth === d);
  const SO = sim.model.solids || {body: ext(0.037), fretboard: ext(0.006), neck: kids.find(o => o.geometry.type === "BoxGeometry" && o.scale.x > 0.3)};
  const BODY = solid(SO.body), NECK = [solid(SO.neck), solid(SO.fretboard), BODY].filter(Boolean), HW = (SO.hardware || []).map(solid).filter(Boolean);
  const sd = (S, q) => {   // işaretli uzaklık (m): dışarıda +, içeride -
    if (S.box){ const b = S.box, dx = Math.max(b.min.x - q.x, q.x - b.max.x), dy = Math.max(b.min.y - q.y, q.y - b.max.y), dz = Math.max(b.min.z - q.z, q.z - b.max.z);
      return dx > 0 || dy > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) : Math.max(dx, dy, dz); }
    const ob = Math.hypot(Math.max(S.x0 - q.x, 0, q.x - S.x1), Math.max(S.y0 - q.y, 0, q.y - S.y1), Math.max(S.z0 - q.z, 0, q.z - S.z1)); if (ob > 0.06) return ob;
    const e = edge(S.Q, q.x, q.y), dxy = (inPoly(S.Q, q.x, q.y) ? -e : e) - S.bev, dz = Math.max(S.z0 - q.z, q.z - S.z1);
    return dxy > 0 || dz > 0 ? Math.hypot(Math.max(dxy, 0), Math.max(dz, 0)) : Math.max(dxy, dz);
  };
  const sdAll = (A, q) => { let d = 9; for (const S of A) d = Math.min(d, sd(S, q)); return d; };
  // Parmak sözleşmesi (figures.js makeHand): userData.fingers [başparmak, işaret, orta, yüzük, serçe], uç userData.tip, kalınlık userData.r
  const FING = i => { const F = f.hands[i].userData && f.hands[i].userData.fingers; return F && F.length >= 5 ? F : null; };
  const tipW = o => o.localToWorld((o.userData.tip || V(0, 0.048, 0)).clone());
  const palmTip = i => { const H = f.hands[i]; return H.getWorldPosition(V()).add(V(0, 1, 0).applyQuaternion(H.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(0.045)); };
  const chain = (H, o) => { const a = []; for (let x = o; x && x !== H; x = x.parent) a.unshift(x.getWorldPosition(V())); a.push(tipW(o)); return a; };
  const limb = o => { const g = o.geometry.parameters, s = o.scale.x; return {a: o.localToWorld(V(0, -0.5, 0)), b: o.localToWorld(V(0, 0.5, 0)), ra: (g.radiusBottom ?? 0.04) * s, rb: (g.radiusTop ?? 0.04) * s}; };
  const limbDepth = (o, S) => { const l = limb(o); let mx = -9; for (let u = 0; u <= 1.0001; u += 0.1) mx = Math.max(mx, l.ra + (l.rb - l.ra) * u - sd(S, loc(l.a.clone().lerp(l.b, u)))); return mx; };
  const palmDepth = (H, S) => { const P = H.userData && H.userData.palm; if (!P) return -9; P.geometry.computeBoundingBox(); const b = P.geometry.boundingBox; let mx = -9;
    for (let k = 0; k < 9; k++){ const c = k === 8 ? b.getCenter(V()) : V(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z); mx = Math.max(mx, -sd(S, loc(P.localToWorld(c)))); } return mx; };
  const strAt = (s, x) => { if (sim.model.stringAt) return sim.model.stringAt(s, x); const S = sim.model.strings && sim.model.strings[s], Q = S && S.pos; if (!Q) return null;
    const n = Q.length / 3; let i = 0; while (i < n - 2 && Q[(i + 1) * 3] < x) i++; const x0 = Q[i * 3], x1 = Q[i * 3 + 3], u = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 0;
    return {y: Q[i * 3 + 1] + (Q[i * 3 + 4] - Q[i * 3 + 1]) * u, z: Q[i * 3 + 2] + (Q[i * 3 + 5] - Q[i * 3 + 2]) * u}; };
  const PX = th.pressX || th.fingerX, ARM = () => [0, 1].map(() => ({kol: [], on: [], ust: [], avuc: []}));
  const X = {fi: 0, pi: 1, kaynak: FING(0) ? "parmak" : "avuc", pp: {d: [], on: [], back: [], lat: [], hi: [], un: 0, n: 0}, fd: [[], []], fj: [[], []], fa: [0, 0], fw: [null, null],
    ts: [], arm: ARM(), hwArm: HW.length ? ARM() : null, hold: {th: [], ix: [], seg: [], ok: 0, n: 0}, pm: {d: [], dx: [], dy: [], dz: [], heel: null},
    bend: {bukme: {nota: [], exp: [], vis: [], err: [], ft: [], fe: []}, vibrato: {nota: [], exp: [], vis: [], err: [], ft: [], fe: []}}, bendOk: !!B};
  // Tur 4: askı ve tremolo kolu (sözleşmeler başta tanımlar bölümünde)
  const SP = sim.model.strapPins, TR = sim.model.tremolo, ANC = f.strapAnchors ? t => f.strapAnchors(t) : null;
  X.AS = {pin: !!SP, anc: !!ANC, sd: !!f.bodySd, yol: [], pimOmuz: [], pimKalca: [], pimBeden: [[], []], n: 0, gap: [[], []], dep: {govde: [], beden: [], kol: [], el: []}, oran: []};
  X.TM = {tr: !!TR, var: !!(TR && TR.armPts && TR.armPts()), n: 0, el: [], pena: [], onKol: [], perde: [], tel: [], govde: []};
  const segDist = (q, a, b) => { const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z, l = ex * ex + ey * ey + ez * ez;
    const u = l > 1e-12 ? Math.max(0, Math.min(1, ((q.x - a.x) * ex + (q.y - a.y) * ey + (q.z - a.z) * ez) / l)) : 0;
    return [Math.hypot(q.x - a.x - u * ex, q.y - a.y - u * ey, q.z - a.z - u * ez), u]; };
  const boxSd = (q, b) => { const dx = Math.max(b.min.x - q.x, q.x - b.max.x), dy = Math.max(b.min.y - q.y, q.y - b.max.y), dz = Math.max(b.min.z - q.z, q.z - b.max.z);
    return dx > 0 || dy > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) : Math.max(dx, dy, dz); };
  // Kare başına engeller (dünya): kolların parçaları ve dirsekler (k "kol"), parmak boğumları ve avuç kutusu (k "el"); i kol indeksi
  const obst = () => { const C = [], Bx = [];
    [0, 1].forEach(i => { const A = f.arms[i], H = f.hands[i], F = FING(i);
      for (const [o, w] of [[A.up, "ustKol"], [A.fo, "onKol"]]){ const l = limb(o); C.push({a: l.a, b: l.b, ra: l.ra, rb: l.rb, k: "kol", i, w}); }
      const e = A.el.getWorldPosition(V()), er = (A.el.geometry.parameters.radius || 0.048) * A.el.scale.x; C.push({a: e, b: e, ra: er, rb: er, k: "kol", i, w: "dirsek"});
      if (F) F.forEach(o => { const P = chain(H, o), r = o.userData.r ?? 0.008; for (let s = 0; s + 1 < P.length; s++) C.push({a: P[s], b: P[s + 1], ra: r, rb: r, k: "el", i, w: "parmak"}); });
      const P = H.userData && H.userData.palm; if (P){ P.geometry.computeBoundingBox(); Bx.push({inv: new THREE.Matrix4().copy(P.matrixWorld).invert(), bb: P.geometry.boundingBox, k: "el", i, w: "avuc"}); } });
    return {C, Bx}; };
  // q (yarıçap h) engellerin (süzgeçten geçenlerin) içine ne kadar giriyor (m; eksi: o kadar uzakta)
  const _bq = V();
  const into = (q, h, O, pass) => { let d = -9;
    for (const c of O.C) if (pass(c)){ const [s, u] = segDist(q, c.a, c.b); d = Math.max(d, h + c.ra + (c.rb - c.ra) * u - s); }
    for (const b of O.Bx) if (pass(b)) d = Math.max(d, h - boxSd(_bq.copy(q).applyMatrix4(b.inv), b.bb));
    return d; };
  function strapStep(t){
    const A = X.AS, Pt = G.localToWorld(SP.top.clone()), Pb = G.localToWorld(SP.bottom.clone());
    if (f.bodySd){ A.pimBeden[0].push(f.bodySd(Pt)); A.pimBeden[1].push(f.bodySd(Pb)); }
    if (ANC){ const N = ANC(t), at = id => (N.find(a => a.id === id) || N[0]).p; let L = Pt.distanceTo(N[0].p) + N[N.length - 1].p.distanceTo(Pb);
      for (let i = 1; i < N.length; i++) L += N[i].p.distanceTo(N[i - 1].p);
      A.yol.push(L); A.pimOmuz.push(Pt.distanceTo(at("omuz"))); A.pimKalca.push(Pb.distanceTo(at("kalca"))); }
    const S = m && m.strap; if (!S || !S.pts || S.pts.length < 2) return;
    const O = obst(), h = (S.th || 0.002) / 2, e = S.ends || {top: S.pts[0], bottom: S.pts[S.pts.length - 1]};
    A.n++; A.gap[0].push(e.top.distanceTo(Pt)); A.gap[1].push(e.bottom.distanceTo(Pb));
    let dg = -9, db = -9, dk = -9, de = -9, len = 0;
    S.pts.forEach((c, j) => { if (j) len += c.distanceTo(S.pts[j - 1]);
      const ac = S.across && S.across[j], Q = ac && S.w ? [c, c.clone().addScaledVector(ac, S.w / 2), c.clone().addScaledVector(ac, -S.w / 2)] : [c];
      for (const q of Q){ if (BODY) dg = Math.max(dg, h - sd(BODY, loc(q))); if (f.bodySd) db = Math.max(db, h - f.bodySd(q));
        dk = Math.max(dk, into(q, h, O, o => o.k === "kol")); de = Math.max(de, into(q, h, O, o => o.k === "el")); } });
    A.dep.govde.push(dg); A.dep.beden.push(db); A.dep.kol.push(dk); A.dep.el.push(de); if (S.restLen) A.oran.push(len / S.restLen);
  }
  function tremStep(fi, pi){
    const A = TR.armPts(); if (!A || A.length < 2) return;
    const M = X.TM, O = obst(), pk = pick.getWorldPosition(V()), GA = sim.model.GAUGE || [];
    let dEl = 9, dPk = 9, dFo = 9, dFr = 9, dT = -9, dG = -9;
    for (let j = 0; j + 1 < A.length; j++){ const a = A[j], b = A[j + 1], n = Math.max(1, Math.ceil(a.p.distanceTo(b.p) / 0.004));   // eksen boyunca 4 mm adım
      for (let s = 0; s <= n; s++){ const u = s / n, ql = a.p.clone().lerp(b.p, u), r = a.r + (b.r - a.r) * u, q = G.localToWorld(ql.clone());
        dEl = Math.min(dEl, -into(q, r, O, c => c.i === pi && c.k === "el")); dFo = Math.min(dFo, -into(q, r, O, c => c.i === pi && c.w === "onKol"));
        dFr = Math.min(dFr, -into(q, r, O, c => c.i === fi && c.k === "el")); dPk = Math.min(dPk, q.distanceTo(pk) - r - 0.012);
        if (BODY) dG = Math.max(dG, r - sd(BODY, ql));
        if (ql.x > 0 && ql.x < th.L + 0.005) for (let k = 0; k < 6; k++){ const sv = strAt(k, Math.min(th.L, ql.x)); if (sv) dT = Math.max(dT, r + (GA[k] || 0.001) / 2 - Math.hypot(ql.y - sv.y, ql.z - sv.z)); } } }
    M.n++; M.el.push(dEl); M.pena.push(dPk); M.onKol.push(dFo); M.perde.push(dFr); M.tel.push(dT); M.govde.push(dG);
  }
  // Notanın parmak ucu: atanmış parmak (m.aim.press), yoksa işaret..serçeden en yakını, parmak sözleşmesi yoksa avuç ucu
  const noteTip = (e, fi, tw) => { const F = FING(fi); if (!F) return {w: palmTip(fi), as: false};
    const c = m && m.aim && m.aim.press && m.aim.press.find(x => x.e === e); if (c && F[c.k]) return {w: tipW(F[c.k]), as: true};
    let b = null; for (let k = 1; k <= 4; k++){ const w = tipW(F[k]); if (!b || w.distanceTo(tw) < b.distanceTo(tw)) b = w; } return {w: b, as: false}; };
  const step = (t, k) => {
    GI.copy(G.matrixWorld).invert(); X.ts.push(t);
    const aim = m && m.aim, fi = X.fi = aim && aim.fretArm !== undefined ? aim.fretArm : 0, pi = X.pi = aim && aim.pickArm !== undefined ? aim.pickArm : 1;
    // (a) basılı notada atanan parmak ucu ↔ hedef (perde telinin hemen gerisi, tel ekseni)
    for (const e of ev){ if (e.t > t) break; if (!(e.f > 0) || t >= e.end) continue;
      const x = PX(e.f), tw = G.localToWorld(V(x, th.stringY(e.s, x), th.STR_Z)), nt = noteTip(e, fi, tw), q = loc(nt.w), d = nt.w.distanceTo(tw);
      X.pp.n++; if (!nt.as) X.pp.un++; X.pp.d.push(d); X.pp.back.push(th.fretX(e.f) - q.x); X.pp.lat.push(Math.abs(q.y - th.stringY(e.s, q.x))); X.pp.hi.push(q.z - th.STR_Z);
      if (k === Math.ceil(e.t * P.FPS - 1e-9)) X.pp.on.push(d); }
    // (b) parmakların sap/klavye/gövde içine girmesi: yüzey derinliği (kalınlık − işaretli uzaklık), ekseni içeride mi
    [0, 1].forEach(i => { const F = FING(i), H = f.hands[i]; let mx = -9, ax = false, who = -1;
      (F ? F.map((o, j) => [chain(H, o), o.userData.r ?? 0.008, j]) : [[[palmTip(i)], 0, 5]]).forEach(([C, r, j]) => { let fm = -9;
        for (let s = 0; s < C.length; s++) for (let u = 0; u <= (s + 1 < C.length ? 0.76 : 0); u += 0.25){
          const w = s + 1 < C.length ? C[s].clone().lerp(C[s + 1], u) : C[s], d = sdAll(NECK, loc(w)); if (d < 0) ax = true; fm = Math.max(fm, r - d); }
        (X.fj[i][j] = X.fj[i][j] || []).push(fm); if (fm > mx){ mx = fm; who = j; } });
      X.fd[i].push(mx); if (ax) X.fa[i]++; if (!X.fw[i] || mx > X.fw[i].d) X.fw[i] = {d: mx, t, j: who}; });
    // (c) kolun (üst kol, ön kol ve bilek, avuç) gitar gövdesine girmesi
    if (BODY) [0, 1].forEach(i => { const A = f.arms[i], R = X.arm[i], u = limbDepth(A.up, BODY), o = limbDepth(A.fo, BODY), a = palmDepth(f.hands[i], BODY);
      R.ust.push(u); R.on.push(o); R.avuc.push(a); R.kol.push(Math.max(u, o)); });
    // (c2) aynı parçaların gövde üstü donanıma (solids.hardware: köprü, eyerler, manyetikler) girişi
    if (HW.length) [0, 1].forEach(i => { const A = f.arms[i], R = X.hwArm[i]; let u = -9, o = -9, a = -9;
      for (const S of HW){ u = Math.max(u, limbDepth(A.up, S)); o = Math.max(o, limbDepth(A.fo, S)); a = Math.max(a, palmDepth(f.hands[i], S)); }
      R.ust.push(u); R.on.push(o); R.avuc.push(a); R.kol.push(Math.max(u, o)); });
    // (d) pena başparmak ile işaret parmağı arasında mı
    const PF = FING(pi);
    if (PF){ const c = pick.localToWorld(V(0, 0.001, 0.0006)), a = tipW(PF[0]), b = tipW(PF[1]), ab = b.clone().sub(a), u = c.clone().sub(a).dot(ab) / Math.max(1e-12, ab.lengthSq());
      const dt = c.distanceTo(a), di = c.distanceTo(b); X.hold.n++; X.hold.th.push(dt); X.hold.ix.push(di); X.hold.seg.push(a.clone().addScaledVector(ab, Math.min(1, Math.max(0, u))).distanceTo(c));
      if (dt <= PINCH && di <= PINCH && u > 0.1 && u < 0.9) X.hold.ok++; }
    // (e) palm mute notalarında avucun serçe kenarı (heel) ↔ köprü çizgisi (x = L, tel düzlemi, dış teller arası)
    if (ev.some(e => e.m && t >= e.t && t < e.end)){ const H = f.hands[pi], hl = H.userData && H.userData.heel; X.pm.heel = hl ? "heel" : "bilek";
      const q = loc(hl ? H.localToWorld(hl.clone()) : H.getWorldPosition(V())), dx = q.x - th.L, dy = Math.max(0, Math.abs(q.y) - th.stringY(0, th.L)), dz = q.z - th.STR_Z;
      X.pm.d.push(Math.hypot(dx, dy, dz)); X.pm.dx.push(dx); X.pm.dy.push(dy); X.pm.dz.push(dz); }
    // (f) bükme ve vibrato: telin beklenen itmesi (bend.js) ↔ çizilen tel, bükme yapan parmak ↔ tel
    if (B) for (const e of ev){ if (e.t - B.PRE_IN > t) break; if (!(e.f > 0) || t > e.end + B.REL) continue;
      const dE = B.bendDisplacement(e, t); if (Math.abs(dE) < 0.0005) continue;
      const C = X.bend[e.bend || e.pre ? "bukme" : "vibrato"], xp = PX(e.f), sv = strAt(e.s, xp), dV = sv ? sv.y - th.stringY(e.s, xp) : 0;
      const tw = G.localToWorld(V(xp, th.stringY(e.s, xp) + dE, th.STR_Z)), q = loc(noteTip(e, fi, tw).w), sp = strAt(e.s, q.x);
      if (!C.nota.includes(e)) C.nota.push(e); C.exp.push(Math.abs(dE)); C.vis.push(Math.abs(dV)); C.err.push(Math.abs(dV - dE));
      if (sp) C.ft.push(Math.abs(q.y - sp.y)); C.fe.push(Math.abs(q.y - th.stringY(e.s, q.x) - dE * B.bendShape(xp, q.x))); }
    // (g) askı ve (h) tremolo kolu
    if (SP) strapStep(t);
    if (X.TM.var) tremStep(fi, pi);
  };
  // Sayfadan çıkış: olaylar sayıya çevrilir
  const done = () => { for (const C of Object.values(X.bend)) C.nota = C.nota.length; return X; };
  return {step, done};
}`;
// Sayfadan dönen ham dizileri rapora çevirir (mm, yüzde)
function extraReport(X){
  const mm = a => st(a.map(x => x * 1000)), pc = (a, b) => +(100 * a / Math.max(1, b)).toFixed(2), fi = X.fi, pi = X.pi, AD = ["başparmak", "işaret", "orta", "yüzük", "serçe", "avuç ucu"];
  const gt3 = a => pc(a.filter(x => x > 0.003).length, a.length), pos = a => a.map(x => Math.max(0, x));
  const depth = i => { const w = X.fw[i]; return {kare: X.fd[i].length, derinlik_mm: mm(pos(X.fd[i])), gt3mm_yuzde: gt3(X.fd[i]), eksenIcinde_yuzde: pc(X.fa[i], X.fd[i].length),
    enDerin: w ? {mm: w.d * 1000, sn: w.t, parmak: AD[w.j]} : null,
    parmaklar: Object.fromEntries(X.fj[i].map((a, j) => a && [AD[j], {p90_mm: mm(pos(a)).p90, max_mm: mm(pos(a)).max, gt3mm_yuzde: gt3(a)}]).filter(Boolean))}; };
  const part = (a, at) => { let mx = -9, k = -1; a.forEach((x, i) => { if (x > mx){ mx = x; k = i; } }); const c = a.filter(x => x > 0.005).length, b = mm(a.map(x => -x));
    return {kare: c, yuzde: pc(c, a.length), temas_kare: a.filter(x => x > 0).length, max_mm: Math.max(0, mx) * 1000, maxAt_sn: k < 0 ? null : at[k], bosluk_mm: {min: b.min, p10: b.p10, med: b.med}}; };
  const arm = (i, Q = X.arm) => { const R = Q[i]; return R.kol.length ? {kol: part(R.kol, X.ts), onKol: part(R.on, X.ts), ustKol: part(R.ust, X.ts), avuc: part(R.avuc, X.ts)} : null; };
  const bend = C => ({nota: C.nota, kare: C.exp.length, beklenen_mm: mm(C.exp), tel_mm: mm(C.vis), telHata_mm: mm(C.err), parmakTel_mm: mm(C.ft), parmakBeklenen_mm: mm(C.fe)});
  const dep = a => { const s = mm(a); return {max_mm: s.max, p90_mm: s.p90, gt1mm_yuzde: pc(a.filter(x => x > 0.001).length, a.length), gt3mm_yuzde: pc(a.filter(x => x > 0.003).length, a.length)}; };
  const ms = a => a.length ? st(a) : null, A = X.AS, T = X.TM;
  const aski = !A || !A.pin ? {durum: "yok (model.strapPins)"} : {pimler: "var", baglanti: A.anc ? "var" : "yok (figure.strapAnchors)", beden: A.sd ? "var" : "yok (figure.bodySd)",
    yol_m: ms(A.yol), ustPimOmuz_m: ms(A.pimOmuz), altPimKalca_m: ms(A.pimKalca), pimBedenBosluk_mm: A.sd ? {ust: mm(A.pimBeden[0]), alt: mm(A.pimBeden[1])} : null,
    kare: A.n, ...(A.n ? {pimBosluk_mm: {ust: mm(A.gap[0]), alt: mm(A.gap[1])}, giris_mm: Object.fromEntries(Object.entries(A.dep).map(([k, a]) => [k, dep(a)])), boyOrani: ms(A.oran)}
      : {durum: "askı yok (m.strap)"})};
  const near = a => { const s = mm(a); return {min: s.min, p10: s.p10, med: s.med, temas_kare: a.filter(x => x < 0).length}; };
  const tremolo = !T || !T.tr ? {durum: "yok (model.tremolo)"} : !T.var ? {durum: "iskelet: kol yok (tremolo.armPts null)"} :
    {kare: T.n, kolPenaEli_mm: near(T.el), kolPena_mm: near(T.pena), kolPenaOnKol_mm: near(T.onKol), kolPerdeEli_mm: near(T.perde), kolTel_mm: {max: mm(T.tel).max}, kolGovde_mm: {max: mm(T.govde).max}};
  return {
    perdeParmak: {kaynak: X.kaynak, notaKare: X.pp.n, uc_mm: mm(X.pp.d), baslangic_mm: mm(X.pp.on), atanmamis_yuzde: pc(X.pp.un, X.pp.n),
      perdeGerisi_mm: mm(X.pp.back), telYanal_mm: mm(X.pp.lat), telUstu_mm: mm(X.pp.hi)},
    parmakSap: depth(fi), penaParmak: depth(pi),
    kolGovde: {esik_mm: 5, perde: arm(fi), pena: arm(pi)},
    kolDonanim: X.hwArm ? {esik_mm: 5, perde: arm(fi, X.hwArm), pena: arm(pi, X.hwArm)} : {durum: "yok (solids.hardware)"},
    penaTutus: X.hold.n ? {kare: X.hold.n, basparmak_mm: mm(X.hold.th), isaret_mm: mm(X.hold.ix), ara_mm: mm(X.hold.seg), tutuyor_yuzde: pc(X.hold.ok, X.hold.n)} : null,
    palmMute: X.pm.d.length ? {kare: X.pm.d.length, nokta: X.pm.heel, kopru_mm: mm(X.pm.d), kopruX_mm: mm(X.pm.dx), telDisi_mm: mm(X.pm.dy), telUstu_mm: mm(X.pm.dz)} : {kare: 0},
    bukme: X.bendOk ? bend(X.bend.bukme) : null, vibrato: X.bendOk ? bend(X.bend.vibrato) : null, aski, tremolo};
}
async function hands(h, secs, P){
  await h.fresh();
  return h.page.evaluate(async ([P, MK, secs, clockSrc, handsExtra]) => {
    const th = await import(new URL("sim/music/theory.js", location.href).href), {sim, p} = eval(MK)(P), CL = await eval(clockSrc)();
    const B = await import(new URL("sim/music/bend.js", location.href).href).catch(() => null);
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
    const XF = eval(handsExtra)(sim, p, th, B, P);
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
      XF.step(t, k);
      prev = T;
    }
    // Perde eli: perde+pena hatası toplamını en küçük yapan eşleşme. Taraf figürün kendi ekseninde (+z'ye bakar, sağı -x).
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const fa = med(R[1].fret) + med(R[0].pick) <= med(R[0].fret) + med(R[1].pick) ? 1 : 0;
    const side = i => f.g.worldToLocal(f.up.localToWorld(f.sh[i].clone())).x < 0 ? "sağ" : "sol";
    const neck = f.g.worldToLocal(guitar.localToWorld(V(0, 0, 0))).x - f.g.worldToLocal(guitar.localToWorld(V(th.L, 0, 0))).x;
    return {n, nFret, t0, t1, fa, fretSide: side(fa), pickSide: side(1 - fa), neckToLeft: neck > 0, armLen: [armLen(0), armLen(1)], R, pickStr, pickMid, k0, headY, headP, bol, X: XF.done()};
  }, [P, MK, secs, clockSrc, handsExtra]);
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
async function grab(h, T, seq, Q, mask){
  await h.fresh();
  return h.page.evaluate(([P, MK, T, seq, mask]) => {
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
    const sh = p.shots.find(s => T >= s.t && T < s.end), png = cv.toDataURL("image/png");
    // Gövde maskesi (yayın karesi alındıktan sonra; tuvali bozar): gövde beyaz, opak her şey siyah, saydamlar gizli, teller siyah ve ışıksız
    let govde = null;
    const BO = mask && sim.model.solids && sim.model.solids.body;
    if (BO){
      const THREE = sim.THREE, sc = sim.scene, R = sim.renderer, inB = new Set(), strs = new Map(), keep = [];
      BO.traverse(o => inB.add(o)); (sim.model.strings || []).forEach(s => strs.set(s.mesh, s.mat));
      const W = new THREE.MeshBasicMaterial({color: 0xffffff, fog: false}), K = new THREE.MeshBasicMaterial({color: 0x000000, fog: false}), cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha();
      const sm = [...new Set(strs.values())].map(m => [m, m.color.clone(), m.metalness, m.roughness, m.emissive.clone()]);
      sm.forEach(([m]) => { m.color.setRGB(0, 0, 0); m.metalness = 0; m.roughness = 1; m.emissive.setRGB(0, 0, 0); });
      sc.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return; keep.push([o, o.material, o.visible]); if (strs.has(o)) return;
        if (inB.has(o)) o.material = W; else if (!o.isMesh || [].concat(o.material).some(m => m.transparent || m.blending !== THREE.NormalBlending)) o.visible = false; else o.material = K; });
      const bg = sc.background, fog = sc.fog; sc.background = null; sc.fog = null;
      R.setRenderTarget(null); R.setClearColor(0x000000, 1); R.clear(); R.render(sc, C);
      const mc = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}), mg = mc.getContext("2d"); mg.drawImage(sim.canvas, 0, 0, 1280, 720);
      const md = mg.getImageData(0, 0, 1280, 720).data;
      keep.forEach(([o, m, v]) => { o.material = m; o.visible = v; }); sm.forEach(([m, c, me, ro, em]) => { m.color.copy(c); m.metalness = me; m.roughness = ro; m.emissive.copy(em); });
      sc.background = bg; sc.fog = fog; R.setClearColor(cc, ca);
      let n = 0, w = 0, mx = 0; const hy = new Float64Array(256);
      for (let i = 0; i < md.length; i += 4){ if (md[i] < 250 || md[i + 1] < 250 || md[i + 2] < 250) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2], y = 0.299 * r + 0.587 * gg + 0.114 * b; n++; hy[Math.min(255, Math.round(y))]++; if (r >= 250 && gg >= 250 && b >= 250) w++; mx = Math.max(mx, y); }
      let c = 0, p99 = 0; for (let v = 0; v < 256; v++){ c += hy[v]; if (c >= 0.99 * n){ p99 = v; break; } }
      govde = {piksel: n, tamBeyaz250_yuzde: n ? 100 * w / n : 0, enParlak: mx, p99, flas: sim.rigs.flash};
    }
    return {png, state: st, cam, shot: sh ? `${sh.cam}/${sh.kind}${sh.glide ? "+kayma" : ""}` : "-", gl, govde,
      luma_p5: pct(0.05), luma_med: pct(0.5), luma_ort: sumY / N, tamBeyaz_yuzde: 100 * white / N, doygunluk: sat / N, karanlikSeviye: lv.size};
  }, [Q, MK, T, seq, mask]);
}
// Gitar dokularının piksel özeti (temiz sayfada): gitarın malzemelerindeki kanvas ya da veri dokuları
const TEX_KEYS = ["map", "roughnessMap", "metalnessMap", "normalMap", "bumpMap", "clearcoatMap", "clearcoatRoughnessMap", "clearcoatNormalMap", "emissiveMap", "alphaMap", "aoMap"];
async function textures(h){
  await h.fresh();
  return h.page.evaluate(([MK, K]) => {
    const {sim} = eval(MK)({SEED: 1, ENVN: "club", CAM: "director", SONG: window.SONG_IDS[0]}), out = [], seen = new Set();
    const fnv = u => { let a = 2166136261; for (let i = 0; i < u.length; i++){ a ^= u[i]; a = Math.imul(a, 16777619); } return (a >>> 0).toString(16).padStart(8, "0"); };
    let k = 0;
    sim.model.guitar.traverse(o => { k++; for (const m of [].concat(o.material || [])) for (const key of K){ const t = m[key], im = t && t.image; if (!im || seen.has(t)) continue; seen.add(t);
      let px = null; const w = im.width, hh = im.height;
      if (im.data) px = new Uint8Array(im.data.buffer, im.data.byteOffset, im.data.byteLength);
      else { const c = Object.assign(document.createElement("canvas"), {width: w, height: hh}), g = c.getContext("2d"); g.drawImage(im, 0, 0); px = g.getImageData(0, 0, w, hh).data; }
      out.push({ad: `${o.name || o.type}#${k}.${key}`, w, h: hh, ozet: fnv(px)}); } });
    return out;
  }, [MK, TEX_KEYS]);
}

async function audio(h, P){
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
    perde: arm(m.fa), pena: arm(1 - m.fa), penaTel_mm: st(m.pickStr.map(x => x * 1000)), penaTelMerkez_mm: st(m.pickMid.map(x => x * 1000)), ...(m.X ? extraReport(m.X) : {})};
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
const res = {meta: {SONG: SONGL.join(","), SEED, FPS, ENV: ENVN, CAM, HOVER, src: ENVV.SRC || "src", tarih: new Date().toISOString(), commit: (() => { try { return execSync("git rev-parse --short HEAD", {cwd: ROOT}).toString().trim(); } catch { return "?"; } })()}};
try {
  // El ölçümü her şarkıda: ilki res.el/res.ritim (eski tabanlarla karşılaştırılabilir), sonrakiler res.ek[id] altında
  if (!SKIP.has("el")) for (const [i, id] of SONGL.entries()){ const m = await hands(h, i ? parseSecs(BOLUM_VARS[id] ?? "") : SECS, {...P, SONG: id});
    if (!i){ res.el = handReport(m); res.ritim = rhythmReport(m); } else (res.ek = res.ek || {})[id] = {el: handReport(m), ritim: rhythmReport(m)}; }
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
      for (const [k, s] of Object.entries(seqs)){ if (k !== "temiz" && SKIP.has("determinizm")) continue; out[k] = await grab(h, T, s, Q, k === "temiz" && !SKIP.has("govde")); }
      const c = out.temiz; res.meta.gl = c.gl;
      res.goruntu.push({kare, T, env, cam: c.cam, shot: c.shot, ...Object.fromEntries(["luma_p5", "luma_med", "luma_ort", "tamBeyaz_yuzde", "doygunluk", "karanlikSeviye"].map(k => [k, r3(c[k])])),
        govde: c.govde || "yok"});
      if (ENVV.KARE) fs.writeFileSync(path.resolve(ROOT, `${ENVV.KARE}-${kare.replace(/[@/]/g, "-")}.png`), Buffer.from(c.png.split(",")[1], "base64"));
      if (!SKIP.has("determinizm")){
        const k = Object.fromEntries(Object.entries(out).map(([n, o]) => [n, {kare: sha(o.png), durum: sha(o.state)}]));
        res.determinizm.push({kare, T, ...k, ayni: Object.values(k).every(x => x.kare === k.temiz.kare && x.durum === k.temiz.durum)});
      }
    }
  }
  if (!SKIP.has("doku")){ const a = await textures(h), b = await textures(h);
    res.doku = a.length ? {dokular: a, ayni: JSON.stringify(a) === JSON.stringify(b), ikinci: a.map((x, i) => b[i] && b[i].ozet)} : {durum: "yok (gitarda kanvas/veri dokusu yok)"}; }
  if (ENVV.AUDIO) for (const [i, id] of SONGL.entries()){   // ham tampon: önce L sonra R, float32; ilk şarkı <OUT>.ses.f32, sonrakiler <OUT>-<id>.ses.f32
    const a = await audio(h, {...P, SONG: id}), f = OUT.replace(/\.json$/, "") + (i ? "-" + id : "") + ".ses.f32";
    fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, Buffer.from(a.raw, "base64")); delete a.raw;
    if (!i) res.ses = {...a, ham: path.relative(ROOT, f)}; else ((res.ek = res.ek || {})[id] = res.ek[id] || {}).ses = {...a, ham: path.relative(ROOT, f)}; }
} finally { await h.close(); }

fs.mkdirSync(path.dirname(OUT), {recursive: true});
const RMS = new Set([res.ses, ...Object.values(res.ek || {}).map(x => x.ses)].filter(Boolean).map(x => x.saniyelikRMS));
fs.writeFileSync(OUT, JSON.stringify(res, function(k, v){ return RMS.has(this) ? v : r3(v); }, 1));
const e = res.el, L = [];
L.push(`sync-check ${res.meta.SONG} (tohum ${SEED}, ${FPS} fps, ${ENVN}/${CAM}, ${res.meta.commit}) → ${OUT}`);
const m3 = x => x == null ? "-" : r3(x);
function extraLines(e){
  const p = e.perdeParmak, d = e.parmakSap, q = e.penaParmak, k = e.kolGovde, h = e.penaTutus, pm = e.palmMute;
  if (!p) return;
  L.push(`  Perde parmağı (${p.kaynak}, ${p.notaKare} nota-kare): uç ↔ hedef (perde gerisi ${m3(p.perdeGerisi_mm.med)} mm, yanal ${m3(p.telYanal_mm.med)}, tel üstü ${m3(p.telUstu_mm.med)}) med ${m3(p.uc_mm.med)} / p90 ${m3(p.uc_mm.p90)} / max ${m3(p.uc_mm.max)} mm, başlangıç karesi med ${m3(p.baslangic_mm.med)} mm, atanmamış %${p.atanmamis_yuzde}`);
  L.push(`  Parmak sapta (yüzey derinliği): perde eli p90 ${m3(d.derinlik_mm.p90)} / max ${m3(d.derinlik_mm.max)} mm, >3 mm %${d.gt3mm_yuzde}, eksen içeride %${d.eksenIcinde_yuzde}` +
    (d.enDerin ? ` (en derin ${m3(d.enDerin.mm)} mm ${d.enDerin.parmak} @${m3(d.enDerin.sn)} sn)` : "") + `; pena eli >3 mm %${q.gt3mm_yuzde}, max ${m3(q.derinlik_mm.max)} mm`);
  if (d.parmaklar) L.push(`    parmak başına (p90 / max mm, >3 mm %): ` + Object.entries(d.parmaklar).map(([n, x]) => `${n} ${m3(x.p90_mm)} / ${m3(x.max_mm)} / %${x.gt3mm_yuzde}`).join(", "));
  const kg = (n, a) => a ? `${n} kol ${a.kol.kare} kare (%${a.kol.yuzde}, temas ${a.kol.temas_kare}), en derin ${m3(a.kol.max_mm)} mm @${m3(a.kol.maxAt_sn)} sn [ön kol+bilek ${a.onKol.kare}/${m3(a.onKol.max_mm)} mm, üst kol ${a.ustKol.kare}/${m3(a.ustKol.max_mm)} mm, avuç ${a.avuc.kare}/${m3(a.avuc.max_mm)} mm]` : `${n} -`;
  L.push(`  Kol gövdede (>${k.esik_mm} mm): ${kg("perde", k.perde)}; ${kg("pena", k.pena)}`);
  const bs = (n, a) => a && a.kol.bosluk_mm ? `${n} ön kol ${m3(a.onKol.bosluk_mm.min)}/${m3(a.onKol.bosluk_mm.p10)}, üst kol ${m3(a.ustKol.bosluk_mm.min)}/${m3(a.ustKol.bosluk_mm.p10)}, avuç ${m3(a.avuc.bosluk_mm.min)}/${m3(a.avuc.bosluk_mm.p10)}` : `${n} -`;
  L.push(`    gövdeye boşluk (en az / p10 mm, eksi: içinde): ${bs("perde", k.perde)}; ${bs("pena", k.pena)}`);
  const kd = e.kolDonanim; if (kd) L.push(kd.durum ? `  Kol donanımda: ${kd.durum}` : `  Kol donanımda (köprü, eyer, manyetik; >${kd.esik_mm} mm): ${kg("perde", kd.perde)}; ${kg("pena", kd.pena)}`);
  if (h) L.push(`  Pena tutuşu: başparmak ucu med ${m3(h.basparmak_mm.med)} / p90 ${m3(h.basparmak_mm.p90)} mm, işaret ucu med ${m3(h.isaret_mm.med)} / p90 ${m3(h.isaret_mm.p90)} mm, iki uç arası çizgiye ${m3(h.ara_mm.med)} mm; arasında ve ≤15 mm %${h.tutuyor_yuzde}`);
  L.push(pm.kare ? `  Palm mute (${pm.kare} kare, ${pm.nokta}): avuç kenarı ↔ köprü med ${m3(pm.kopru_mm.med)} / p90 ${m3(pm.kopru_mm.p90)} mm (köprüden x med ${m3(pm.kopruX_mm.med)}, tel dışı med ${m3(pm.telDisi_mm.med)}, tel üstü med ${m3(pm.telUstu_mm.med)} mm)` : "  Palm mute: notası yok");
  const a = e.aski, tr = e.tremolo, sm3 = x => x ? `${m3(x.min)}/${m3(x.med)}/${m3(x.max)}` : "-";
  if (a) L.push(a.durum && !a.pimler ? `  Askı: ${a.durum}` : `  Askı: pimler ${a.pimler}, bağlantı ${a.baglanti}, beden ${a.beden}; yol (pim → bağlantılar → pim) en az/med/en çok ${sm3(a.yol_m)} m, üst pim ↔ omuz ${sm3(a.ustPimOmuz_m)} m, ` +
    `alt pim ↔ kalça ${sm3(a.altPimKalca_m)} m` + (a.pimBedenBosluk_mm ? `, pim ↔ beden en az üst ${m3(a.pimBedenBosluk_mm.ust.min)} / alt ${m3(a.pimBedenBosluk_mm.alt.min)} mm` : "") +
    (a.kare ? `
    askı (${a.kare} kare): pim boşluğu en çok üst ${m3(a.pimBosluk_mm.ust.max)} / alt ${m3(a.pimBosluk_mm.alt.max)} mm; giriş en derin (>1 mm %): ` +
      Object.entries(a.giris_mm).map(([k, x]) => `${k} ${m3(x.max_mm)} (%${x.gt1mm_yuzde})`).join(", ") + `; boy oranı ${sm3(a.boyOrani)}` : `; ${a.durum}`));
  if (tr) L.push(tr.durum ? `  Tremolo kolu: ${tr.durum}` : `  Tremolo kolu (${tr.kare} kare): pena eline en az ${m3(tr.kolPenaEli_mm.min)} / p10 ${m3(tr.kolPenaEli_mm.p10)} mm (temas ${tr.kolPenaEli_mm.temas_kare}), ` +
    `penaya ${m3(tr.kolPena_mm.min)}, pena ön koluna ${m3(tr.kolPenaOnKol_mm.min)}, perde eline ${m3(tr.kolPerdeEli_mm.min)} mm; tele giriş ${m3(tr.kolTel_mm.max)}, gövdeye ${m3(tr.kolGovde_mm.max)} mm`);
  for (const [n, b] of [["Bükme", e.bukme], ["Vibrato", e.vibrato]]) if (b) L.push(b.kare ? `  ${n} (${b.nota} nota, ${b.kare} kare): beklenen itme med ${m3(b.beklenen_mm.med)} / max ${m3(b.beklenen_mm.max)} mm, çizilen tel med ${m3(b.tel_mm.med)} / max ${m3(b.tel_mm.max)} mm, ` +
    `tel hatası med ${m3(b.telHata_mm.med)} / p90 ${m3(b.telHata_mm.p90)} mm; parmak ↔ çizilen tel med ${m3(b.parmakTel_mm.med)} / p90 ${m3(b.parmakTel_mm.p90)} mm, parmak ↔ beklenen tel med ${m3(b.parmakBeklenen_mm.med)} / p90 ${m3(b.parmakBeklenen_mm.p90)} mm` : `  ${n}: yok`);
}
if (e){
  L.push(`  El kullanımı: perde ${e.elKullanimi.perdeEli}, pena ${e.elKullanimi.penaEli}, sap ${e.elKullanimi.sapYonu} → ${e.elKullanimi.ozet}`);
  for (const [n, a] of [["Perde eli", e.perde], ["Pena eli ", e.pena]])
    L.push(`  ${n} (kol ${a.kol}, ${a.taraf}): hata med ${r3(a.hata_cm.med)} / p90 ${r3(a.hata_cm.p90)} / max ${r3(a.hata_cm.max)} cm, erişim dışı %${a.erisimDisi_yuzde}, dirsek med ${r3(a.dirsek_derece.med)}° ` +
      `[${Object.entries(a.dirsekDagilim_yuzde).map(([k, v]) => `${k}:${v}`).join(" ")}], sıçrama >5cm ${a.sicrama.gt5cm}, >10cm ${a.sicrama.gt10cm}, en büyük ${r3(a.sicrama.max_cm)} cm @${r3(a.sicrama.maxAt_sn)} sn`);
  L.push(`  Pena-tel (tek nota başlangıcı): uç med ${r3(e.penaTel_mm.med)} mm, p90 ${r3(e.penaTel_mm.p90)} mm; merkez med ${r3(e.penaTelMerkez_mm.med)} mm (${e.penaTel_mm.n} nota); ${e.kare} kare, ${e.basiliNotaKare} basılı notalı`);
  extraLines(e);
}
for (const [id, x] of Object.entries(res.ek || {})){
  if (x.el){ const a = x.el; L.push(`Şarkı ${id}: perde eli hata med ${r3(a.perde.hata_cm.med)} cm, erişim dışı %${a.perde.erisimDisi_yuzde}, sıçrama >10cm ${a.perde.sicrama.gt10cm}; pena-tel uç med ${r3(a.penaTel_mm.med)} mm; ${a.kare} kare`); extraLines(a); }
  if (x.ses) L.push(`  Ses ${id}: ${x.ses.ornek} örnek, özet ${x.ses.ozet}`);
}
for (const s of (res.ritim && res.ritim.bolumler) || []) L.push(`  Ritim ${s.ad} [${r3(s.aralik_sn[0])}-${r3(s.aralik_sn[1])} sn]: ` + (s.egim_pp_derece === undefined ? `ölçülen aralık dışında (${s.kare} kare)` :
  `kafa eğimi tepeden tepeye ${r3(s.egim_pp_derece)}°, nod ${r3(s.nod_hz)} Hz (eğim ${r3(s.egim_hz)} Hz${s.vurus_hz ? `, vuruş ${r3(s.vurus_hz)} Hz` : ""}), kafa yüksekliği ${r3(s.kafaY_pp_cm)} cm`));
if (res.kadraj){ const k = res.kadraj; L.push(`  Kadraj ${k.bolum} [${r3(k.aralik_sn[0])}-${r3(k.aralik_sn[1])} sn, ${k.kare} kare]: kafa kadrajda %${k.kafa_yuzde}, sap eli kadrajda %${k.sapEliKadrajda_yuzde}, alt bantta %${k.sapEliAltBant_yuzde}`); }
for (const [id, m] of Object.entries((res.muzik && res.muzik.sarkilar) || {})) L.push(`  Müzik ${id.padEnd(9)} ` + (m.vurgu ? `vurgu ${String(m.vurgu.n).padStart(3)} ${JSON.stringify(m.vurgu.tur)}, yoğunluk ${r3(m.yogunluk.min)}/${r3(m.yogunluk.med)}/${r3(m.yogunluk.max)}, ` : "") +
  `kesme |kare| med ${m.kesme.med} p90 ${m.kesme.p90} max ${m.kesme.max} (≤1 kare %${m.kesme.le1_yuzde}, ${m.kesme.n} kesme), ses programı ${m.ses.ozet}`);
for (const g of res.goruntu || []) L.push(`  Görüntü ${g.kare} (${g.env}, ${g.cam}, ${g.shot}): luma p5 ${g.luma_p5}, med ${g.luma_med}, tam beyaz %${g.tamBeyaz_yuzde}, doygunluk ${g.doygunluk}, 0-40 seviye ${g.karanlikSeviye}` +
  (g.govde && g.govde.piksel !== undefined ? `; gövde ${g.govde.piksel} px, ≥250 %${r3(g.govde.tamBeyaz250_yuzde)}, en parlak ${r3(g.govde.enParlak)}, p99 ${g.govde.p99}, flaş ${r3(g.govde.flas)}` : g.govde ? `; gövde ${g.govde}` : ""));
if (res.doku) L.push(res.doku.durum ? `  Doku: ${res.doku.durum}` : `  Doku determinizmi: ${res.doku.ayni ? "AYNI" : "FARKLI"}  ` + res.doku.dokular.map((d, i) => `${d.ad} ${d.w}×${d.h} ${d.ozet}/${res.doku.ikinci[i]}`).join("  "));
for (const d of res.determinizm || []) L.push(`  Determinizm ${d.kare}: ${d.ayni ? "AYNI" : "FARKLI"}  ${Object.entries(d).filter(([k]) => typeof d[k] === "object").map(([k, v]) => `${k} ${v.kare}/${v.durum}`).join("  ")}`);
if (res.ses) L.push(`  Ses: ${res.ses.ornek} örnek, özet ${res.ses.ozet}`);
if (res.meta.gl) L.push(`  Çizici: ${res.meta.gl}`);
if (ENVV.BASE && fs.existsSync(path.resolve(ROOT, ENVV.BASE))) L.push(`Taban → şimdi (${ENVV.BASE}):\n` + diffTable(JSON.parse(fs.readFileSync(path.resolve(ROOT, ENVV.BASE), "utf8")), JSON.parse(fs.readFileSync(OUT, "utf8"))));
console.log(L.join("\n"));
