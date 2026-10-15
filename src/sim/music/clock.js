// Ritim saati ve müziğin görsel özeti: vuruş konumu, vurgular, yoğunluk. p = schedule()'ın döndürdüğü çalma (events, t0, bpm, beats?, end).
// Hepsi zamanın saf fonksiyonu: aynı (p, now) her zaman aynı sonucu verir, kare sırası ve geçmiş önemsizdir. Ağır kısım p başına
// bir kez hesaplanır (WeakMap), her kare yalnız ikili arama ve ara değerdir. p null ise (çalmıyor) boşta değerler döner.
const IDLE_BPM = 90;   // çalmıyorken boşta saat
const GROUP = 0.04;    // bu kadar içinde başlayan notalar tek vuruş (akor, oktav)
const GAP = 0.4;       // sessizlik: önceki notaların hepsi en az bu kadar önce bitmiş
const TAU = 0.25;      // vurgu zarfının sönme süresi (sn)
const DT = 0.05, SIG = 1.0;   // yoğunluk eğrisi: örnek aralığı ve Gauss penceresinin genişliği (sn, simetrik)

const cached = (fn, M = new WeakMap()) => p => { let v = M.get(p); if (!v) M.set(p, v = fn(p)); return v; };
const clamp01 = x => Math.min(1, Math.max(0, x));
// Etkin vuruş gücü: sesin kullandığı (playback.js): belirtilmemişse 1, legato 0.85
export const velOf = e => e.v ?? (e.h ? 0.85 : 1);
// Sıralı dizide t'si now'dan büyük olmayan son öğenin indeksi (yoksa -1)
function lastAt(A, now, key = x => x.t){ let lo = 0, hi = A.length; while (lo < hi){ const m = (lo + hi) >> 1; if (key(A[m]) <= now) lo = m + 1; else hi = m; } return lo - 1; }

/* ---------- Vuruş saati ---------- */
// Vuruş konumu (0 = şarkının ilk vuruşu, tamsayılar vuruş anları). p.beats (saniye) varsa aralarında doğrusal, uçlarda en yakın
// aralığın temposuyla uzatılır; yoksa sabit tempo: (now - t0) · bpm / 60. Faz: beatAt(p, now) % 1, ölçü: Math.floor(beatAt / 4).
export function beatAt(p, now){
  if (!p) return now * IDLE_BPM / 60;
  const B = p.beats;
  if (!B) return (now - p.t0) * p.bpm / 60;
  const k = Math.min(B.length - 2, Math.max(0, lastAt(B, now, x => x)));
  return k + (now - B[k]) / (B[k + 1] - B[k]);
}
// Tersi: vuruş konumunun zamanı (sn). Planlar vuruş/ölçü cinsinden kurulup zamana böyle çevrilir.
export function timeAt(p, beat){
  if (!p) return beat * 60 / IDLE_BPM;
  const B = p.beats;
  if (!B) return p.t0 + beat * 60 / p.bpm;
  const k = Math.min(B.length - 2, Math.max(0, Math.floor(beat)));
  return B[k] + (beat - k) * (B[k + 1] - B[k]);
}

/* ---------- Vuruşlar (nota başlangıçları) ---------- */
// Aynı anda (40 ms) başlayan notalar tek vuruş: {t, i: ilk olayın indeksi, n: nota sayısı, v: en güçlü etkin vuruş, m: palm mute, h: hepsi legato}
export const onsets = cached(p => {
  const ev = p.events, out = [];
  for (let i = 0; i < ev.length; ){
    let j = i, v = 0, m = false, h = true;
    while (j + 1 < ev.length && ev[j + 1].t - ev[i].t < GROUP) j++;
    for (let k = i; k <= j; k++){ v = Math.max(v, velOf(ev[k])); m = m || ev[k].m; h = h && ev[k].h; }
    out.push({t: ev[i].t, i, n: j - i + 1, v, m, h});
    i = j + 1;
  }
  return out;
});
// Bükmenin tepeye vardığı an (guitar.js expressNote ile aynı eğri: b0'dan başlar, en çok 0.18 sn'de çıkar)
export const bendPeak = e => { const d = e.end - e.t; return e.t + Math.min(0.08, d * 0.2) + Math.min(0.18, d * 0.4); };

