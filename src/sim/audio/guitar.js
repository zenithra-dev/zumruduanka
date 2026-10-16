// Gitar sesi: Karplus-Strong tel modeli ve çalma teknikleri.
import { rand } from "../rng.js";
import { noteCurve } from "../music/bend.js";

// Tel modelinin ayarları (ses tasarımı için dışarıdan değiştirilebilir):
//   exciter: "pulse" → fiziksel pena vuruşu: manyetiğin gördüğü hız dalgası, pena konumuna göre dikdörtgen darbe (harmonikler düzenli, gitar gibi);
//            "noise" → klasik Karplus-Strong gürültü vuruşu (kanun/arp gibi, her nota farklı tını)
//   noise: darbeye katılan gürültü payı (pena sürtmesi)
//   dual: ikinci (yatay) polarizasyonun manyetikte görünen genliği, ana tele oranla (0 kapalı; manyetik yatayı yaklaşık on kat bastırır, ~0.1;
//         eksi: ters fazda algılanır, nota başta zayıf açılır)
//   dualCents: onun akort farkı, sent (eksi = pes). Ölçümlerde fark ~2 sent (etkin tel boyundan gelir); −10 kulakla seçildi (ses-gunlugu.md,
//              deneme 1): fiziksel değerden büyük, hafif bir çift tel canlılığı veriyor
//   dualDecay: onun tur başına kaybının ana tele oranı (1 aynı; solid-body'de iki düzlemin Q'su benzer, 1'den küçük daha uzun sürer)
//   Ana tel tam akortta kalır: zayıf ikinci çizgi kısa pencerede perdeyi çekmez (yüksek harmoniklerin çapraz terimleri döner).
//   pickupComb: manyetik konumu tarağı (0 kapalı); pickupPos: köprüden uzaklık, tel boyunun oranı
export const STRING = {exciter: "pulse", noise: 0.08, smooth: 1, dual: 0.1, dualCents: -10, dualDecay: 1, pickupComb: 0, pickupPos: 0.07};

