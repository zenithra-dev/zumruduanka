// Gitar sesi: Karplus-Strong tel modeli ve çalma teknikleri.
import { rand } from "../rng.js";

// Tel modelinin ayarları (ses tasarımı için dışarıdan değiştirilebilir):
//   exciter: "pulse" → fiziksel pena vuruşu: manyetiğin gördüğü hız dalgası, pena konumuna göre dikdörtgen darbe (harmonikler düzenli, gitar gibi);
//            "noise" → klasik Karplus-Strong gürültü vuruşu (kanun/arp gibi, her nota farklı tını)
//   noise: darbeye katılan gürültü payı (pena sürtmesi); dual: ikinci polarizasyon seviyesi (0 kapalı); dualDetune: onun akort farkı
//   pickupComb: manyetik konumu tarağı (0 kapalı); pickupPos: köprüden uzaklık, tel boyunun oranı
export const STRING = {exciter: "pulse", noise: 0.08, smooth: 1, dual: 0, dualDetune: 0.0003, pickupComb: 0, pickupPos: 0.07};

export function createGuitar(engine){
  const { ctx } = engine, bufCache = {};
  // Tek bir tel: vuruş, pena konumu tarağı, kesirli gecikme (allpass) ve sönüm; out'a amp ile eklenir
  function ksLine(out, Nf, pp0, decay, amp, smooth){
    // Döngü gecikmesi: M örnek halka + iki nokta ortalamasının yarım örneği + ince akort allpass'ı (eta, 0.2..1.2 aralığında
    // tutulur ki allpass sıfıra yakın gecikmede kutup-sıfır iptaline düşmesin). Toplam tam olarak Nf = sr / f.
    const M = Math.max(3, Math.floor(Nf + 0.3)), eta = Nf + 0.5 - M, N = M - 1, len = out.length;
    const ring = new Float32Array(M), ex = new Float32Array(M);
    const pp = Math.max(1, Math.floor(N * (pp0 || 0.14)));
    let prev = 0;
    for (let i = 0; i < M; i++){ const r = rand() * 2 - 1; prev = prev * 0.45 + r * 0.55; ex[i] = prev; }
    if (STRING.exciter === "pulse"){
      // Üçgen yer değiştirmenin türevi: pena ile köprü arasında +, kalanda -; kenarlar bir iki örnek yumuşatılır
      const w = STRING.noise;
      for (let i = 0; i < M; i++){ const v = i < pp ? (1 - pp / M) : -(pp / M); ex[i] = v * (1 - w) + ex[i] * w; }
      for (let k = 0; k < smooth; k++){ let p = ex[M - 1]; for (let i = 0; i < M; i++){ const c = ex[i]; ex[i] = 0.5 * (c + p); p = c; } }
      for (let i = 0; i < M; i++) ring[i] = ex[i];
    } else {
      for (let i = 0; i < M; i++) ring[i] = ex[i] - 0.85 * ex[(i - pp + M) % M];
    }
    let idx = 0, peak = 0, ap = 0, lastIn = 0;
    const c = (1 - eta) / (1 + eta), tmp = new Float32Array(len);
    for (let i = 0; i < len; i++){
      const a = ring[idx], b = ring[(idx + 1) % M];
      const v = 0.5 * (a + b);                       // tel sönümü: tiz harmonikler her turda biraz daha yumuşar
      const y = c * (v - ap) + lastIn; lastIn = v; ap = y;   // birinci derece allpass: kesirli gecikme, ince akort
      tmp[i] = a;
      ring[idx] = decay * y;
      idx = (idx + 1) % M;
    }
    // Manyetik konumu tarağı: köprüye yakın manyetik belli harmonikleri siler (twang)
    if (STRING.pickupComb > 0){ const D = Math.max(1, Math.round(N * STRING.pickupPos)); for (let i = len - 1; i >= D; i--) tmp[i] -= STRING.pickupComb * tmp[i - D]; }
    for (let i = 0; i < len; i++) if (Math.abs(tmp[i]) > peak) peak = Math.abs(tmp[i]);
    const g = amp / (peak || 1);
    for (let i = 0; i < len; i++) out[i] += tmp[i] * g;
  }
  // Nota tamponu: tel modeli, isteğe bağlı ikinci polarizasyon (çok hafif farklı akort ve sönüm, yavaş dalgalanan sürdürüm).
  // mute: palm mute, avuç köprüde; tel her turda yüzde on kaybeder (çeyrek saniyede söner), vuruş daha koyu, tampon daha kısa.
  function ksBuffer(midi, pp0, key, mute){
    key = key || (midi + (mute ? "m" : ""));
    if (bufCache[key]) return bufCache[key];
    const sr = ctx.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12), Nf = sr / f, len = Math.floor(sr * (mute ? 0.8 : 3.0));
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    const decay = mute ? 0.9 : 0.9988 - (midi - 40) * 0.000055;
    ksLine(out, Nf, pp0, decay, 0.55, STRING.smooth + (mute ? 2 : 0));
    if (STRING.dual > 0 && !mute) ksLine(out, Nf * (1 + STRING.dualDetune), pp0, decay - 0.0004, STRING.dual, STRING.smooth);
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    const g = 0.55 / (peak || 1);
    for (let i = 0; i < 64; i++) out[i] *= i / 64;
    for (let i = 0; i < len; i++) out[i] *= g;
    bufCache[key] = buf;
    return buf;
  }
  // Çalış teknikleri: bend (yarım ses) teli büker; lead tonda bazı uzun notalar alttan kayar; tek uzun notalarda gecikmeli vibrato;
  // palm mute (e.m ya da kalın telde çok kısa nota) koyu ve kısa; legato (e.h) pena sesi yok, yumuşak atak; her vuruşa kısa pena sesi.
  function expressNote(src, g, e, t, dur, midi, srcs){
    const pr = src.playbackRate, ampName = engine.ampName, drive = ampName !== "clean";
    const muted = !!e.m || (drive && e.s <= 2 && dur <= 0.22 && !e.h);
    if (e.bend){ pr.setValueAtTime(1, t + Math.min(0.08, dur * 0.2)); pr.linearRampToValueAtTime(Math.pow(2, e.bend / 12), t + Math.min(0.08, dur * 0.2) + Math.min(0.18, dur * 0.4)); }
    else if (ampName === "lead" && dur >= 0.4 && !e.inChord && (e.s * 7 + e.f * 3 + Math.round(e.b * 4)) % 3 === 0){ pr.setValueAtTime(Math.pow(2, -0.3 / 12), t); pr.linearRampToValueAtTime(1, t + 0.04); }
    // Vibrato yalnız tek notalarda: akorun telleri birbirine karşı kaymasın. Geç başlar, yavaş derinleşir, hızı notadan notaya biraz değişir.
    if (!e.inChord && !muted && dur >= (ampName === "lead" ? 0.42 : 0.8)){
      const lfo = ctx.createOscillator(), dep = ctx.createGain(), hz = (ampName === "clean" ? 4.6 : 5.0) + ((e.s * 3 + e.f) % 5) * 0.08;
      lfo.frequency.value = hz; dep.gain.setValueAtTime(0, t); dep.gain.setValueAtTime(0, t + 0.3);
      dep.gain.linearRampToValueAtTime(ampName === "lead" ? 0.006 : 0.004, t + Math.min(dur, 0.9));
      lfo.connect(dep); dep.connect(pr); lfo.start(t); lfo.stop(t + dur + 0.3); srcs.push(lfo);
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
