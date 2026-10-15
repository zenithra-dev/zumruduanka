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
// Durumu sakla/geri al: rastgelelik tüketen bir hesabı (ör. şarkı süresi) diziyi bozmadan yapmak için
export function getState(){ return state; }
export function setState(s){ state = s | 0; }
// Durumsuz rastgelelik: (i, salt) → [0,1), rand() akışına dokunmaz (ses aynı kalır). Sahne ve yönetmen çeşitliliği bununla üretilir.
// i tamsayı (çekim, kişi, kıvılcım sırası), salt sayı ya da kısa metin ("titreme"); aynı girdi her zaman aynı sayıyı verir.
const mix = x => { x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return x ^ (x >>> 16); };
export function hash01(i, salt = 0){
  let s = salt | 0;
  if (typeof salt === "string"){ s = 0x811c9dc5; for (let k = 0; k < salt.length; k++) s = Math.imul(s ^ salt.charCodeAt(k), 16777619); }
  return (mix((mix(s ^ 0x9e3779b9) + (i | 0)) | 0) >>> 0) / 4294967296;
}