/* ---------- Vurgular ---------- */
// Vurgu listesi {t, w, k}, zamana göre sıralı. w 0..1 ağırlık, k türü: "akor" (3+ tel, w = v), "sessizlik" (susuştan sonraki ilk
// vuruş, 0.9·v), "guclu" (şarkıda açıkça v ≥ 0.95, 0.6·v), "bukme" (bükmenin tepesi, 0.7·min(1, bend/2)). Bir vuruşta en ağır tür kalır.
export const accents = cached(p => {
  const ev = p.events, out = [];
  let lastEnd = -Infinity, ei = 0;
  for (const o of onsets(p)){
    while (ei < o.i) lastEnd = Math.max(lastEnd, ev[ei++].end);
    let w = 0, k = "", strong = false;
    for (let j = o.i; j < o.i + o.n; j++) if (ev[j].v !== null && ev[j].v !== undefined && ev[j].v >= 0.95) strong = true;
    const add = (x, kind) => { if (x > w){ w = x; k = kind; } };
    if (o.n >= 3) add(o.v, "akor");
    if (lastEnd < o.t - GAP) add(0.9 * o.v, "sessizlik");
    if (strong) add(0.6 * o.v, "guclu");
    if (w > 0) out.push({t: o.t, w, k});
  }
  for (const e of ev) if (e.bend > 0) out.push({t: bendPeak(e), w: 0.7 * Math.min(1, e.bend / 2), k: "bukme"});
  return out.sort((a, b) => a.t - b.t);
});
// Vurgu zarfı: yakın geçmişteki vurguların üstel sönen toplamı (τ = 0.25 sn), 1 - e^(-2s) ile 0..1'e sıkıştırılır.
// Tek tam vurgu ~0.86'ya çıkar; sık vurgular 1'e doyar. Önden hazırlık için accentAt(p, now + δ) kullanılabilir.
export function accentAt(p, now){
  if (!p) return 0;
  const A = accents(p);
  let s = 0;
  for (let k = lastAt(A, now); k >= 0 && now - A[k].t < TAU * 8; k--) s += A[k].w * Math.exp(-(now - A[k].t) / TAU);
  return 1 - Math.exp(-2 * s);
}

/* ---------- Yoğunluk ---------- */
// Her vuruş Gauss penceresiyle (σ = 1 sn, simetrik: yükseliş biraz önceden sezilir) dağıtılır; 0.05 sn'lik ızgarada:
// dens vuruş/sn, chord akor (2+ nota) oranı, vel ortalama etkin güç, mute palm mute oranı. Yoğunluk bunlardan:
// I = 0.5·(1 - e^(-dens/6)) + (1 - e^(-dens/1.5))·(0.15·chord + 0.35·vel - 0.2·mute), 0..1'e kırpılmış. Susuşta 0'a iner.
const table = cached(p => {
  const O = onsets(p), a = (O.length ? Math.min(O[0].t, p.t0) : p.t0) - 3 * SIG, N = Math.ceil((p.end + 3 * SIG - a) / DT) + 1;
  const W = new Float64Array(N), C = new Float64Array(N), V = new Float64Array(N), M = new Float64Array(N);
  const R = Math.ceil(3 * SIG / DT), norm = 1 / (SIG * Math.sqrt(2 * Math.PI));
  for (const o of O){
    const c = (o.t - a) / DT;
    for (let k = Math.max(0, Math.ceil(c - R)); k <= Math.min(N - 1, Math.floor(c + R)); k++){
      const x = (k - c) * DT, g = norm * Math.exp(-x * x / (2 * SIG * SIG));
      W[k] += g; C[k] += o.n >= 2 ? g : 0; V[k] += g * o.v; M[k] += o.m ? g : 0;
    }
  }
  const T = {a, N, I: new Float32Array(N), dens: new Float32Array(N), chord: new Float32Array(N), vel: new Float32Array(N), mute: new Float32Array(N)};
  for (let k = 0; k < N; k++){
    const d = W[k], r = d > 1e-6 ? 1 / d : 0, ch = C[k] * r, ve = V[k] * r, mu = M[k] * r;
    T.dens[k] = d; T.chord[k] = ch; T.vel[k] = ve; T.mute[k] = mu;
    T.I[k] = clamp01(0.5 * (1 - Math.exp(-d / 6)) + (1 - Math.exp(-d / 1.5)) * (0.15 * ch + 0.35 * ve - 0.2 * mu));
  }
  return T;
});
const sample = (T, A, now) => { const x = Math.min(T.N - 1, Math.max(0, (now - T.a) / DT)), k = Math.min(T.N - 2, Math.floor(x)); return A[k] + (A[k + 1] - A[k]) * (x - k); };
// Yoğunluk 0..1 (sakin, seyrek, palm mute → düşük; sık, akorlu, güçlü → yüksek)
export function intensity(p, now){ return p ? sample(table(p), table(p).I, now) : 0; }
// Yoğunluğun bileşenleri, aynı pencereyle: {dens: vuruş/sn, chord, vel, mute} (oranlar 0..1)
export function texture(p, now){
  if (!p) return {dens: 0, chord: 0, vel: 0, mute: 0};
  const T = table(p);
  return {dens: sample(T, T.dens, now), chord: sample(T, T.chord, now), vel: sample(T, T.vel, now), mute: sample(T, T.mute, now)};
}
