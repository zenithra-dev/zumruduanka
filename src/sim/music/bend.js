// Bükme ve vibrato: notanın perdesinin zamanla eğrisi. Ses (audio/guitar.js expressNote) eğriyi buradan kurar, görsel aynı eğriyi okur.
// Hepsi saf: rastgelelik yok, aynı (olay, an) her zaman aynı sonucu verir.
import { L, pressX } from "./theory.js";

// Ses tarafının eğrisi. e: şarkının nota olayı ({s, f, b, bend, pre, back, vib, inChord, h, m}), t başlangıç ve dur süre (sn), amp amfi adı.
// → {muted, rate, vib}
//   muted: ses palm mute çalar (e.m ya da sürüşlü amfide kalın telde çok kısa nota)
//   rate: playbackRate otomasyonu, sırasıyla uygulanır: [0, v, an] setValueAtTime, [1, v, an] linearRampToValueAtTime
//     pre: tel bükülü vurulur, b0 + 0.1'den sonra aşağı bırakılır; bend: b0'dan tepeye çıkar, back ile notanın %55'inden sonra geri iner;
//     lead tonda bazı uzun tek notalar 0.3 yarım ses alttan kayarak gelir
//   vib: sinüs LFO playbackRate'e eklenir ({hz, t0: başlangıç (faz 0), a, b: derinlik a'da 0'dan b'de depth'e doğrusal, stop}) ya da null
export function noteCurve(e, t, dur, amp){
  const drive = amp !== "clean", muted = !!e.m || (drive && e.s <= 2 && dur <= 0.22 && !e.h);
  const b0 = t + Math.min(0.08, dur * 0.2), top = Math.pow(2, (e.pre || e.bend || 0) / 12), rate = [];
  if (e.pre) rate.push([0, top, t], [0, top, b0 + 0.1], [1, 1, b0 + 0.1 + Math.min(0.35, dur * 0.4)]);
  else if (e.bend){
    const up = b0 + Math.min(0.18, dur * 0.4);
    rate.push([0, 1, b0], [1, top, up]);
    if (e.back){ const r = Math.max(up, t + dur * 0.55); rate.push([0, top, r], [1, 1, r + Math.max(0.15, dur * 0.3)]); }
  }
  else if (amp === "lead" && dur >= 0.4 && !e.inChord && (e.s * 7 + e.f * 3 + Math.round(e.b * 4)) % 3 === 0) rate.push([0, Math.pow(2, -0.3 / 12), t], [1, 1, t + 0.04]);
  // Vibrato yalnız tek notalarda (akorun telleri birbirine karşı kaymasın); geç başlar, yavaş derinleşir, hızı notadan notaya biraz değişir
  let vib = null;
  if (!e.inChord && !muted && dur >= (amp === "lead" ? 0.42 : 0.8))
    vib = {hz: (amp === "clean" ? 4.6 : 5.0) + ((e.s * 3 + e.f) % 5) * 0.08 - (e.vib > 1 ? 0.5 : 0), t0: t, a: t + 0.3, b: t + Math.min(dur, 0.9),
      depth: (amp === "lead" ? 0.006 : 0.004) * (e.vib || 1), stop: t + dur + 0.3};
  return {muted, rate, vib};
}

// Çalınan olayın (playback.js events: t, dur, amp alanlarıyla) eğrisi; olay başına bir kez hesaplanır
const CURVES = new WeakMap();
export function curveOf(e){
  let c = CURVES.get(e);
  if (!c) CURVES.set(e, c = noteCurve(e, e.t, e.dur ?? e.end - e.t, e.amp || "crunch"));
  return c;
}
// Otomasyonun now anındaki değeri (Web Audio kuralı: ilk olaydan önce 1, set sonraki olaya kadar tutulur, rampa önceki olaydan başlar)
export function rateAt(rate, now){
  let v = 1, pt = -Infinity;
  for (const [k, x, at] of rate){
    if (at <= now){ v = x; pt = at; continue; }
    return k && pt > -Infinity ? v + (x - v) * (now - pt) / (at - pt) : v;
  }
  return v;
}
// Vibrato derinliği (playbackRate'e eklenen oranın genliği) ve LFO'nun anlık değeri
const vibDepth = (V, now) => !V || now < V.a || now >= V.stop ? 0 : now >= V.b ? V.depth : V.depth * (now - V.a) / (V.b - V.a);
const vibSin = (V, now) => Math.sin(2 * Math.PI * V.hz * (now - V.t0));
// Sesin anlık perde sapması (yarım ses): bükme + vibrato + alttan kayma, sesle aynı eğri ve aynı vibrato fazı
export function pitchAt(e, now){
  const c = curveOf(e), V = c.vib;
  return 12 * Math.log2(rateAt(c.rate, now) + (V ? vibDepth(V, now) * vibSin(V, now) : 0));
}
// Yalnız bükme (vibratosuz, yarım ses)
export const bendAt = (e, now) => 12 * Math.log2(rateAt(curveOf(e).rate, now));

/* ---------- Telin yana itilmesi ---------- */
// Perde oranı r için gereken yana itme: gerilim r² kat, uzama itmenin karesiyle büyür → itme ∝ √(r² − 1). Tam ses (r = 2^(1/6)) BEND_TONE
// kadar; basma noktası tel boyunun ortasından uzaklaştıkça biraz azalır (2√(u(1−u)): 12. perdede 1, 3. perdede 0.73).
// Vibrato görselde yalnız yukarı iter: sesin simetrik sinüsü (r ± derinlik) tel için r + derinlik·(1 + sin) olur; tepe ve faz sesle aynı.
// Ön bükmede (pre) tel nota başından PRE_IN sn önce sessizce itilmeye başlar; nota bitince REL sn'de bırakılır.
export const BEND_TONE = 0.0075, PRE_IN = 0.15, REL = 0.1;
const R2 = Math.pow(2, 1 / 3) - 1, sm = u => u * u * (3 - 2 * u);
const push = (r, x) => { const u = x / L; return BEND_TONE * 2 * Math.sqrt(Math.max(0, u * (1 - u))) * Math.sqrt(Math.max(0, r * r - 1) / R2); };
// Bükme yönü (gitar çerçevesinin y'si, + kalın E tarafı): tiz tellerde (G, B, e) kalın tellere doğru, kalın tellerde (E, A, D) tiz tellere doğru
export const bendDir = s => s >= 3 ? 1 : -1;
// Basma noktasında telin yana itilmesi (metre, işaretli: gitar y'si). Açık telde 0.
export function bendDisplacement(e, now){
  if (!(e.f > 0) || now < e.t - PRE_IN || now > e.end + REL) return 0;
  const x = pressX(e.f);
  if (now < e.t) return e.pre ? bendDir(e.s) * push(Math.pow(2, e.pre / 12), x) * sm(Math.min(1, (now - e.t + PRE_IN) / (PRE_IN - 0.03))) : 0;
  const c = curveOf(e), V = c.vib, d = V ? vibDepth(V, now) : 0;
  const r = rateAt(c.rate, now) + (d ? d * (1 + vibSin(V, now)) : 0), k = now > e.end ? 1 - sm((now - e.end) / REL) : 1;
  return bendDir(e.s) * push(r, x) * k;
}
// Bükülen telin boyunca itmenin payı (0..1): eşikte ve köprüde 0, basma noktası xp'de 1, aralarında doğrusal
export const bendShape = (xp, x) => x <= 0 || x >= L ? 0 : x <= xp ? x / xp : (L - x) / (L - xp);