export function createGuitar(engine){
  const { ctx } = engine, bufCache = {};
  // Tek bir tel: vuruş, pena konumu tarağı, kesirli gecikme (allpass) ve sönüm; out'a amp ile eklenir.
  // dual {g, nf, d}: ikinci polarizasyon aynı pena darbesi ve aynı sürtme gürültüsüyle başlar (tek temas iki düzlemi birlikte uyarır; rastgele
  // dizi dual'dan bağımsız kalır), kendi gecikmesi ve sönümüyle döner, manyetiğe g oranında yansır. İkisi birlikte normalize edilir.
  function ksLine(out, Nf, pp0, decay, amp, smooth, dual){
    const M = Math.max(3, Math.floor(Nf + 0.3)), N = M - 1, len = out.length, nz = new Float32Array(M);
    const pp = Math.max(1, Math.floor(N * (pp0 || 0.14)));
    let prev = 0, peak = 0;
    for (let i = 0; i < M; i++){ const r = rand() * 2 - 1; prev = prev * 0.45 + r * 0.55; nz[i] = prev; }
    // m örnek halka için vuruş. "pulse": üçgen yer değiştirmenin türevi, pena ile köprü arasında +, kalanda -; kenarlar bir iki örnek yumuşatılır
    function excite(m){
      const ex = new Float32Array(m), w = STRING.noise;
      if (STRING.exciter !== "pulse"){ for (let i = 0; i < m; i++) ex[i] = nz[i % M] - 0.85 * nz[(i - pp + M) % M]; return ex; }
      for (let i = 0; i < m; i++) ex[i] = (i < pp ? 1 - pp / m : -pp / m) * (1 - w) + nz[i % M] * w;
      for (let k = 0; k < smooth; k++){ let p = ex[m - 1]; for (let i = 0; i < m; i++){ const c = ex[i]; ex[i] = 0.5 * (c + p); p = c; } }
      return ex;
    }
    // Döngü gecikmesi: m örnek halka + iki nokta ortalamasının yarım örneği + ince akort allpass'ı (eta, 0.2..1.2 aralığında
    // tutulur ki allpass sıfıra yakın gecikmede kutup-sıfır iptaline düşmesin). Toplam tam olarak nf örnek.
    const tmp = new Float32Array(len);
    for (const [nf, d, k] of dual ? [[Nf, decay, 1], [dual.nf, dual.d, dual.g]] : [[Nf, decay, 1]]){
      const m = Math.max(3, Math.floor(nf + 0.3)), eta = nf + 0.5 - m, c = (1 - eta) / (1 + eta), ring = excite(m);
      let idx = 0, ap = 0, lastIn = 0;
      for (let i = 0; i < len; i++){
        const a = ring[idx], v = 0.5 * (a + ring[(idx + 1) % m]);   // tel sönümü: tiz harmonikler her turda biraz daha yumuşar
        const y = c * (v - ap) + lastIn; lastIn = v; ap = y;       // birinci derece allpass: kesirli gecikme, ince akort
        tmp[i] += k * a; ring[idx] = d * y; idx = (idx + 1) % m;
      }
    }
    // Manyetik konumu tarağı: köprüye yakın manyetik belli harmonikleri siler (twang)
    if (STRING.pickupComb > 0){ const D = Math.max(1, Math.round(N * STRING.pickupPos)); for (let i = len - 1; i >= D; i--) tmp[i] -= STRING.pickupComb * tmp[i - D]; }
    for (let i = 0; i < len; i++) if (Math.abs(tmp[i]) > peak) peak = Math.abs(tmp[i]);
    const g = amp / (peak || 1);
    for (let i = 0; i < len; i++) out[i] += tmp[i] * g;
  }
  // Nota tamponu: tel modeli, isteğe bağlı ikinci polarizasyon (birkaç sent pes, harmoniklerde yavaş vuruşma; avuç ikisini de söndürür).
  // mute: palm mute, avuç köprüde; tel her turda yüzde on kaybeder (çeyrek saniyede söner), vuruş daha koyu, tampon daha kısa.
  // Açık tel 6 sn: uzun tutulan notalar tampon bitince kesilmesin (3 sn iken ninninin arpej kökleri 3. saniyede tıkla kesiliyordu); son 0.1 sn söner.
  function ksBuffer(midi, pp0, key, mute){
    key = key || (midi + (mute ? "m" : ""));
    if (bufCache[key]) return bufCache[key];
    const sr = ctx.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), Nf = sr / f, len = Math.floor(sr * (mute ? 0.8 : 6.0));
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    const decay = mute ? 0.9 : 0.9988 - (midi - 40) * 0.000055;
    const dual = STRING.dual && !mute ? {g: STRING.dual, nf: Nf * Math.pow(2, -STRING.dualCents / 1200), d: Math.min(0.9998, Math.max(0, 1 - (1 - decay) * STRING.dualDecay))} : null;
    ksLine(out, Nf, pp0, decay, 0.55, STRING.smooth + (mute ? 2 : 0), dual);
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = 0.55 / (peak || 1);
    for (let i = 0; i < 64; i++) out[i] *= i / 64;
    for (let i = 0; i < len; i++) out[i] *= g;
    if (!mute){ const n = Math.floor(sr * 0.1); for (let i = 0; i < n; i++) out[len - 1 - i] *= i / n; }
    bufCache[key] = buf;
    return buf;
  }
  // Çalış teknikleri: bükme (bend, back), ön bükme (pre), lead tonda alttan kayma ve gecikmeli vibrato (vib) eğrisi music/bend.js noteCurve'den
  // (görsel aynı eğriyi okur); palm mute (e.m ya da kalın telde çok kısa nota) koyu ve kısa; legato (e.h) pena sesi yok, yumuşak atak; her vuruşa kısa pena sesi.
  function expressNote(src, g, e, t, dur, midi, srcs){
    const pr = src.playbackRate, ampName = engine.ampName, drive = ampName !== "clean", c = noteCurve(e, t, dur, ampName), muted = c.muted;
    for (const [k, v, at] of c.rate){ if (k) pr.linearRampToValueAtTime(v, at); else pr.setValueAtTime(v, at); }
    if (c.vib){
      const V = c.vib, lfo = ctx.createOscillator(), dep = ctx.createGain();
      lfo.frequency.value = V.hz; dep.gain.setValueAtTime(0, V.t0); dep.gain.setValueAtTime(0, V.a);
      dep.gain.linearRampToValueAtTime(V.depth, V.b);
      lfo.connect(dep); dep.connect(pr); lfo.start(V.t0); lfo.stop(V.stop); srcs.push(lfo);
    }
    if (muted){
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 750 + e.s * 150; lp.Q.value = 0.9;
      e.mute = lp;
    }
    if (!e.h){
      const ns = engine.noiseSrc(), hp = ctx.createBiquadFilter(), ng = ctx.createGain(), amt = (drive ? 0.05 : 0.08) * (e.v || 1);
      hp.type = "bandpass"; hp.frequency.value = 2600 + e.s * 300; hp.Q.value = 1.4;
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(amt, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
      ns.connect(hp); hp.connect(ng); ng.connect(g); ns.start(t, rand() * 0.5); ns.stop(t + 0.03); srcs.push(ns);
    }
  }
  return { ksBuffer, expressNote };
}
