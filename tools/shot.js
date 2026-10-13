// Tek kare ekran görüntüsü: mekan, kamera ve zaman seçilir, PNG yazılır. Hızlı göz kontrolü için.
//
//   SONG=kaf ENV=theater CAM=director T=12 OUT=out/shot.png node tools/shot.js
//   LIST=1 → yönetmenin çekim listesini de yazdırır. SONG boşsa şarkı yüklenmez (boş sahne).
import fs from "node:fs";
import path from "node:path";
import { openHarness, ROOT } from "./browser.js";

const SONG = process.env.SONG ?? "", ENV = process.env.ENV || "club", CAM = process.env.CAM || "group";
const T = +(process.env.T || 0), SEED = +(process.env.SEED || 1);
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "out/shot.png"));
fs.mkdirSync(path.dirname(OUT), {recursive: true});

const h = await openHarness();
const r = await h.page.evaluate(([SONG, ENV, CAM, T, SEED]) => {
  const off = new OfflineAudioContext(2, 44100 * 2, 44100); // yalnızca zamanlama için; ses üretilmez
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: off, manual: true, seed: SEED});
  sim.setEnv(ENV); sim.setCamera(CAM);
  if (SONG !== ""){ const song = sim.findSong(SONG); if (!song) throw new Error("Şarkı bulunamadı: " + SONG); sim.load(song); }
  sim.frame(T, T);
  const cv = Object.assign(document.createElement("canvas"), {width: 1280, height: 720});
  sim.composite(cv.getContext("2d"), 1280, 720);
  const p = sim.playing;
  return {png: cv.toDataURL("image/png"), hud: sim.hudLabel(), shots: p ? p.shots.map(s => [(s.t - p.t0).toFixed(1), s.who, s.kind, s.glide ? "G" : "", s.crane ? "C" : ""]) : []};
}, [SONG, ENV, CAM, T, SEED]);
fs.writeFileSync(OUT, Buffer.from(r.png.split(",")[1], "base64"));
console.log(r.hud, "→", OUT);
if (process.env.LIST) console.log(JSON.stringify(r.shots));
await h.close();
