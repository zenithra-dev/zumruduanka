// Kanvas dokuları: tuval, sRGB CanvasTexture, anizotropi, tekrar. Yazı tipi kullanan doku yalnız vendor yazı tipleri (src/vendor/fonts)
// yüklendikten sonra çizilir: render işçileri farklı anda başlar, yedek yazı tipiyle çizilen doku kareleri bozar. Yazı tipi hazır değilse
// çizim bekletilir (texPending > 0), yüklenince çizilir; araçlar kareden önce whenTexReady'yi bekler (sim.whenReady), sayfa yüklenince bekler.
import * as THREE from "three";

// Dokularda kullanılabilen yazı tipleri (fonts.css'tekiler): [kalınlık, aile]. Örnek metin latin ve latin-ext altkümelerinin ikisini de yükletir.
export const FONTS = [[800, "Big Shoulders Display"], [700, "Big Shoulders Display"], [400, "Figtree"], [500, "Figtree"], [600, "Figtree"], [500, "JetBrains Mono"]];
export const FACE = {display: "'Big Shoulders Display', 'Arial Narrow', sans-serif", body: "Figtree, sans-serif", mono: "'JetBrains Mono', monospace"};
const SAMPLE = "ZÜMRÜDÜANKA Ağıt Kaf Dağı Tepegöz şğıöçü İĞŞ 0123";
const hasFonts = () => typeof document !== "undefined" && !!document.fonts;
const faces = ([w, f]) => [...document.fonts].filter(x => x.family.replace(/["']/g, "") === f && String(x.weight) === String(w));

// Senkron: listedeki her ailenin her kalınlığının bütün altkümeleri yüklü mü (aile hiç tanımlı değilse hazır sayılmaz)
export function fontsReady(){ return hasFonts() && FONTS.every(s => { const F = faces(s); return F.length > 0 && F.every(x => x.status === "loaded"); }); }

const pending = [];
let loading = null;
// Yazı tiplerini yükletir; hazır olunca bekleyen dokuları çizer. ms içinde olmazsa false (bir kez denenir, sonuç saklanır).
export function loadFonts(ms = 15000){
  if (!hasFonts()) return Promise.resolve(false);
  if (fontsReady()){ paintPending(); return Promise.resolve(true); }
  if (!loading) loading = (async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms){
      try { await Promise.all(FONTS.map(([w, f]) => document.fonts.load(`${w} 20px '${f}'`, SAMPLE))); } catch (e){}
      if (fontsReady()){ paintPending(); return true; }
      await new Promise(r => setTimeout(r, 50));
    }
    return false;
  })();
  return loading;
}
export const texPending = () => pending.length;
export function whenTexReady(ms = 15000){
  if (!pending.length) return Promise.resolve();
  return loadFonts(ms).then(ok => { if (!ok || pending.length) throw new Error("kanvas dokuları çizilemedi: yazı tipleri yüklenmedi (src/vendor/fonts)"); });
}

function paint(job){
  const g = job.cv.getContext("2d");
  g.clearRect(0, 0, job.cv.width, job.cv.height); g.save(); job.draw(g, job.cv.width, job.cv.height); g.restore();
  job.withFonts = fontsReady(); job.tex.needsUpdate = true;
}
function paintPending(){ while (pending.length) paint(pending.shift()); }

// draw(g, w, h) tuvale çizer. o: {ad, fonts (false: yazı tipi kullanmıyor, hemen çizilir), anisotropy, repeat: [x, y]}.
// Dokunun canvasJob alanı {ad, cv, fonts, withFonts} (ölçüm: piksel özeti ve yazı tipiyle mi çizildi; r128 Texture'da userData yok).
export function canvasTexture(w, h, draw, o = {}){
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = o.anisotropy || 1;
  if (o.repeat){ tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(o.repeat[0], o.repeat[1]); }
  const job = {ad: o.ad || "doku", cv, tex, draw, fonts: o.fonts !== false, withFonts: null};
  tex.canvasJob = job;
  if (!job.fonts || fontsReady()) paint(job);
  else { pending.push(job); loadFonts(); }
  return tex;
}
