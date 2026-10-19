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

// Kanade'nin beden dili (beden kolu kendi varyantını buraya yazar; vekil.js fig.groove = grooveKanade, rigs.life ve chainAt onu okur). v0: mankenin.
export const grooveKanade = groove;

// rigs.life'ın sayıları (zamanın saf fonksiyonu; mankende ve Kanade'de aynı, Kanade'nin chainAt'ı da bunu çağırır): üyenin gr(p, t) duruşu üç
// yerde okunur: kafa şimdiki anın, göğüs LAG sonrasının, pelvis 2·LAG sonrasının duruşunu alır. L = {br nefes, rx/rz/ry üst gövdenin eğimi,
// drop pelvisin inişi, nod kafanın eğimi, look kafanın yana dönüşü, spread ayakların açılması}.
export const LAG = 0.035;
const STILL = {lean: 0, bob: 0, head: 0, drop: 0, spread: 0};
export function lifeL(fig, wall, now, p, gr){
  const ph = fig.ph, br = Math.sin(wall * 1.55 + ph), sw = fig.sway;
  const H = gr ? gr(p, now) : STILL, C = gr ? gr(p, now + LAG) : STILL, P = gr ? gr(p, now + 2 * LAG) : STILL;
  return {br, rx: C.lean + C.bob + sw * 0.015 * Math.sin(wall * 0.41 + ph * 2), rz: sw * 0.022 * Math.sin(wall * 0.53 + ph), ry: sw * 0.03 * Math.sin(wall * 0.29 + ph * 3),
    drop: P.drop, nod: H.head, look: 0.16 * Math.sin(wall * 0.23 + ph) * Math.sin(wall * 0.11 + ph * 1.7), spread: P.spread};
}
