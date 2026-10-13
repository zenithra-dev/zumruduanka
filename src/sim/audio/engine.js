// Amfi zinciri, master bus, yankı ve oda. Bir AudioContext'e (gerçek ya da offline) bağlı tek motor.
import { rand } from "../rng.js";

export const AMPS = {
  clean:  {pre: 1.0, k: 1,   post: 0.9,  b: 2, m: -1, t: 3, lp: 7800, wet: 0.18, rev: 0.28},
  crunch: {pre: 2.8, k: 30,  post: 0.4,  b: 3, m: 2,  t: 2, lp: 6200, wet: 0.1,  rev: 0.14},
  lead:   {pre: 4.6, k: 170, post: 0.26, b: 2, m: 4,  t: 1, lp: 5600, wet: 0.28, rev: 0.22}
};
function curve(k){
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++){ const x = i * 2 / n - 1; c[i] = k === 0 ? x : (1 + k) * x / (1 + k * Math.abs(x)); }
  return c;
}
function softCurve(){ const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++){ const x = i * 2 / n - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); } return c; }
// 4x12 kabin yanıtı: rezonansların sönümlü toplamı
function cabIR(ctx){
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.04), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  const R = [[95, 0.7, 60], [160, 0.5, 80], [420, 0.35, 140], [1150, 0.55, 260], [2300, 0.45, 420], [3400, 0.25, 700], [5200, 0.08, 1200]];
  for (let i = 0; i < len; i++){ const t = i / sr; let v = 0; R.forEach(([f, a, dmp]) => { v += a * Math.sin(2 * Math.PI * f * t) * Math.exp(-dmp * t); }); d[i] = v + (i < 40 ? (rand() - 0.5) * 0.4 : 0); }
  let pk = 0; for (let i = 0; i < len; i++) pk += Math.abs(d[i]); for (let i = 0; i < len; i++) d[i] *= 5 / pk;
  d[0] += 0.7; d[1] -= 0.15;
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

export function createEngine(ctx, prefs = {}){
  let ampName = prefs.amp || "crunch", roomSec = prefs.room || 1.4;
  const G = v => { const g = ctx.createGain(); if (v !== undefined) g.gain.value = v; return g; };
  const F = (type, f, q, gain) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q !== undefined) x.Q.value = q; if (gain !== undefined) x.gain.value = gain; return x; };
  const chainIn = G();
  const highp = F("highpass", 80, 0.7);
  const tight = F("peaking", 700, 0.8, 4);
  const pre = G(), shaper = ctx.createWaveShaper(), post = G(); shaper.oversample = "4x";
  const tBass = F("lowshelf", 120), tMid = F("peaking", 800, 0.9), tTreb = F("highshelf", 3200);
  const power = ctx.createWaveShaper(); power.curve = softCurve(); power.oversample = "2x";
  const cab = ctx.createConvolver(); cab.normalize = false; cab.buffer = cabIR(ctx);
  const lowp = F("lowpass", 6000, 0.7);
  const gOut = G(0.8);
  chainIn.connect(highp); highp.connect(tight); tight.connect(pre); pre.connect(shaper); shaper.connect(post);
  post.connect(tBass); tBass.connect(tMid); tMid.connect(tTreb); tTreb.connect(power); power.connect(cab); cab.connect(lowp); lowp.connect(gOut);
  const master = G();
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -16; glue.ratio.value = 2.5; glue.knee.value = 8; glue.attack.value = 0.02; glue.release.value = 0.2;
  const air = F("highshelf", 8000, undefined, 3);
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  master.connect(glue); glue.connect(air); air.connect(lim); lim.connect(ctx.destination);
  let recDest = null;
  if (ctx.createMediaStreamDestination){ recDest = ctx.createMediaStreamDestination(); lim.connect(recDest); }
  // Gitar: Haas ile çift kayıt hissi
  const pL = ctx.createStereoPanner(); pL.pan.value = -0.65; const pR = ctx.createStereoPanner(); pR.pan.value = 0.65;
  const haas = ctx.createDelay(0.05); haas.delayTime.value = 0.014;
  gOut.connect(pL); pL.connect(master); gOut.connect(haas); haas.connect(pR); pR.connect(master);
  // Yankı ve oda
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.31; const fbk = G(0.3), wet = G();
  const dHi = F("lowpass", 3500); gOut.connect(delay); delay.connect(dHi); dHi.connect(fbk); fbk.connect(delay); dHi.connect(wet); wet.connect(master);
  const revIn = G(), reverb = ctx.createConvolver(); reverb.buffer = roomIR(ctx, roomSec); const revOut = G(0.9);
  const revHp = F("highpass", 220); revIn.connect(revHp); revHp.connect(reverb); reverb.connect(revOut); revOut.connect(master);
  const gtrRev = G(); gOut.connect(gtrRev); gtrRev.connect(revIn);

  function setAmp(n){
    ampName = n; const a = AMPS[n];
    pre.gain.value = a.pre; shaper.curve = curve(a.k); post.gain.value = a.post; lowp.frequency.value = a.lp; wet.gain.value = a.wet;
    tBass.gain.value = a.b; tMid.gain.value = a.m; tTreb.gain.value = a.t; gtrRev.gain.value = a.rev;
  }
  function setRoom(sec){ roomSec = sec; reverb.buffer = roomIR(ctx, sec); }
  function setVolume(v){ master.gain.value = v * 0.62; }
  let noiseBuf = null;
  function noiseSrc(){
    if (!noiseBuf){ const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1; noiseBuf = b; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  setAmp(ampName); setVolume(prefs.volume === undefined ? 0.75 : prefs.volume);
  return { ctx, chainIn, master, delay, revIn, recDest, get ampName(){ return ampName; }, get roomSec(){ return roomSec; }, setAmp, setRoom, setVolume, noiseSrc };
}
