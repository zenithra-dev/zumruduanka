// Amfi zinciri, master bus, yankı ve oda. Bir AudioContext'e (gerçek ya da offline) bağlı tek motor.
import { rand, hash01 } from "../rng.js";

// pickup: manyetiğin rezonans frekansı (kablo ve bobin; kısık ses = koyu), bias: lamba kademesinin asimetrisi (çift harmonikler),
// pres: tonlamadan sonra 3.9 kHz presence, lp: kabin sonrası emniyet kesimi
export const AMPS = {
  clean:  {pre: 1.0, k: 1,   post: 0.9,  b: 2, m: -1, t: 3, lp: 9000, wet: 0.18, rev: 0.28, pickup: 5000, pq: 1.6, bias: 0.0,  pres: 1},
  crunch: {pre: 2.8, k: 30,  post: 0.4,  b: 3, m: 2,  t: 2, lp: 9000, wet: 0.1,  rev: 0.14, pickup: 4200, pq: 2.0, bias: 0.04, pres: 2},
  lead:   {pre: 4.6, k: 170, post: 0.26, b: 2, m: 4,  t: 1, lp: 9000, wet: 0.28, rev: 0.22, pickup: 3600, pq: 2.2, bias: 0.05, pres: 3}
};
// Yumuşak kırpma eğrisi; bias ile asimetrik: lamba kademesi gibi çift harmonikler üretir (DC bileşeni çıkarılır)
function curve(k, bias = 0){
  const n = 4096, c = new Float32Array(n), sat = x => k === 0 ? x : (1 + k) * x / (1 + k * Math.abs(x)), c0 = sat(bias);
  for (let i = 0; i < n; i++){ const x = i * 2 / n - 1; c[i] = sat(x + bias) - c0; }
  return c;
}
// RBJ biquad katsayıları ve bir diziye uygulanması; kabin yanıtını tasarlamak için
function biquad(type, sr, f, Q, dB){
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q), A = Math.pow(10, (dB || 0) / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp"){ b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === "hp"){ b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function applyBiquad(d, [b0, b1, b2, a1, a2]){
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++){ const x = d[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y; }
}
function softCurve(){ const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++){ const x = i * 2 / n - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } return c; }
// 4x12 kabin yanıtı: 12" gitar hoparlörünün tipik eğrisi (80 Hz altı kesik, 130 Hz tınlama, 480 Hz çukur,
// 2.6 kHz presence tepesi, 5 kHz üstü dik düşüş) artı yakın mikrofon ve kutunun kısa yansımaları. 1 kHz'de birim kazanç.
export const CAB = {hp: [80, 0.7], thump: [130, 1.0, 3], scoop: [480, 0.9, -3.5], pres: [2600, 1.1, 4], lp1: [4800, 0.8], lp2: [5200, 0.6],
  refl: [[0.0007, 0.35], [0.0016, -0.25], [0.0031, 0.18], [0.0052, -0.1]]};
function cabIR(ctx){
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.03), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  d[0] = 1;
  CAB.refl.forEach(([t, g]) => { d[Math.floor(t * sr)] += g; });
  [biquad("hp", sr, ...CAB.hp), biquad("peak", sr, ...CAB.thump), biquad("peak", sr, ...CAB.scoop), biquad("peak", sr, ...CAB.pres),
   biquad("lp", sr, ...CAB.lp1), biquad("lp", sr, ...CAB.lp2)].forEach(c => applyBiquad(d, c));
  const w = 2 * Math.PI * 1000 / sr; let re = 0, im = 0;
  for (let i = 0; i < len; i++){ re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
  const g = 1 / (Math.hypot(re, im) || 1); for (let i = 0; i < len; i++) d[i] *= g;
  return b;
}
// Oda yanıtı: ön gecikme, erken yansımalar, kararan kuyruk (stereo)
function roomIR(ctx, sec){
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr), pd = Math.floor(sr * 0.018);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = pd; i < len; i++){
      const t = (i - pd) / sr, a = Math.min(0.85, 0.2 + t * 6);
      lp = lp * a + (rand() * 2 - 1) * (1 - a);
      d[i] = lp * Math.exp(-6.9 * t / sec) * 1.6;
    }
    [0.007, 0.013, 0.021, 0.029, 0.041].forEach((e, k) => { const j = pd + Math.floor(sr * (e + ch * 0.0023)); if (j < len) d[j] += 0.5 / (k + 1); });
  }
  return b;
}
// Küçük, kuru oda (yatak odası): durumsuz gürültü (hash01; rand() akışına dokunmaz), yakın erken yansımalar, daha koyu kuyruk.
// r = {sec, pre, dark, level, er: [[sn, kazanç]], salt} (venues.js ENVS.oda.room)
function stillRoomIR(ctx, r){
  const sr = ctx.sampleRate, len = Math.floor(sr * r.sec), b = ctx.createBuffer(2, len, sr), pd = Math.floor(sr * r.pre);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = pd; i < len; i++){
      const t = (i - pd) / sr, a = Math.min(r.dark, 0.35 + t * 9);
      lp = lp * a + (hash01(i + ch * len, r.salt) * 2 - 1) * (1 - a);
      d[i] = lp * Math.exp(-6.9 * t / r.sec) * r.level;
    }
    r.er.forEach(([e, g]) => { const j = pd + Math.floor(sr * (e + ch * 0.0011)); if (j < len) d[j] += g; });
  }
  return b;
}

