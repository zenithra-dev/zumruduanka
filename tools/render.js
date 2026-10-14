// Bir şarkıyı videoya çeker: ses OfflineAudioContext ile WAV'a, kareler PNG'ye (kayıpsız). ffmpeg birleştirmesini runall.sh yapar.
// Kamera sayfadaki yönetmendir: şarkının kendi çekim listesi varsa onu, yoksa otomatik planı uygular.
// Kareler yayın görünümündedir: HUD yok, alt bant yalnız ilk çekimde, başta siyahtan açılma, sonda kararma (sim.js VIDEO).
//
//   SONG=kaf node tools/render.js          # şarkı indeksi ya da id
//   W=1 N=3 ...                            # 3 işçiden 2.si: kareleri paylaşır (i % N === W); sesi yalnızca W=0 yazar
//   SEED=7 ... FPS=30 ...                  # tohum, kare hızı
//   OUT=out/work ... AUDIO_ONLY=1 ... T0=20 T1=21 (yalnızca bu saniyeler)
//   IMG=jpg ...                            # PNG yerine JPEG 0.98 (daha küçük, bir kayıplı adım fazla)
//   HUD=1 ...                              # önizleme görünümü: geliştirme HUD'u ve sabit alt bant (hata ayıklama)
//   NO_AUDIO=1 ...                         # ses yazılmaz (yalnız kare kontrolü; video için ses gerekir)
import fs from "node:fs";
import path from "node:path";
import { openHarness, ROOT, slug } from "./browser.js";

const SR = 44100, FPS = +(process.env.FPS || 30);
const SONG = process.env.SONG || "0", W = +(process.env.W || 0), N = +(process.env.N || 1), SEED = +(process.env.SEED || 1);
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "out/work"));
const JPG = process.env.IMG === "jpg", EXT = JPG ? "jpg" : "png", HUD = !!process.env.HUD;
fs.mkdirSync(path.join(OUT, "frames"), {recursive: true});

const h = await openHarness();
const { page } = h;
const info = await page.evaluate(async ([SR, SONG, SEED, wantAudio]) => {
  const song = window.findSong(SONG);
  if (!song) throw new Error("Şarkı bulunamadı: " + SONG);
  const off = new OfflineAudioContext(2, Math.ceil(SR * (window.songLength(song) + 1)), SR);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED});
  sim.setCamera("director"); sim.load(song);
  const out = {end: sim.playing.end, videoEnd: sim.videoEnd(), id: song.id, name: song.name, shots: sim.playing.shots.length, peak: 0, wav: null};
  if (wantAudio){ const buf = await off.startRendering(); out.peak = window.peakOf(buf); out.wav = window.encodeWav(buf, out.peak > 0 ? 0.89 / out.peak : 1); }
  return out;
}, [SR, SONG, SEED, W === 0 && !process.env.NO_AUDIO]);
if (info.wav){
  fs.writeFileSync(path.join(OUT, "audio.wav"), Buffer.from(info.wav, "base64"));
  fs.writeFileSync(path.join(OUT, "name.txt"), "zumruduanka-" + slug(info.name));
  console.log("ses yazıldı, tepe", info.peak.toFixed(3));
}
console.log("şarkı", info.id, "bitiş", info.end.toFixed(2), "sn,", info.shots, "çekim, tohum", SEED);
if (process.env.AUDIO_ONLY){ await h.close(); process.exit(0); }

const total = Math.ceil(info.videoEnd * FPS);
// T0/T1 (sn): yalnızca bu aralıktaki kareler (hata ayıklama ve kısmi yeniden çekim için)
const i0 = process.env.T0 ? Math.floor(+process.env.T0 * FPS) : 0, i1 = process.env.T1 ? Math.min(total, Math.ceil(+process.env.T1 * FPS)) : total;
for (let i = i0; i < i1; i++){
  if (i % N !== W) continue;
  const t = i / FPS;
  const url = await page.evaluate(([t, JPG, HUD]) => {
    const sim = window.sim; sim.frame(t, t);
    const cv = window.__rec || (window.__rec = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}));
    sim.composite(cv.getContext("2d"), 1280, 720, HUD ? {} : {broadcast: true, t});
    return JPG ? cv.toDataURL("image/jpeg", 0.98) : cv.toDataURL("image/png");
  }, [t, JPG, HUD]);
  fs.writeFileSync(path.join(OUT, "frames", `f${String(i).padStart(4, "0")}.${EXT}`), Buffer.from(url.split(",")[1], "base64"));
  if (i % 60 === 0) console.log("kare", i, "/", total);
}
await h.close();
