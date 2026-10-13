// Gitar sesi: Karplus-Strong tel modeli ve çalma teknikleri.
import { rand } from "../rng.js";

export function createGuitar(engine){
  const { ctx } = engine, bufCache = {};
  // Karplus-Strong: pena konumu tarağı, pena sertliği ve tel sertliği
  function ksBuffer(midi, pp0, key){
    key = key || midi;
    if (bufCache[key]) return bufCache[key];
    const sr = ctx.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12);
    const Nf = sr / f, N = Math.max(2, Math.floor(Nf)), frac = Nf - N, len = Math.floor(sr * 3.0);
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    const ring = new Float32Array(N + 1), ex = new Float32Array(N + 1);
    let prev = 0;
    for (let i = 0; i <= N; i++){ const r = rand() * 2 - 1; prev = prev * 0.45 + r * 0.55; ex[i] = prev; }
    const pp = Math.max(1, Math.floor(N * (pp0 || 0.14)));
    for (let i = 0; i <= N; i++) ring[i] = ex[i] - 0.85 * ex[(i - pp + N + 1) % (N + 1)];
    const decay = 0.9988 - (midi - 40) * 0.000055, M = N + 1;
    let idx = 0, peak = 0, ap = 0, lastIn = 0;
    const c = (1 - frac) / (1 + frac);
    for (let i = 0; i < len; i++){
      const a = ring[idx], b = ring[(idx + 1) % M];
      const y = c * (a - ap) + lastIn; lastIn = a; ap = y;
      out[i] = a;
      ring[idx] = decay * (0.5 * (a + b) * 0.92 + y * 0.08);
      idx = (idx + 1) % M;
      if (Math.abs(a) > peak) peak = Math.abs(a);
    }
    const g = 0.55 / (peak || 1);
    for (let i = 0; i < 64; i++) out[i] *= i / 64;
    for (let i = 0; i < len; i++) out[i] *= g;
    bufCache[key] = buf;
    return buf;
  }
  // Uzun notalarda gecikmeli vibrato, lead tonda bazı notalara aşağıdan kayma, kalın tellerde kısa notalara palm mute,
  // her vuruşa kısa bir pena sesi. Şarkı verisinde bend (yarım ses) varsa teli büker.
  function expressNote(src, g, e, t, dur, midi, srcs){
    const pr = src.playbackRate, ampName = engine.ampName, drive = ampName !== "clean";
    if (e.bend){ pr.setValueAtTime(1, t + Math.min(0.08, dur * 0.2)); pr.linearRampToValueAtTime(Math.pow(2, e.bend / 12), t + Math.min(0.08, dur * 0.2) + Math.min(0.18, dur * 0.4)); }
    else if (ampName === "lead" && dur >= 0.3 && (e.s * 7 + e.f * 3 + Math.round(e.b * 4)) % 3 === 0){ pr.setValueAtTime(Math.pow(2, -1 / 12), t); pr.linearRampToValueAtTime(1, t + 0.06); }
    if (dur >= 0.42){
      const lfo = ctx.createOscillator(), dep = ctx.createGain(), hz = ampName === "clean" ? 4.8 : 5.6;
      lfo.frequency.value = hz; dep.gain.setValueAtTime(0, t); dep.gain.setValueAtTime(0, t + 0.22);
      dep.gain.linearRampToValueAtTime(ampName === "lead" ? 0.013 : 0.007, t + Math.min(dur, 0.7));
      lfo.connect(dep); dep.connect(pr); lfo.start(t); lfo.stop(t + dur + 0.3); srcs.push(lfo);
    }
    if (drive && e.s <= 2 && dur <= 0.3){
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 650 + e.s * 150; lp.Q.value = 0.9;
      g.gain.setTargetAtTime(0, t + 0.03, 0.07); e.mute = lp;
    }
    const ns = engine.noiseSrc(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = "bandpass"; hp.frequency.value = 2600 + e.s * 300; hp.Q.value = 1.4;
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(drive ? 0.05 : 0.08, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    ns.connect(hp); hp.connect(ng); ng.connect(g); ns.start(t, rand() * 0.5); ns.stop(t + 0.03); srcs.push(ns);
  }
  return { ksBuffer, expressNote };
}
