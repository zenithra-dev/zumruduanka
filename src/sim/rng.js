// Tohumlu rastgele sayı üreteci (mulberry32).
// Simülasyondaki tüm rastgelelik buradan geçer: aynı tohum → aynı sahne, aynı kayıt, aynı kareler.
let state = 1;
export function seed(n){ state = (Number(n) >>> 0) || 1; }
export function rand(){
  state = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
