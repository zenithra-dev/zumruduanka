// Bir şarkıyı videoya çeker: ses OfflineAudioContext ile WAV'a, kareler JPEG'e. ffmpeg birleştirmesini runall.sh yapar.
//
//   SONG=kaf node tools/render.js          # şarkı indeksi ya da id
//   W=1 N=3 ...                            # 3 işçiden 2.si: kareleri paylaşır (i % N === W)
//   SEED=7 ... FPS=30 ... DUR=95 ...       # tohum, kare hızı, ses tamponu (sn)
//   OUT=out/work ... AUDIO_ONLY=1 ... T0=20 T1=21 (yalnızca bu saniyeler)
//
// Çekim planı: kaf, ninni ve tepegoz için elle yazılmış liste; diğer şarkılar sayfadaki otomatik yönetmenle çekilir.
import fs from "node:fs";
import path from "node:path";
import { openHarness, ROOT, slug } from "./browser.js";

const SR = 44100, FPS = +(process.env.FPS || 30);
const SONG = process.env.SONG || "0", W = +(process.env.W || 0), N = +(process.env.N || 1), SEED = +(process.env.SEED || 1), DUR = +(process.env.DUR || 95);
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "out/work"));
fs.mkdirSync(path.join(OUT, "frames"), {recursive: true});

const h = await openHarness();
const { page } = h;
const info = await page.evaluate(async ([SR, SONG, SEED, DUR]) => {
  const off = new OfflineAudioContext(2, SR * DUR, SR);
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED});
  const song = sim.findSong(SONG);
  if (!song) throw new Error("Şarkı bulunamadı: " + SONG);
  sim.load(song);
  const end = sim.playing.end;
  const buf = await off.startRendering();
  const peak = window.peakOf(buf), g = peak > 0 ? 0.89 / peak : 1;
  return {end, peak, wav: window.encodeWav(buf, g), id: song.id, name: song.name};
}, [SR, SONG, SEED, DUR]);
if (W === 0){
  fs.writeFileSync(path.join(OUT, "audio.wav"), Buffer.from(info.wav, "base64"));
  fs.writeFileSync(path.join(OUT, "name.txt"), "zumruduanka-" + slug(info.name));
}
console.log("şarkı", info.id, "bitiş", info.end.toFixed(2), "sn, tepe", info.peak.toFixed(3), "tohum", SEED);
if (process.env.AUDIO_ONLY){ await h.close(); process.exit(0); }

const total = Math.ceil((info.end + 1.0) * FPS);
// T0/T1 (sn): yalnızca bu aralıktaki kareler (hata ayıklama ve kısmi yeniden çekim için)
const i0 = process.env.T0 ? Math.floor(+process.env.T0 * FPS) : 0, i1 = process.env.T1 ? Math.min(total, Math.ceil(+process.env.T1 * FPS)) : total;
for (let i = i0; i < i1; i++){
  if (i % N !== W) continue;
  const t = i / FPS;
  const url = await page.evaluate(([t, id]) => {
    const sim = window.sim, G = sim.cams.group, sm = x => x * x * (3 - 2 * x);
    const shot = (pos, look) => { sim.setCamera("group"); G.position.set(...pos); G.lookAt(...look); };
    const wide = u => shot([0.1 - 0.4 * u, 0.55, 5.0 - 0.6 * u], [0, 0.1, -0.8]);
    const orbitW = (u, a0, a1) => { const a = a0 + (a1 - a0) * u; shot([Math.sin(a) * 3.8, 0.65, -0.6 + Math.cos(a) * 3.8], [0, 0.05, -0.8]); };
    const SH = u => shot([-0.2 + 0.1 * u, 0.75, 2.0 - 0.15 * u], [-0.7, 0.6, 0.45]);
    const ER = u => shot([-0.95 - 0.15 * u, 0.35, -0.35], [-1.75, 0.0, -1.45]);
    const UM = u => shot([0.5 + 0.2 * u, 0.5, 1.5 - 0.2 * u], [1.5, 0.25, -0.75]);
    const UL = u => shot([0.4 + 0.1 * u, 0.8, -0.3], [0.95, 0.55, -2.0]);
    const ST = u => { sim.setCamera("stage"); sim.orbit.theta = -0.5 + u * 0.6; sim.orbit.r = 1.3; sim.orbit.phi = 1.3; sim.placeCams(); };
    const outro = k0 => u => { const k = sm(Math.min(1, u * k0)); shot([0, 0.5 + 0.5 * k, 4.0 + 2.0 * k], [0, 0.15, -0.9]); };
    const PLANS = {
      kaf: [[0,5,"head"],[5,10,wide],[10,15,SH],[15,20,u=>orbitW(u,-0.3,0.1)],[20,25,UL],[25,30,UM],[30,35,u=>orbitW(u,0.35,-0.35)],[35,40,ER],[40,45,SH],[45,50,u=>wide(1-u)],
            [50,55,ST],[55,60,"head"],[60,66,u=>orbitW(u,-0.4,0.4)],[66,71,SH],[71,76,ER],[76,80,UM],[80,999,outro(3)]],
      tepegoz: [[0,6.4,wide],[6.4,12,"head"],[12,17,ER],[17,19.2,u=>orbitW(u,-0.3,0.2)],[19.2,25.6,u=>orbitW(u,0.4,-0.4)],[25.6,32,ST],[32,38.4,"head"],[38.4,42.6,UM],[42.6,46.8,UL],[46.8,51.2,ER],[51.2,999,outro(2.5)]],
      ninni: [[0,10,"head"],[10,18,wide],[18,26,SH],[26,34,UL],[34,42,UM],[42,50,u=>orbitW(u,-0.4,0.4)],[50,58,SH],[58,66,ST],[66,74,"head"],[74,999,outro(2)]]
    };
    const plan = PLANS[id];
    if (plan){
      const seg = plan.find(x => t >= x[0] && t < x[1]) || plan[plan.length - 1];
      if (seg[2] === "head") sim.setCamera("head"); else seg[2]((t - seg[0]) / (seg[1] - seg[0]));
    } else sim.setCamera("director");
    sim.frame(t, t);
    const cv = window.__rec || (window.__rec = Object.assign(document.createElement("canvas"), {width: 1280, height: 720}));
    sim.composite(cv.getContext("2d"), 1280, 720);
    return cv.toDataURL("image/jpeg", 0.92);
  }, [t, info.id]);
  fs.writeFileSync(path.join(OUT, "frames", `f${String(i).padStart(4, "0")}.jpg`), Buffer.from(url.split(",")[1], "base64"));
  if (i % 60 === 0) console.log("kare", i, "/", total);
}
await h.close();
