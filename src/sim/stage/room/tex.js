// Oda dokusu yardımcıları: tembel kanvas dokusu (oda ilk kez çizilmeden önce boyanır: kulüp kurulumu bedelini ödemez) ve lineer → sRGB tablosu.
import { canvasTexture } from "../canvas-tex.js";

// Lineer (0..1) → sRGB 8 bit, tablodan (piksel başına pow yok)
const SRGB = Uint8Array.from({length: 8192}, (_, i) => { const x = i / 8191; return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); });
export const srgb8 = x => SRGB[x <= 0 ? 0 : x >= 1 ? 8191 : (x * 8191 + 0.5) | 0];
export const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

// Yazı tipsiz kanvas dokusu: tuval tex.paint() çağrılana dek boş, sonra bir kez çizilir (saf: ne zaman çizilirse aynı pikseller)
export function lazyTexture(w, h, draw, o = {}){
  let on = false;
  const tex = canvasTexture(w, h, (g, W, H) => { if (on) draw(g, W, H); }, {...o, fonts: false});
  tex.paint = () => {
    if (on) return; on = true;
    const j = tex.canvasJob, g = j.cv.getContext("2d"); g.clearRect(0, 0, w, h); g.save(); j.draw(g, w, h); g.restore(); tex.needsUpdate = true;
  };
  return tex;
}