export function createEngine(ctx, prefs = {}){
  let ampName = prefs.amp || "crunch", roomSec = prefs.room || 1.4;
  const G = v => { const g = ctx.createGain(); if (v !== undefined) g.gain.value = v; return g; };
  const F = (type, f, q, gain) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q !== undefined) x.Q.value = q; if (gain !== undefined) x.gain.value = gain; return x; };
  // Amfi zinciri: manyetik → sıkılaştırma → ön vurgulama → asimetrik kademe → kuplaj ve cızırtı → ton katı → presence → güç kademesi → geri vurgulama → kabin.
  // İki bağımsız zincir var: sol ve sağ kanal, çift kayıt için (ritim partisi iki ayrı performans gibi çalınır).
  function makeAmp(){
    const inp = G();
    const pickup = F("lowpass", 3300, 2.0);                    // bobin+kablo rezonansı; tiz "cam" sesini alır, tok elektro karakteri verir
    const highp = F("highpass", 100, 0.7), tight = F("peaking", 700, 0.8, 3);
    const preEmph = F("lowshelf", 180, undefined, -6), deEmph = F("lowshelf", 160, undefined, 4);   // kırpmadan önce bası kıs, sonra geri ver
    const pre = G(), shaper = ctx.createWaveShaper(), post = G(); shaper.oversample = "4x";
    const couple = F("highpass", 40, 0.7), fizz = F("lowpass", 7000, 0.7);
    const tBass = F("lowshelf", 120), tMid = F("peaking", 800, 0.9), tTreb = F("highshelf", 3200), presence = F("peaking", 3900, 1.0, 0);
    const power = ctx.createWaveShaper(); power.curve = softCurve(); power.oversample = "2x";
    const cab = ctx.createConvolver(); cab.normalize = false; cab.buffer = cabBuf;
    const lowp = F("lowpass", 9000, 0.7), out = G(0.8);
    inp.connect(pickup); pickup.connect(highp); highp.connect(tight); tight.connect(preEmph); preEmph.connect(pre); pre.connect(shaper); shaper.connect(post);
    post.connect(couple); couple.connect(fizz); fizz.connect(tBass); tBass.connect(tMid); tMid.connect(tTreb); tTreb.connect(presence); presence.connect(power);
    power.connect(deEmph); deEmph.connect(cab); cab.connect(lowp); lowp.connect(out);
    return {inp, out, cab, apply(a){
      pickup.frequency.value = a.pickup; pickup.Q.value = a.pq;
      pre.gain.value = a.pre; shaper.curve = curve(a.k, a.bias); post.gain.value = a.post; lowp.frequency.value = a.lp;
      tBass.gain.value = a.b; tMid.gain.value = a.m; tTreb.gain.value = a.t; presence.gain.value = a.pres;
    }};
  }
  const cabBuf = prefs.cabIR || cabIR(ctx);
  const ampL = makeAmp(), ampR = makeAmp();
  const chainIn = ampL.inp, chainIn2 = ampR.inp;
  const master = G();
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -16; glue.ratio.value = 2.5; glue.knee.value = 8; glue.attack.value = 0.02; glue.release.value = 0.2;
  const presM = F("highshelf", 3000, undefined, 2), air = F("highshelf", 8000, undefined, 3);   // karışıma açıklık
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  master.connect(glue); glue.connect(presM); presM.connect(air); air.connect(lim); lim.connect(ctx.destination);
  let recDest = null;
  if (ctx.createMediaStreamDestination){ recDest = ctx.createMediaStreamDestination(); lim.connect(recDest); }
  // Sol ve sağ zincir: iki amfi iki mikrofon gibi, sahnenin iki yanına
  const pL = ctx.createStereoPanner(); pL.pan.value = -0.8; const pR = ctx.createStereoPanner(); pR.pan.value = 0.8;
  ampL.out.connect(pL); pL.connect(master); ampR.out.connect(pR); pR.connect(master);
  const gOut = G(0.5); ampL.out.connect(gOut); ampR.out.connect(gOut);   // efekt gönderimi için toplam
  // Yankı ve oda
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.31; const fbk = G(0.3), wet = G();
  const dHi = F("lowpass", 3500); gOut.connect(delay); delay.connect(dHi); dHi.connect(fbk); fbk.connect(delay); dHi.connect(wet); wet.connect(master);
  const revIn = G(), reverb = ctx.createConvolver(); reverb.buffer = roomIR(ctx, roomSec); const revOut = G(0.9);
  const revHp = F("highpass", 220); revIn.connect(revHp); revHp.connect(reverb); reverb.connect(revOut); revOut.connect(master);
  const gtrRev = G(); gOut.connect(gtrRev); gtrRev.connect(revIn);

  function setAmp(n){
    ampName = n; const a = AMPS[n];
    ampL.apply(a); ampR.apply(a); wet.gain.value = a.wet; gtrRev.gain.value = a.rev;
  }
  function setCabIR(buf){ ampL.cab.buffer = buf; ampR.cab.buffer = buf; }
  function setRoom(sec){ roomSec = sec; reverb.buffer = typeof sec === "number" ? roomIR(ctx, sec) : stillRoomIR(ctx, sec); }
  function setVolume(v){ master.gain.value = v * 0.62; }
  let noiseBuf = null;
  function noiseSrc(){
    if (!noiseBuf){ const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1; noiseBuf = b; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  setAmp(ampName); setVolume(prefs.volume === undefined ? 0.75 : prefs.volume);
  return { ctx, chainIn, chainIn2, master, delay, revIn, recDest, get ampName(){ return ampName; }, get roomSec(){ return roomSec; }, setAmp, setRoom, setVolume, setCabIR, noiseSrc };
}
