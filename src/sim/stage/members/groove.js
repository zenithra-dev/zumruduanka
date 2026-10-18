// Beden dili: müziğin o anki hali → duruş {lean: göğsün öne eğimi, bob: vuruşla eğilme, head: kafanın gövdeye göre öne eğimi, drop: pelvisin
// inişi, spread: ayakların açılması}. rigs.life kafayı, göğsü ve pelvisi bunu farklı t'lerde okuyarak birbirine gecikmeyle bağlar. Vuruş dalgası:
// vuruşun son %30'unda hızla iner (vuruşta dipte), kalan %70'te yavaşça kalkar; kafa boyundan döner. Yoğunluk düşükken küçük nod; palm mute öne
// eğik ve çömelik duruş; yoğunluk doruğa çıktıkça headbang ve geniş duruş. Kafa duruştan gelen eğilmenin GAZE kadarını geri alır (bakış öne).
import { beatAt, intensity, texture } from "../../music/clock.js";

const DOWN = 0.3, GAZE = 0.6, LEAN0 = 0.04, STAND = {lean: LEAN0, bob: 0, head: 0, drop: 0, spread: 0};
const sm = u => u * u * (3 - 2 * u);
const wave = ph => ph < 1 - DOWN ? 0.5 + 0.5 * Math.cos(Math.PI * ph / (1 - DOWN)) : 0.5 - 0.5 * Math.cos(Math.PI * (ph - 1 + DOWN) / DOWN);
const cl01 = x => Math.min(1, Math.max(0, x));
export function groove(p, t){
  if (!p) return STAND;
  const x = texture(p, t), g = sm(cl01((intensity(p, t) - 0.3) / 0.45)), b = beatAt(p, t), w = cl01(x.dens / 1.5) * wave(b - Math.floor(b));
  const lean = LEAN0 + 0.07 * x.mute + 0.02 * g;
  return {lean, bob: (0.01 + 0.045 * g) * w, head: (0.04 + 0.43 * g) * w - GAZE * (lean - LEAN0), drop: 0.03 * x.mute + 0.025 * g + (0.004 + 0.016 * g) * w, spread: 0.1 * g};
}
